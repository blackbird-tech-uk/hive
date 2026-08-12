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
  getDeviceCommands,
  getDeviceLocationHistory,
  type Device,
  type DeviceCommand,
  type DeviceLocation,
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

function getCommandActivityTime(
  command: DeviceCommand,
): string {
  return (
    command.completed_at ??
    command.acknowledged_at ??
    command.sent_at ??
    command.created_at
  )
}

export function DeviceDashboardPage() {
const [activeTab, setActiveTab] =
  useState<'overview' | 'activity'>(
    'overview',
  )

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

  const [messageComposerOpen, setMessageComposerOpen] =
    useState(false)

  const [messageTitle, setMessageTitle] =
    useState('Hive message')

  const [messageBody, setMessageBody] =
    useState('')

  const [commands, setCommands] =
  useState<DeviceCommand[]>([])

const [commandsLoading, setCommandsLoading] =
  useState(false)

const [commandsError, setCommandsError] =
  useState<string | null>(null)  

    const [location, setLocation] =
  useState<DeviceLocation | null>(null)

const [locationLoading, setLocationLoading] =
  useState(false)

const [locationError, setLocationError] =
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
  const loadCommands = useCallback(
  async (showLoader = false) => {
    if (!deviceId) {
      return
    }

    const startedAt = Date.now()

    if (showLoader) {
      setCommandsLoading(true)
    }

    try {
      const loadedCommands =
        await getDeviceCommands(deviceId)

      setCommands(loadedCommands)
      setCommandsError(null)
    } catch (loadError) {
      setCommandsError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load device activity.',
      )
    } finally {
      if (showLoader) {
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(
          0,
          500 - elapsed,
        )

        window.setTimeout(() => {
          setCommandsLoading(false)
        }, remaining)
      }
    }
  },
  [deviceId],
)

