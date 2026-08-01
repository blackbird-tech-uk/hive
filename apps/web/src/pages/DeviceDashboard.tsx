import {
  ArrowLeft,
  BatteryCharging,
  Bell,
  Clock3,
  MapPin,
  MessageSquare,
  Radio,
  RefreshCw,
  Smartphone,
  Wifi,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router-dom'

import { StatusBadge } from '../components/devices/StatusBadge'
import {
  createDeviceCommand,
  getDevice,
  type Device,
} from '../lib/api'

const DEVICE_ONLINE_THRESHOLD_MS =
  20 * 60 * 1_000

function isDeviceOnline(
  device: Device,
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
    Date.now() - lastSeenTime <=
    DEVICE_ONLINE_THRESHOLD_MS
  )
}

function formatRelativeTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Never reported'
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return 'Unknown'
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp) / 1000,
    ),
  )

  if (seconds < 10) {
    return 'Just now'
  }

  if (seconds < 60) {
    return `${seconds} seconds ago`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes} minute${
      minutes === 1 ? '' : 's'
    } ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} hour${
      hours === 1 ? '' : 's'
    } ago`
  }

  const days = Math.floor(hours / 24)

  return `${days} day${
    days === 1 ? '' : 's'
  } ago`
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date)
}

function formatCommandName(
  command: string,
): string {
  return command
    .toLowerCase()
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(' ')
}

export function DeviceDashboardPage() {
  const { deviceId } = useParams<{
    deviceId: string
  }>()

  const [device, setDevice] =
    useState<Device | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] = useState<
    string | null
  >(null)

  const [sendingCommand, setSendingCommand] =
    useState<string | null>(null)

  const [commandNotice, setCommandNotice] =
    useState<string | null>(null)

  const [commandError, setCommandError] =
    useState<string | null>(null)

  const loadDevice = useCallback(
    async () => {
      if (!deviceId) {
        setError(
          'No device ID was provided.',
        )
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const loadedDevice =
          await getDevice(deviceId)

        setDevice(loadedDevice)
        setError(null)
      } catch (loadError) {
        setDevice(null)

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load this device.',
        )
      } finally {
        setLoading(false)
      }
    },
    [deviceId],
  )

  const sendCommand = useCallback(
    async (
      command: string,
      payload: Record<string, unknown> = {},
    ) => {
      if (!deviceId) {
        return
      }

      try {
        setSendingCommand(command)
        setCommandNotice(null)
        setCommandError(null)

        await createDeviceCommand(deviceId, {
          command,
          payload,
        })

        setCommandNotice(
          `${formatCommandName(
            command,
          )} command queued successfully.`,
        )
      } catch (sendError) {
        setCommandError(
          sendError instanceof Error
            ? sendError.message
            : 'Unable to send the device command.',
        )
      } finally {
        setSendingCommand(null)
      }
    },
    [deviceId],
  )

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

  if (loading) {
    return (
      <section className="device-dashboard-state">
        <div className="device-dashboard-loader" />

        <h1>Loading device</h1>

        <p>
          Retrieving device information from
          Hive.
        </p>
      </section>
    )
  }

  if (error || !device) {
    return (
      <section className="device-dashboard-state">
        <Smartphone
          aria-hidden="true"
          size={42}
        />

        <h1>Device unavailable</h1>

        <p>
          {error ??
            'This device could not be found.'}
        </p>

        <Link
          className="primary-button"
          to="/devices"
        >
          Back to devices
        </Link>
      </section>
    )
  }

  const online = isDeviceOnline(device)

  return (
    <section className="device-dashboard-page">
      <Link
        className="device-dashboard-back"
        to="/devices"
      >
        <ArrowLeft
          aria-hidden="true"
          size={17}
        />

        Back to devices
      </Link>

      <header className="device-dashboard-header">
        <div className="device-dashboard-identity">
          <div className="device-dashboard-icon">
            <Smartphone
              aria-hidden="true"
              size={28}
            />
          </div>

          <div>
            <p className="eyebrow">
              DEVICE MANAGEMENT
            </p>

            <h1>
              {device.asset_id ||
                device.hive_id ||
                'Unnamed device'}
            </h1>

            <div className="device-dashboard-subtitle">
              <span>
                {device.manufacturer ??
                  'Unknown manufacturer'}
              </span>

              <span aria-hidden="true">
                •
              </span>

              <span>
                {device.model ??
                  'Unknown model'}
              </span>

              {device.hive_id ? (
                <>
                  <span aria-hidden="true">
                    •
                  </span>

                  <code>
                    {device.hive_id}
                  </code>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="device-dashboard-header-status">
          <span
            className={
              online
                ? 'device-live-status device-live-status-online'
                : 'device-live-status device-live-status-offline'
            }
          >
            <span />

            {online ? 'Online' : 'Offline'}
          </span>

          <StatusBadge
            status={device.status}
          />
        </div>
      </header>

      <section
        aria-label="Device quick actions"
        className="device-dashboard-actions"
      >
        <div className="device-dashboard-actions-heading">
          <div>
            <p className="eyebrow">
              REMOTE MANAGEMENT
            </p>

            <h2>Quick actions</h2>
          </div>

          <span>
            Commands are securely queued for the
            Android agent.
          </span>
        </div>

        <div className="device-dashboard-action-grid">
          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() =>
              void sendCommand('PING')
            }
            type="button"
          >
            <Radio
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'PING'
                  ? 'Queuing...'
                  : 'Ping'}
              </strong>

              <small>
                Test agent connectivity
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() =>
              void sendCommand('RING')
            }
            type="button"
          >
            <Bell
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'RING'
                  ? 'Queuing...'
                  : 'Ring device'}
              </strong>

              <small>
                Play an audible alert
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() =>
              void sendCommand(
                'REQUEST_LOCATION',
              )
            }
            type="button"
          >
            <MapPin
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand ===
                'REQUEST_LOCATION'
                  ? 'Queuing...'
                  : 'Locate'}
              </strong>

              <small>
                Request current location
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled
            title="Message composer will be added next"
            type="button"
          >
            <MessageSquare
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>Message</strong>

              <small>
                Display a device message
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled={loading}
            onClick={() =>
              void loadDevice()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>Refresh</strong>

              <small>
                Reload device telemetry
              </small>
            </span>
          </button>
        </div>

        {commandNotice && (
          <p
            className="device-dashboard-command-notice"
            role="status"
          >
            {commandNotice}
          </p>
        )}

        {commandError && (
          <p
            className="device-dashboard-command-error"
            role="alert"
          >
            {commandError}
          </p>
        )}
      </section>

      <section
        aria-label="Device summary"
        className="device-dashboard-summary"
      >
        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <BatteryCharging
              aria-hidden="true"
              size={21}
            />
          </span>

          <div>
            <span>Battery</span>

            <strong>
              {device.battery_level !== null &&
              device.battery_level !== undefined
                ? `${device.battery_level}%`
                : 'Unknown'}
            </strong>

            <small>
              {device.is_charging === true
                ? 'Currently charging'
                : device.is_charging === false
                  ? 'Not charging'
                  : 'Charging state unknown'}
            </small>
          </div>
        </article>

        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <Wifi
              aria-hidden="true"
              size={21}
            />
          </span>

          <div>
            <span>Connectivity</span>

            <strong>
              {device.wifi_ssid ??
                'Not connected'}
            </strong>

            <small>
              {device.ip_address ??
                'No IP reported'}
            </small>
          </div>
        </article>

        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <Smartphone
              aria-hidden="true"
              size={21}
            />
          </span>

          <div>
            <span>Platform</span>

            <strong>
              Android{' '}
              {device.android_version ??
                'Unknown'}
            </strong>

            <small>
              Agent{' '}
              {device.agent_version ??
                'Unknown'}
            </small>
          </div>
        </article>

        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <Clock3
              aria-hidden="true"
              size={21}
            />
          </span>

          <div>
            <span>Last heartbeat</span>

            <strong>
              {formatRelativeTime(
                device.last_seen_at,
              )}
            </strong>

            <small>
              {formatDateTime(
                device.last_seen_at,
              )}
            </small>
          </div>
        </article>
      </section>

      <nav
        aria-label="Device sections"
        className="device-dashboard-tabs"
      >
        <button
          className="device-dashboard-tab device-dashboard-tab-active"
          type="button"
        >
          Overview
        </button>

        <button
          disabled
          className="device-dashboard-tab"
          type="button"
        >
          Activity
        </button>

        <button
          disabled
          className="device-dashboard-tab"
          type="button"
        >
          Commands
        </button>

        <button
          disabled
          className="device-dashboard-tab"
          type="button"
        >
          Location
        </button>

        <button
          disabled
          className="device-dashboard-tab"
          type="button"
        >
          Notes
        </button>
      </nav>

      <div className="device-dashboard-layout">
        <main className="device-dashboard-main">
          <section className="device-dashboard-panel">
            <div className="device-dashboard-panel-header">
              <div>
                <p className="eyebrow">
                  DEVICE OVERVIEW
                </p>

                <h2>Device information</h2>
              </div>
            </div>

            <dl className="device-dashboard-information">
              <div>
                <dt>Database UUID</dt>
                <dd>
                  <code>{device.id}</code>
                </dd>
              </div>

              <div>
                <dt>Hive ID</dt>
                <dd>
                  <code>{device.hive_id}</code>
                </dd>
              </div>

              <div>
                <dt>Asset ID</dt>
                <dd>
                  {device.asset_id ||
                    'Not assigned'}
                </dd>
              </div>

              <div>
                <dt>Serial number</dt>
                <dd>
                  {device.serial_number ??
                    'Not reported'}
                </dd>
              </div>

              <div>
                <dt>IMEI</dt>
                <dd>
                  {device.imei ??
                    'Not reported'}
                </dd>
              </div>

              <div>
                <dt>Manufacturer</dt>
                <dd>
                  {device.manufacturer ??
                    'Not reported'}
                </dd>
              </div>

              <div>
                <dt>Model</dt>
                <dd>
                  {device.model ??
                    'Not reported'}
                </dd>
              </div>

              <div>
                <dt>Android version</dt>
                <dd>
                  {device.android_version ??
                    'Not reported'}
                </dd>
              </div>

              <div>
                <dt>Agent version</dt>
                <dd>
                  {device.agent_version ??
                    'Not reported'}
                </dd>
              </div>
            </dl>
          </section>
        </main>

        <aside className="device-dashboard-side">
          <section className="device-dashboard-panel">
            <div className="device-dashboard-panel-header">
              <div>
                <p className="eyebrow">
                  LIVE STATUS
                </p>

                <h2>Current state</h2>
              </div>
            </div>

            <div className="device-dashboard-status-list">
              <div>
                <span>Connection</span>

                <strong>
                  {online
                    ? 'Online'
                    : 'Offline'}
                </strong>
              </div>

              <div>
                <span>Inventory status</span>

                <StatusBadge
                  status={device.status}
                />
              </div>

              <div>
                <span>Wi-Fi network</span>

                <strong>
                  {device.wifi_ssid ??
                    'Not connected'}
                </strong>
              </div>

              <div>
                <span>IP address</span>

                <strong>
                  {device.ip_address ??
                    'Not reported'}
                </strong>
              </div>

              <div>
                <span>Last heartbeat</span>

                <strong>
                  {formatRelativeTime(
                    device.last_seen_at,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="device-dashboard-panel">
            <div className="device-dashboard-panel-header">
              <div>
                <p className="eyebrow">
                  LOCATION
                </p>

                <h2>Last known location</h2>
              </div>

              <MapPin
                aria-hidden="true"
                size={19}
              />
            </div>

            <div className="device-dashboard-empty">
              <p>
                Location details will be added
                in the next Device Dashboard
                milestone.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}