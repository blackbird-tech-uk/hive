import {
  Activity,
  Battery,
  CheckCircle2,
  Clock3,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Smartphone,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'

import { StatCard } from '../components/dashboard/StatCard'
import { TopBar } from '../components/layout/TopBar'
import {
  createDeviceCommand,
  getDeviceCommands,
  getDevices,
  type Device,
  type DeviceCommand,
} from '../lib/api'

type DashboardError = {
  devices?: string
  commands?: string
}

type CommandName =
  | 'SYNC'
  | 'PING'
  | 'LOCK_DEVICE'
  | 'SHOW_MESSAGE'

const ONLINE_WINDOW_MS = 2 * 60 * 1000

function isDeviceOnline(device: Device): boolean {
  if (!device.last_seen_at) {
    return false
  }

  const lastSeen = new Date(device.last_seen_at).getTime()

  return Date.now() - lastSeen <= ONLINE_WINDOW_MS
}

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Never'
  }

  const timestamp = new Date(value).getTime()
  const difference = Date.now() - timestamp
  const seconds = Math.max(0, Math.floor(difference / 1000))

  if (seconds < 10) {
    return 'Just now'
  }

  if (seconds < 60) {
    return `${seconds} seconds ago`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCommandName(command: string): string {
  return command
    .toLowerCase()
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ')
}

function getCommandStatusClass(status: string): string {
  return `command-status command-status-${status.toLowerCase()}`
}

export function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [commands, setCommands] = useState<DeviceCommand[]>([])
  const [selectedDeviceId, setSelectedDeviceId] =
    useState<string>('')
  const [loading, setLoading] = useState(true)
  const [sendingCommand, setSendingCommand] =
    useState<CommandName | null>(null)
  const [errors, setErrors] = useState<DashboardError>({})
  const [notice, setNotice] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setErrors({})

    try {
      const loadedDevices = await getDevices()
      setDevices(loadedDevices)

      const nextSelectedDevice =
        selectedDeviceId || loadedDevices[0]?.id || ''

      setSelectedDeviceId(nextSelectedDevice)

      if (!nextSelectedDevice) {
        setCommands([])
        return
      }

      try {
        const loadedCommands =
          await getDeviceCommands(nextSelectedDevice)

        setCommands(loadedCommands)
      } catch (error) {
        setErrors((current) => ({
          ...current,
          commands:
            error instanceof Error
              ? error.message
              : 'Unable to load commands.',
        }))
      }
    } catch (error) {
      setErrors({
        devices:
          error instanceof Error
            ? error.message
            : 'Unable to load devices.',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!selectedDeviceId) {
      return
    }

    const interval = window.setInterval(() => {
      void getDeviceCommands(selectedDeviceId)
        .then(setCommands)
        .catch(() => undefined)
    }, 5000)

    return () => window.clearInterval(interval)
  }, [selectedDeviceId])

  const selectedDevice = useMemo(
    () =>
      devices.find(
        (device) => device.id === selectedDeviceId,
      ) ?? null,
    [devices, selectedDeviceId],
  )

  const deviceStats = useMemo(() => {
    const online = devices.filter(isDeviceOnline).length

    const lowBattery = devices.filter(
      (device) =>
        device.battery_level !== null &&
        device.battery_level <= 20,
    ).length

    return {
      total: devices.length,
      online,
      offline: Math.max(0, devices.length - online),
      lowBattery,
    }
  }, [devices])

  const commandStats = useMemo(() => {
    const completed = commands.filter(
      (command) => command.status === 'completed',
    ).length

    const active = commands.filter((command) =>
      ['pending', 'sent', 'acknowledged'].includes(
        command.status,
      ),
    ).length

    const failed = commands.filter(
      (command) => command.status === 'failed',
    ).length

    return {
      completed,
      active,
      failed,
    }
  }, [commands])

  const latestCommands = useMemo(
    () =>
      [...commands]
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime(),
        )
        .slice(0, 8),
    [commands],
  )

  async function selectDevice(deviceId: string) {
    setSelectedDeviceId(deviceId)
    setErrors((current) => ({
      ...current,
      commands: undefined,
    }))

    try {
      setCommands(await getDeviceCommands(deviceId))
    } catch (error) {
      setCommands([])
      setErrors((current) => ({
        ...current,
        commands:
          error instanceof Error
            ? error.message
            : 'Unable to load commands.',
      }))
    }
  }

  async function sendCommand(command: CommandName) {
    if (!selectedDevice) {
      setNotice('Select a device before sending a command.')
      return
    }

    setSendingCommand(command)
    setNotice(null)

    try {
      const payload =
        command === 'SHOW_MESSAGE'
          ? {
              title: 'Hive message',
              message:
                'This device is being managed by Hive.',
            }
          : {}

      const createdCommand = await createDeviceCommand(
        selectedDevice.id,
        {
          command,
          payload,
        },
      )

      setCommands((current) => [
        createdCommand,
        ...current.filter(
          (item) => item.id !== createdCommand.id,
        ),
      ])

      setNotice(
        `${formatCommandName(command)} queued for ${
          selectedDevice.asset_id ||
          selectedDevice.hive_id
        }.`,
      )
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Unable to send command.',
      )
    } finally {
      setSendingCommand(null)
    }
  }

  return (
    <>
      <TopBar
        isLoading={loading}
        onRefresh={() => void loadDashboard()}
      />

      <section className="dashboard-heading control-centre-heading">
        <div>
          <p className="eyebrow">BLACKBIRD DEVICE MANAGEMENT</p>
          <h1>Hive Control Centre</h1>
          <p>
            Monitor enrolled Android devices, live telemetry
            and remote command delivery.
          </p>
        </div>

        <div className="platform-status">
          <span className="platform-status-dot" />
          <span>Platform operational</span>
        </div>
      </section>

      {errors.devices && (
        <div className="dashboard-alert" role="alert">
          <strong>Device data unavailable.</strong>
          <span>{errors.devices}</span>
        </div>
      )}

      {notice && (
        <div className="dashboard-notice" role="status">
          <Activity size={18} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      <section className="metric-grid control-centre-metrics">
        <StatCard
          label="Managed Devices"
          value={deviceStats.total}
          description="Enrolled in Hive"
        />

        <StatCard
          label="Online Now"
          value={deviceStats.online}
          description={`${deviceStats.offline} currently offline`}
        />

        <StatCard
          label="Active Commands"
          value={commandStats.active}
          description={`${commandStats.completed} completed`}
        />

        <StatCard
          label="Low Battery"
          value={deviceStats.lowBattery}
          description="Devices at 20% or below"
        />
      </section>

      <section className="control-centre-grid">
        <div className="control-centre-main">
          <article className="dashboard-panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="eyebrow">LIVE FLEET</p>
                <h2>Connected devices</h2>
              </div>

              <Link className="panel-link" to="/devices">
                View all devices
              </Link>
            </header>

            {devices.length === 0 && !loading ? (
              <div className="dashboard-empty-state">
                <Smartphone size={32} aria-hidden="true" />
                <h3>No enrolled devices</h3>
                <p>
                  Enrol an Android device to begin receiving
                  telemetry.
                </p>
              </div>
            ) : (
              <div className="live-device-list">
                {devices.slice(0, 8).map((device) => {
                  const online = isDeviceOnline(device)
                  const selected =
                    selectedDeviceId === device.id

                  return (
                    <button
                      className={`live-device-row${
                        selected
                          ? ' live-device-row-selected'
                          : ''
                      }`}
                      key={device.id}
                      onClick={() =>
                        void selectDevice(device.id)
                      }
                      type="button"
                    >
                      <span className="live-device-icon">
                        <Smartphone
                          size={19}
                          aria-hidden="true"
                        />
                      </span>

                      <span className="live-device-identity">
                        <strong>
                          {device.asset_id || device.hive_id}
                        </strong>
                        <small>
                          {[device.manufacturer, device.model]
                            .filter(Boolean)
                            .join(' ') || 'Android device'}
                        </small>
                      </span>

                      <span
                        className={`connection-status ${
                          online
                            ? 'connection-status-online'
                            : 'connection-status-offline'
                        }`}
                      >
                        <span className="device-state-dot" />
                        {online ? 'Online' : 'Offline'}
                      </span>

                      <span className="live-device-detail">
                        <Battery size={16} aria-hidden="true" />
                        {device.battery_level === null
                          ? '—'
                          : `${device.battery_level}%`}
                      </span>

                      <span className="live-device-detail">
                        <Wifi size={16} aria-hidden="true" />
                        {device.wifi_ssid || 'No Wi-Fi'}
                      </span>

                      <span className="live-device-last-seen">
                        {formatRelativeTime(
                          device.last_seen_at,
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </article>

          <article className="dashboard-panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="eyebrow">COMMAND LIFECYCLE</p>
                <h2>Recent commands</h2>
              </div>

              <span className="dashboard-count">
                {commands.length}
              </span>
            </header>

            {errors.commands ? (
              <div className="dashboard-alert" role="alert">
                <strong>Command data unavailable.</strong>
                <span>{errors.commands}</span>
              </div>
            ) : latestCommands.length === 0 ? (
              <div className="dashboard-empty-state">
                <Zap size={32} aria-hidden="true" />
                <h3>No commands sent yet</h3>
                <p>
                  Select a device and send a remote action
                  from the command panel.
                </p>
              </div>
            ) : (
              <div className="command-table-wrapper">
                <table className="command-table">
                  <thead>
                    <tr>
                      <th>Command</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestCommands.map((command) => (
                      <tr key={command.id}>
                        <td>
                          <strong>
                            {formatCommandName(
                              command.command,
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={getCommandStatusClass(
                              command.status,
                            )}
                          >
                            {command.status}
                          </span>
                        </td>

                        <td>
                          {formatRelativeTime(
                            command.created_at,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        <aside className="control-centre-side">
          <article className="dashboard-panel remote-actions-panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="eyebrow">REMOTE MANAGEMENT</p>
                <h2>Device actions</h2>
              </div>
            </header>

            <label
              className="device-selector-label"
              htmlFor="dashboard-device"
            >
              Target device
            </label>

            <select
              className="device-selector"
              id="dashboard-device"
              value={selectedDeviceId}
              onChange={(event) =>
                void selectDevice(event.target.value)
              }
            >
              <option value="">Select a device</option>

              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.asset_id || device.hive_id}
                </option>
              ))}
            </select>

            {selectedDevice && (
              <div className="selected-device-summary">
                <div>
                  <span>Device</span>
                  <strong>
                    {selectedDevice.asset_id ||
                      selectedDevice.hive_id}
                  </strong>
                </div>

                <div>
                  <span>Last seen</span>
                  <strong>
                    {formatRelativeTime(
                      selectedDevice.last_seen_at,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Agent</span>
                  <strong>
                    {selectedDevice.agent_version ||
                      'Unknown'}
                  </strong>
                </div>
              </div>
            )}

            <div className="remote-action-grid">
              <button
                className="remote-action remote-action-primary"
                disabled={!selectedDevice || !!sendingCommand}
                onClick={() => void sendCommand('SYNC')}
                type="button"
              >
                <RefreshCw size={18} aria-hidden="true" />
                <span>
                  <strong>Sync</strong>
                  <small>Request immediate check-in</small>
                </span>
              </button>

              <button
                className="remote-action"
                disabled={!selectedDevice || !!sendingCommand}
                onClick={() => void sendCommand('PING')}
                type="button"
              >
                <Radio size={18} aria-hidden="true" />
                <span>
                  <strong>Ping</strong>
                  <small>Test agent communication</small>
                </span>
              </button>

              <button
                className="remote-action"
                disabled={!selectedDevice || !!sendingCommand}
                onClick={() =>
                  void sendCommand('SHOW_MESSAGE')
                }
                type="button"
              >
                <MessageSquare
                  size={18}
                  aria-hidden="true"
                />
                <span>
                  <strong>Send message</strong>
                  <small>Display an agent notification</small>
                </span>
              </button>

              <button
                className="remote-action remote-action-danger"
                disabled={!selectedDevice || !!sendingCommand}
                onClick={() =>
                  void sendCommand('LOCK_DEVICE')
                }
                type="button"
              >
                <Lock size={18} aria-hidden="true" />
                <span>
                  <strong>Lock device</strong>
                  <small>Queue a secure lock command</small>
                </span>
              </button>
            </div>
          </article>

          <article className="dashboard-panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="eyebrow">COMMAND HEALTH</p>
                <h2>Delivery summary</h2>
              </div>
            </header>

            <div className="command-summary-list">
              <div>
                <CheckCircle2
                  className="summary-success"
                  size={19}
                  aria-hidden="true"
                />
                <span>Completed</span>
                <strong>{commandStats.completed}</strong>
              </div>

              <div>
                <Clock3
                  className="summary-active"
                  size={19}
                  aria-hidden="true"
                />
                <span>In progress</span>
                <strong>{commandStats.active}</strong>
              </div>

              <div>
                <XCircle
                  className="summary-failed"
                  size={19}
                  aria-hidden="true"
                />
                <span>Failed</span>
                <strong>{commandStats.failed}</strong>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </>
  )
}