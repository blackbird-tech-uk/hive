import { Search, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../app/AuthContext'
import { StatCard } from '../components/dashboard/StatCard'
import { DeviceDetails } from '../components/devices/DeviceDetails'
import { DeviceTable } from '../components/devices/DeviceTable'
import { TopBar } from '../components/layout/TopBar'
import {
  getDevices,
  restoreAuthSession,
  type Device,
} from '../lib/api'
import {
  connectToDeviceUpdates,
  type RealtimeConnectionStatus,
} from '../lib/realtime'

const DEVICE_ONLINE_THRESHOLD_MS =
  20 * 60 * 1_000

const LOW_BATTERY_THRESHOLD = 20

function normaliseSearchValue(
  value: string | null | undefined,
): string {
  return value?.toLowerCase().trim() ?? ''
}

function isDeviceOnline(
  device: Device,
  currentTime: number,
): boolean {
  if (!device.last_seen_at) {
    return false
  }

  const lastSeenTime = new Date(
    device.last_seen_at,
  ).getTime()

  if (Number.isNaN(lastSeenTime)) {
    return false
  }

  return (
    currentTime - lastSeenTime <=
    DEVICE_ONLINE_THRESHOLD_MS
  )
}

function isLowBattery(
  device: Device,
): boolean {
  return (
    device.battery_level !== null &&
    device.battery_level !== undefined &&
    device.battery_level <=
      LOW_BATTERY_THRESHOLD &&
    device.is_charging !== true
  )
}

export function DevicesPage() {
  const { activeOrganization } = useAuth()

  const [
    selectedDevice,
    setSelectedDevice,
  ] = useState<Device | null>(null)

  const [devices, setDevices] = useState<
    Device[]
  >([])

  const [searchQuery, setSearchQuery] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] = useState<
    string | null
  >(null)

  const [
    realtimeStatus,
    setRealtimeStatus,
  ] =
    useState<RealtimeConnectionStatus>(
      'disconnected',
    )

  const [currentTime, setCurrentTime] =
    useState(Date.now())

  const loadDevices = useCallback(
    async (
      showInitialLoader = false,
    ) => {
      if (showInitialLoader) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const response =
          await getDevices()

        setDevices(response)
        setError(null)
        setCurrentTime(Date.now())

        setSelectedDevice(
          (currentDevice) => {
            if (!currentDevice) {
              return null
            }

            return (
              response.find(
                (device) =>
                  device.id ===
                  currentDevice.id,
              ) ?? null
            )
          },
        )
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load devices.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadDevices(true)
  }, [
    loadDevices,
    activeOrganization?.id,
  ])

  useEffect(() => {
    if (!activeOrganization) {
      setRealtimeStatus(
        'disconnected',
      )

      return
    }

    const session =
      restoreAuthSession()

    if (!session.accessToken) {
      setRealtimeStatus(
        'disconnected',
      )

      return
    }

    const disconnect =
      connectToDeviceUpdates<Device>({
        token: session.accessToken,
        organizationId:
          activeOrganization.id,

        onDeviceUpdated(
          updatedDevice,
        ) {
          setDevices(
            (currentDevices) => {
              const deviceExists =
                currentDevices.some(
                  (device) =>
                    device.id ===
                    updatedDevice.id,
                )

              if (!deviceExists) {
                return [
                  updatedDevice,
                  ...currentDevices,
                ]
              }

              return currentDevices.map(
                (device) =>
                  device.id ===
                  updatedDevice.id
                    ? updatedDevice
                    : device,
              )
            },
          )

          setSelectedDevice(
            (currentDevice) => {
              if (
                currentDevice?.id ===
                updatedDevice.id
              ) {
                return updatedDevice
              }

              return currentDevice
            },
          )

          setCurrentTime(Date.now())
          setError(null)
        },

        onStatusChange(status) {
          setRealtimeStatus(status)
        },
      })

    return disconnect
  }, [activeOrganization])

  useEffect(() => {
    const clockInterval =
      window.setInterval(() => {
        setCurrentTime(Date.now())
      }, 1_000)

    return () => {
      window.clearInterval(
        clockInterval,
      )
    }
  }, [])

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadDevices()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [loadDevices])

  const onlineDevices = useMemo(
    () =>
      devices.filter((device) =>
        isDeviceOnline(
          device,
          currentTime,
        ),
      ).length,
    [devices, currentTime],
  )

  const offlineDevices =
    devices.length - onlineDevices

  const lowBatteryDevices = useMemo(
    () =>
      devices.filter(isLowBattery)
        .length,
    [devices],
  )

  const filteredDevices =
    useMemo(() => {
      const query =
        normaliseSearchValue(
          searchQuery,
        )

      if (!query) {
        return devices
      }

      return devices.filter(
        (device) => {
          const connectionStatus =
            isDeviceOnline(
              device,
              currentTime,
            )
              ? 'online'
              : 'offline'

          const searchableValues = [
            device.hive_id,
            device.asset_id,
            device.serial_number,
            device.imei,
            device.manufacturer,
            device.model,
            device.android_version,
            device.build_version,
            device.agent_version,
            device.wifi_ssid,
            device.ip_address,
            device.status,
            device.condition,
            device.notes,
            connectionStatus,
          ]

          return searchableValues.some(
            (value) =>
              normaliseSearchValue(
                value,
              ).includes(query),
          )
        },
      )
    }, [
      devices,
      searchQuery,
      currentTime,
    ])

  return (
    <>
      <TopBar
        isLoading={
          loading || refreshing
        }
        onRefresh={() =>
          void loadDevices()
        }
      />

      <section className="page-heading">
        <div>
          <p className="eyebrow">
            DEVICE OPERATIONS
          </p>

          <h1>Devices</h1>

          <p>
            Monitor live health and
            connectivity for every
            device registered with
            Hive.
          </p>
        </div>

        <div
          className={`realtime-status realtime-status--${realtimeStatus}`}
          title={`Realtime connection: ${realtimeStatus}`}
        >
          <span
            aria-hidden="true"
            className="realtime-status-dot"
          />

          <span>
            {realtimeStatus ===
              'connected' &&
              'Live'}

            {realtimeStatus ===
              'connecting' &&
              'Connecting'}

            {realtimeStatus ===
              'disconnected' &&
              'Offline'}
          </span>
        </div>
      </section>

      {error && (
        <div
          className="dashboard-alert"
          role="alert"
        >
          <strong>
            Device data unavailable
          </strong>

          <span>{error}</span>
        </div>
      )}

      <section className="metric-grid">
        <StatCard
          label="Devices"
          value={devices.length}
          description="Registered devices"
        />

        <StatCard
          label="Online"
          value={onlineDevices}
          description="Seen within 20 minutes"
        />

        <StatCard
          label="Offline"
          value={offlineDevices}
          description="Heartbeat overdue"
        />

        <StatCard
          label="Low battery"
          value={lowBatteryDevices}
          description="20% or below"
        />
      </section>

      <section className="device-list-section">
        <div className="device-list-toolbar">
          <div className="device-search">
            <Search
              aria-hidden="true"
              className="device-search-icon"
              size={18}
            />

            <input
              aria-label="Search devices"
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search Hive ID, asset, serial, Wi-Fi, IP or model..."
              type="search"
              value={searchQuery}
            />

            {searchQuery && (
              <button
                aria-label="Clear device search"
                className="device-search-clear"
                onClick={() =>
                  setSearchQuery('')
                }
                type="button"
              >
                <X
                  aria-hidden="true"
                  size={16}
                />
              </button>
            )}
          </div>

          <div className="device-search-result-count">
            {searchQuery ? (
              <>
                <strong>
                  {
                    filteredDevices.length
                  }
                </strong>

                <span>
                  {filteredDevices.length ===
                  1
                    ? ' result'
                    : ' results'}
                </span>
              </>
            ) : (
              <>
                <strong>
                  {devices.length}
                </strong>

                <span>
                  {devices.length === 1
                    ? ' device'
                    : ' devices'}
                </span>
              </>
            )}
          </div>
        </div>

        {loading &&
        devices.length === 0 ? (
          <div className="device-search-empty">
            <h2>
              Loading devices…
            </h2>

            <p>
              Hive is retrieving the
              latest device telemetry.
            </p>
          </div>
        ) : filteredDevices.length >
          0 ? (
          <DeviceTable
            devices={filteredDevices}
            onSelectDevice={
              setSelectedDevice
            }
          />
        ) : (
          <div className="device-search-empty">
            <Search
              aria-hidden="true"
              size={28}
            />

            <h2>
              No devices found
            </h2>

            <p>
              No scanner matches “
              {searchQuery}”. Try
              searching by Hive ID,
              asset tag, serial number,
              Wi-Fi network or IP
              address.
            </p>

            <button
              className="secondary-button"
              onClick={() =>
                setSearchQuery('')
              }
              type="button"
            >
              Clear search
            </button>
          </div>
        )}
      </section>

      {selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onClose={() =>
            setSelectedDevice(null)
          }
          onUpdated={(
            updatedDevice,
          ) => {
            setDevices(
              (currentDevices) =>
                currentDevices.map(
                  (device) =>
                    device.id ===
                    updatedDevice.id
                      ? updatedDevice
                      : device,
                ),
            )

            setSelectedDevice(
              updatedDevice,
            )
          }}
        />
      )}
    </>
  )
}