const loadLocation = useCallback(
  async (showLoader = false) => {
    if (!deviceId) {
      return
    }

    if (showLoader) {
      setLocationLoading(true)
    }

    try {
      const locations =
        await getDeviceLocationHistory(
          deviceId,
          1,
        )

      setLocation(locations[0] ?? null)
      setLocationError(null)
    } catch (loadError) {
      setLocation(null)

      setLocationError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load device location.',
      )
    } finally {
      setLocationLoading(false)
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

      const createdCommand =
        await createDeviceCommand(deviceId, {
          command,
          payload,
        })

      setCommands((currentCommands) => [
        createdCommand,
        ...currentCommands.filter(
          (existingCommand) =>
            existingCommand.id !==
            createdCommand.id,
        ),
      ])

      if (command === 'REQUEST_LOCATION') {
        window.setTimeout(() => {
          void loadLocation()
        }, 2_000)
      }

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
  [deviceId, loadLocation],
)

  const handleSendMessage = useCallback(
    async () => {
      const cleanMessage = messageBody.trim()

      if (!cleanMessage) {
        setCommandNotice(null)
        setCommandError(
          'Enter a message before sending.',
        )
        return
      }

      await sendCommand(
        'SHOW_MESSAGE',
        {
          title:
            messageTitle.trim() ||
            'Hive message',
          message: cleanMessage,
        },
      )

      setMessageComposerOpen(false)
      setMessageBody('')
    },
    [
      messageBody,
      messageTitle,
      sendCommand,
    ],
  )

  const handleRefreshApps = useCallback(
    async () => {
      await sendCommand('REFRESH_APPS')
    },
    [sendCommand],
  )

useEffect(() => {
  void loadDevice()
  void loadLocation(true)
  void loadCommands(true)
}, [
  loadCommands,
  loadDevice,
  loadLocation,
])

useEffect(() => {
  const commandPoll = window.setInterval(
    () => {
      void loadCommands()
    },
    5_000,
  )

  return () => {
    window.clearInterval(commandPoll)
  }
}, [loadCommands])

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
                â€¢
              </span>

              <span>
                {device.model ??
                  'Unknown model'}
              </span>

              {device.hive_id ? (
                <>
                  <span aria-hidden="true">
                    â€¢
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
            disabled={sendingCommand !== null}
            onClick={() => {
              setCommandError(null)
              setCommandNotice(null)
              setMessageComposerOpen(true)
            }}
            type="button"
          >
            <MessageSquare
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'SHOW_MESSAGE'
                  ? 'Queuing...'
                  : 'Message'}
              </strong>

              <small>
                Display a device message
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() =>
              void handleRefreshApps()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'REFRESH_APPS'
                  ? 'Queuing...'
                  : 'Refresh apps'}
              </strong>

              <small>
                Request installed app inventory
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
              <strong>Refresh telemetry</strong>

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

      {messageComposerOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMessageComposerOpen(false)
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="device-message-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">
                  REMOTE MESSAGE
                </p>

                <h2 id="device-message-title">
                  Send message to device
                </h2>
              </div>

              <button
                aria-label="Close message composer"
                className="modal-close-button"
                disabled={
                  sendingCommand ===
                  'SHOW_MESSAGE'
                }
                onClick={() =>
                  setMessageComposerOpen(false)
                }
                type="button"
              >
                Ã—
              </button>
            </header>

            <div className="event-form">
              <label>
                Title

                <input
                  disabled={
                    sendingCommand ===
                    'SHOW_MESSAGE'
                  }
                  maxLength={120}
                  onChange={(event) =>
                    setMessageTitle(
                      event.target.value,
                    )
                  }
                  placeholder="Hive message"
                  type="text"
                  value={messageTitle}
                />
              </label>

              <label>
                Message

                <textarea
                  autoFocus
                  disabled={
                    sendingCommand ===
                    'SHOW_MESSAGE'
                  }
                  maxLength={1000}
                  onChange={(event) =>
                    setMessageBody(
                      event.target.value,
                    )
                  }
                  placeholder="Enter the message to display on the device..."
                  rows={5}
                  value={messageBody}
                />
              </label>
            </div>

            <footer className="modal-actions">
              <button
                className="secondary-button"
                disabled={
                  sendingCommand ===
                  'SHOW_MESSAGE'
                }
                onClick={() =>
                  setMessageComposerOpen(false)
                }
                type="button"
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={
                  sendingCommand !== null ||
                  !messageBody.trim()
                }
                onClick={() =>
                  void handleSendMessage()
                }
                type="button"
              >
                {sendingCommand ===
                'SHOW_MESSAGE'
                  ? 'Sending...'
                  : 'Send message'}
              </button>
            </footer>
          </section>
        </div>
      )}

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
          className={
            activeTab === 'overview'
              ? 'device-dashboard-tab device-dashboard-tab-active'
              : 'device-dashboard-tab'
          }
          onClick={() =>
            setActiveTab('overview')
          }
          type="button"
        >
          Overview
        </button>

        <button
          className={
            activeTab === 'activity'
              ? 'device-dashboard-tab device-dashboard-tab-active'
              : 'device-dashboard-tab'
          }
          onClick={() =>
            setActiveTab('activity')
          }
          type="button"
        >
          Activity
        </button>

        <button
          className="device-dashboard-tab"
          disabled
          type="button"
        >
          Commands
        </button>

        <button
          className="device-dashboard-tab"
          disabled
          type="button"
        >
          Location
        </button>

        <button
          className="device-dashboard-tab"
          disabled
          type="button"
        >
          Notes
        </button>
      </nav>

      {activeTab === 'overview' && (
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

            <div className="device-dashboard-location">
  <button
    aria-label="Refresh latest location"
    className="icon-button"
    disabled={locationLoading}
    onClick={() =>
      void loadLocation(true)
    }
    type="button"
  >
<RefreshCw
  aria-hidden="true"
  size={18}
  className={
    locationLoading ? "spin" : ""
  }
/>
  </button>

  {locationLoading ? (
    <p className="device-dashboard-location-message">
      Loading location...
    </p>
  ) : locationError ? (
    <p className="device-dashboard-location-error">
      {locationError}
    </p>
  ) : location ? (
    <>
      <div className="device-dashboard-location-grid">
        <div>
          <span>Latitude</span>
          <strong>
            {location.latitude.toFixed(6)}
          </strong>
        </div>

        <div>
          <span>Longitude</span>
          <strong>
            {location.longitude.toFixed(6)}
          </strong>
        </div>

        <div>
          <span>Accuracy</span>
          <strong>
  {location.accuracy == null ||
  Number.isNaN(location.accuracy)
    ? 'Not reported'
    : `${Math.round(location.accuracy)} m`}
</strong>
        </div>

        <div>
          <span>Recorded</span>
          <strong>
            {formatDateTime(
              location.recorded_at,
            )}
          </strong>
        </div>
      </div>

      <a
        className="device-dashboard-map-link"
        href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
        rel="noreferrer"
        target="_blank"
      >
        <MapPin
          aria-hidden="true"
          size={16}
        />

        Open location in Google Maps
      </a>
    </>
  ) : (
    <p className="device-dashboard-location-message">
      No location has been reported yet.
    </p>
  )}
</div>
          </section>
                </aside>
        </div>
      )}

      {activeTab === 'activity' && (
          <section className="device-dashboard-panel">
  <div className="device-dashboard-panel-header">
    <div>
      <p className="eyebrow">
        DEVICE ACTIVITY
      </p>

      <h2>Recent activity</h2>
    </div>

    <button
      aria-label="Refresh device activity"
      className="icon-button"
      disabled={commandsLoading}
      onClick={() =>
        void loadCommands(true)
      }
      type="button"
    >
      <RefreshCw
  aria-hidden="true"
  size={17}
  className={
    commandsLoading ? "spin" : ""
  }
/>
      
    </button>
  </div>

  {commandsLoading && commands.length === 0 ? (
    <div className="device-dashboard-empty">
      <p>Loading device activity...</p>
    </div>
  ) : commandsError ? (
    <p
      className="device-dashboard-command-error"
      role="alert"
    >
      {commandsError}
    </p>
  ) : commands.length === 0 ? (
    <div className="device-dashboard-empty">
      <p>
        No command activity has been recorded
        for this device.
      </p>
    </div>
  ) : (
    <ol className="device-activity-timeline">
      {commands.slice(0, 12).map(
        (command) => {
          const activityTime =
            getCommandActivityTime(command)

          return (
            <li
              className="device-activity-item"
              key={command.id}
            >
              <span
                aria-hidden="true"
                className={`device-activity-marker device-activity-marker-${command.status.toLowerCase()}`}
              />

              <div className="device-activity-content">
                <div className="device-activity-heading">
                  <strong>
                    {formatCommandName(
                      command.command,
                    )}
                  </strong>

                  <span
                    className={`device-activity-status device-activity-status-${command.status.toLowerCase()}`}
                  >
                    {formatCommandName(
                      command.status,
                    )}
                  </span>
                </div>

                <p>
                  {command.result_message ??
                    'Command submitted to the Android agent.'}
                </p>

                <time dateTime={activityTime}>
                  {formatRelativeTime(
                    activityTime,
                  )}
                  {' Â· '}
                  {formatDateTime(
                    activityTime,
                  )}
                </time>
              </div>
            </li>
          )
        },
      )}
    </ol>
  )}
</section>
      )}
    </section>
  )
}
