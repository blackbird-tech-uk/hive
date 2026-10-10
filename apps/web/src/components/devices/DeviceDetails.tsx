import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  BatteryCharging,
  Bell,
  Clock3,
  History,
  MapPin,
  MessageSquare,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react'

import {
  createDeviceCommand,
  getDeviceCommands,
  getDeviceLocationHistory,
  updateDevice,
  type Device,
  type DeviceCommand,
  type DeviceLocation,
  type UpdateDevicePayload,
} from '../../lib/api'
import { StatusBadge } from './StatusBadge'

interface DeviceDetailsProps {
  device: Device
  onClose: () => void
  onUpdated: (device: Device) => void
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(' ')
}

function formatCommandName(value: string): string {
  return formatLabel(value)
}

function formatCommandTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not available'
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return 'Unknown'
  }

  return timestamp.toLocaleString('en-GB')
}
function formatRelativeTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Never reported'
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return 'Unknown'
  }

  const differenceSeconds = Math.floor(
    (Date.now() - timestamp.getTime()) / 1000,
  )

  if (differenceSeconds < 10) {
    return 'Just now'
  }

  if (differenceSeconds < 60) {
    return `${differenceSeconds} seconds ago`
  }

  const differenceMinutes = Math.floor(
    differenceSeconds / 60,
  )

  if (differenceMinutes < 60) {
    return `${differenceMinutes} ${
      differenceMinutes === 1 ? 'minute' : 'minutes'
    } ago`
  }

  const differenceHours = Math.floor(
    differenceMinutes / 60,
  )

  if (differenceHours < 24) {
    return `${differenceHours} ${
      differenceHours === 1 ? 'hour' : 'hours'
    } ago`
  }

  const differenceDays = Math.floor(
    differenceHours / 24,
  )

  return `${differenceDays} ${
    differenceDays === 1 ? 'day' : 'days'
  } ago`
}

function getCommandStatusClass(
  status: string,
): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'command-status-completed'

    case 'failed':
      return 'command-status-failed'

    case 'acknowledged':
      return 'command-status-acknowledged'

    case 'sent':
      return 'command-status-sent'

    default:
      return 'command-status-pending'
  }
}

export function DeviceDetails({
  device,
  onClose,
  onUpdated,
}: DeviceDetailsProps) {
  const [isEditing, setIsEditing] =
    useState(false)

  const [notes, setNotes] = useState(
    device.notes ?? '',
  )

  const [isSaving, setIsSaving] =
    useState(false)

  const [error, setError] = useState<
    string | null
  >(null)

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  const [commands, setCommands] = useState<
    DeviceCommand[]
  >([])

  const [commandsLoading, setCommandsLoading] =
    useState(false)

  const [location, setLocation] =
    useState<DeviceLocation | null>(null)

  const [locationLoading, setLocationLoading] =
    useState(false)

  const [sendingCommand, setSendingCommand] =
    useState<string | null>(null)

  const [showMessageForm, setShowMessageForm] =
    useState(false)

  const [deviceMessage, setDeviceMessage] =
    useState('')

  const loadLocation = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLocationLoading(true)
      }

      try {
        const locations =
          await getDeviceLocationHistory(
            device.id,
            1,
          )

        setLocation(locations[0] ?? null)
      } catch {
        setLocation(null)
      } finally {
        setLocationLoading(false)
      }
    },
    [device.id],
  )

  const loadCommands = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setCommandsLoading(true)
      }

      try {
        const response =
          await getDeviceCommands(device.id)

        setCommands(response)
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : 'Unable to load command history.',
        )
      } finally {
        setCommandsLoading(false)
      }
    },
    [device.id],
  )

  useEffect(() => {
    setNotes(device.notes ?? '')
    setIsEditing(false)
    setError(null)
    setSuccessMessage(null)
    setShowMessageForm(false)
    setDeviceMessage('')

    void loadCommands(true)
    void loadLocation(true)
  }, [device, loadCommands, loadLocation])

  useEffect(() => {
    const commandPoll = window.setInterval(
      () => {
        void loadCommands()
        void loadLocation()
      },
      5_000,
    )

    return () => {
      window.clearInterval(commandPoll)
    }
  }, [loadCommands, loadLocation])

  function startEditing() {
    setNotes(device.notes ?? '')
    setError(null)
    setSuccessMessage(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setNotes(device.notes ?? '')
    setError(null)
    setIsEditing(false)
  }

  async function saveChanges() {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    const payload: UpdateDevicePayload = {
      notes: notes.trim() || null,
    }

    try {
      const updatedDevice =
        await updateDevice(
          device.id,
          payload,
        )

      onUpdated(updatedDevice)
      setIsEditing(false)
      setSuccessMessage(
        'Device notes updated successfully.',
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update device.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function sendCommand(
    command: string,
    payload: Record<string, unknown> = {},
  ) {
    setSendingCommand(command)
    setError(null)
    setSuccessMessage(null)

    try {
      const createdCommand =
        await createDeviceCommand(
          device.id,
          {
            command,
            payload,
          },
        )

      setCommands((currentCommands) => [
        createdCommand,
        ...currentCommands.filter(
          (existingCommand) =>
            existingCommand.id !==
            createdCommand.id,
        ),
      ])

      setSuccessMessage(
        `${formatCommandName(command)} command queued successfully.`,
      )

      return true
    } catch (commandError) {
      setError(
        commandError instanceof Error
          ? commandError.message
          : `Unable to send ${formatCommandName(
              command,
            )} command.`,
      )

      return false
    } finally {
      setSendingCommand(null)
    }
  }

  async function handleSyncDevice() {
    await sendCommand('SYNC')
  }

  async function handleRingDevice() {
    await sendCommand('RING')
  }

  async function handleRequestLocation() {
    const commandSent =
      await sendCommand('REQUEST_LOCATION')

    if (commandSent) {
      window.setTimeout(() => {
        void loadLocation()
      }, 2_000)
    }
  }

  async function handleShowMessage() {
    const message = deviceMessage.trim()

    if (!message) {
      setError(
        'Enter a message before sending.',
      )

      return
    }

    const commandSent = await sendCommand(
      'SHOW_MESSAGE',
      {
        message,
      },
    )

    if (commandSent) {
      setDeviceMessage('')
      setShowMessageForm(false)
    }
  }

  return (
    <aside
      aria-label="Device details"
      className="device-details-panel"
    >
      <header className="device-details-header">
        <div>
          <p className="eyebrow">
            DEVICE PROFILE
          </p>

          <h3>{device.hive_id}</h3>

          <p>
            {device.model ?? 'Unknown model'}
          </p>
        </div>

        <button
          aria-label="Close device details"
          className="icon-button"
          disabled={
            isSaving ||
            sendingCommand !== null
          }
          onClick={onClose}
          type="button"
        >
          <X
            size={18}
            aria-hidden="true"
          />
        </button>
      </header>

      <div className="device-details-status">
  <StatusBadge status={device.status} />

  <span className="badge subtle-badge">
    {formatLabel(device.condition)}
  </span>
</div>

<Link
  className="device-details-dashboard-link"
  to={`/devices/${device.id}`}
>
  Open full device dashboard
</Link>

<section
  aria-label="Device status summary"
  className="device-summary-grid"
>
  <article className="device-summary-card">
    <span className="device-summary-icon">
      <BatteryCharging
        aria-hidden="true"
        size={20}
      />
    </span>

    <div className="device-summary-content">
      <span>Battery</span>

      <strong>
        {device.battery_level !== null
          ? `${device.battery_level}%`
          : 'Unknown'}
      </strong>

      <small>
        {device.is_charging === null
          ? 'Charging state unknown'
          : device.is_charging
            ? 'Currently charging'
            : 'Not charging'}
      </small>
    </div>
  </article>

  <article className="device-summary-card">
    <span className="device-summary-icon">
      <Wifi
        aria-hidden="true"
        size={20}
      />
    </span>

    <div className="device-summary-content">
      <span>Connectivity</span>

      <strong>
        {device.wifi_ssid ?? 'Not connected'}
      </strong>

      <small>
        {device.ip_address ?? 'No IP reported'}
      </small>
    </div>
  </article>

  <article className="device-summary-card">
    <span className="device-summary-icon">
      <Smartphone
        aria-hidden="true"
        size={20}
      />
    </span>

    <div className="device-summary-content">
      <span>Platform</span>

      <strong>
        Android {device.android_version ?? 'Unknown'}
      </strong>

      <small>
        Agent {device.agent_version ?? 'Unknown'}
      </small>
    </div>
  </article>

  <article className="device-summary-card">
    <span className="device-summary-icon">
      <Clock3
        aria-hidden="true"
        size={20}
      />
    </span>

    <div className="device-summary-content">
      <span>Last heartbeat</span>

      <strong>
        {formatRelativeTime(device.last_seen_at)}
      </strong>

      <small>
        {formatCommandTime(device.last_seen_at)}
      </small>
    </div>
  </article>
</section>

<dl className="device-details-grid">
        <div>
          <dt>Asset ID</dt>
          <dd>
            {device.asset_id ??
              'Not recorded'}
          </dd>
        </div>

        <div>
          <dt>Serial number</dt>
          <dd>
            {device.serial_number ??
              'Not recorded'}
          </dd>
        </div>

        <div>
          <dt>IMEI</dt>
          <dd>
            {device.imei ?? 'Not recorded'}
          </dd>
        </div>

        <div>
          <dt>Android</dt>
          <dd>
            {device.android_version ??
              'Unknown'}
          </dd>
        </div>

        <div>
          <dt>Battery</dt>
          <dd>
            {device.battery_level !== null
              ? `${device.battery_level}%`
              : 'Unknown'}
          </dd>
        </div>

        <div>
          <dt>Charging</dt>
          <dd>
            {device.is_charging === null
              ? 'Unknown'
              : device.is_charging
                ? 'Yes'
                : 'No'}
          </dd>
        </div>

        <div>
          <dt>Wi-Fi</dt>
          <dd>
            {device.wifi_ssid ??
              'Not reported'}
          </dd>
        </div>

        <div>
          <dt>IP address</dt>
          <dd>
            {device.ip_address ??
              'Not reported'}
          </dd>
        </div>

        <div className="device-details-wide">
          <dt>Agent version</dt>
          <dd>
            {device.agent_version ??
              'Not recorded'}
          </dd>
        </div>

        <div className="device-details-wide">
          <dt>Build version</dt>
          <dd>
            {device.build_version ??
              'Not recorded'}
          </dd>
        </div>

        <div className="device-details-wide">
          <dt>Last heartbeat</dt>
          <dd>
            {formatCommandTime(
              device.last_seen_at,
            )}
          </dd>
        </div>

        <div className="device-details-wide">
          <dt>Notes</dt>

          {isEditing ? (
            <textarea
              aria-label="Device notes"
              className="device-notes-input"
              disabled={isSaving}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={5}
              value={notes}
            />
          ) : (
            <dd>
              {device.notes ??
                'No notes added'}
            </dd>
          )}
        </div>
      </dl>

      <section className="device-actions-section">
        <div className="device-section-heading">
          <div>
            <p className="eyebrow">
              REMOTE MANAGEMENT
            </p>

            <h4>Remote actions</h4>
          </div>
        </div>

        <div className="device-action-grid">
          <button
            className="secondary-button"
            disabled={
              sendingCommand !== null
            }
            onClick={() =>
              void handleSyncDevice()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={16}
            />

            {sendingCommand === 'SYNC'
              ? 'Queuing...'
              : 'Sync Device'}
          </button>

          <button
            className="secondary-button"
            disabled={
              sendingCommand !== null
            }
            onClick={() =>
              void handleRingDevice()
            }
            type="button"
          >
            <Bell
              aria-hidden="true"
              size={16}
            />

            {sendingCommand === 'RING'
              ? 'Queuing...'
              : 'Ring Device'}
          </button>

          <button
            className="secondary-button"
            disabled={
              sendingCommand !== null
            }
            onClick={() =>
              void handleRequestLocation()
            }
            type="button"
          >
            <MapPin
              aria-hidden="true"
              size={16}
            />

            {sendingCommand ===
            'REQUEST_LOCATION'
              ? 'Queuing...'
              : 'Request Location'}
          </button>

          <button
            className="secondary-button"
            disabled={
              sendingCommand !== null
            }
            onClick={() => {
              setError(null)
              setSuccessMessage(null)
              setShowMessageForm(
                (currentValue) =>
                  !currentValue,
              )
            }}
            type="button"
          >
            <MessageSquare
              aria-hidden="true"
              size={16}
            />

            Show Message
          </button>
        </div>

        {showMessageForm && (
          <div className="device-message-form">
            <label htmlFor="device-message">
              Message
            </label>

            <textarea
              disabled={
                sendingCommand !== null
              }
              id="device-message"
              maxLength={500}
              onChange={(event) =>
                setDeviceMessage(
                  event.target.value,
                )
              }
              placeholder="Enter the message to display on the device..."
              rows={4}
              value={deviceMessage}
            />

            <div className="device-message-actions">
              <button
                className="secondary-button"
                disabled={
                  sendingCommand !== null
                }
                onClick={() => {
                  setShowMessageForm(false)
                  setDeviceMessage('')
                }}
                type="button"
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={
                  sendingCommand !== null ||
                  !deviceMessage.trim()
                }
                onClick={() =>
                  void handleShowMessage()
                }
                type="button"
              >
                <Send
                  aria-hidden="true"
                  size={16}
                />

                {sendingCommand ===
                'SHOW_MESSAGE'
                  ? 'Sending...'
                  : 'Send Message'}
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          className="form-success"
          role="status"
        >
          {successMessage}
        </p>
      )}


      <section className="device-command-section">
        <div className="device-section-heading">
          <div>
            <p className="eyebrow">
              DEVICE LOCATION
            </p>

            <h4>Latest location</h4>
          </div>

          <button
            aria-label="Refresh device location"
            className="icon-button"
            disabled={locationLoading}
            onClick={() =>
              void loadLocation(true)
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={16}
            />
          </button>
        </div>

        {locationLoading && !location ? (
          <div className="command-history-empty">
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <p>Loading device location...</p>
          </div>
        ) : location ? (
          <dl className="device-details-grid">
            <div>
              <dt>Latitude</dt>
              <dd>
                {location.latitude.toFixed(6)}
              </dd>
            </div>

            <div>
              <dt>Longitude</dt>
              <dd>
                {location.longitude.toFixed(6)}
              </dd>
            </div>

            <div>
              <dt>Accuracy</dt>
              <dd>
                {location.accuracy !== null &&
                location.accuracy !== undefined
                  ? `${location.accuracy.toFixed(1)} m`
                  : 'Not reported'}
              </dd>
            </div>

            <div>
              <dt>Recorded</dt>
              <dd>
                {formatCommandTime(
                  location.recorded_at,
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="command-history-empty">
            <MapPin
              aria-hidden="true"
              size={22}
            />

            <p>
              No location has been reported by
              this device yet.
            </p>
          </div>
        )}
      </section>

      <section className="device-command-section">
        <div className="device-section-heading">
          <div>
            <p className="eyebrow">
              DEVICE ACTIVITY
            </p>

            <h4>Command history</h4>
          </div>

          <button
            aria-label="Refresh command history"
            className="icon-button"
            disabled={commandsLoading}
            onClick={() =>
              void loadCommands(true)
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={16}
            />
          </button>
        </div>

        {commandsLoading &&
        commands.length === 0 ? (
          <div className="command-history-empty">
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <p>
              Loading command history...
            </p>
          </div>
        ) : commands.length === 0 ? (
          <div className="command-history-empty">
            <History
              aria-hidden="true"
              size={22}
            />

            <p>
              No commands have been sent
              to this device.
            </p>
          </div>
        ) : (
          <div className="command-history-list">
            {commands.map((command) => (
              <article
                className="command-history-item"
                key={command.id}
              >
                <div className="command-history-header">
                  <strong>
                    {formatCommandName(
                      command.command,
                    )}
                  </strong>

                  <span
                    className={`command-status ${getCommandStatusClass(
                      command.status,
                    )}`}
                  >
                    {formatLabel(
                      command.status,
                    )}
                  </span>
                </div>

                <p>
                  {command.result_message ??
                    'Waiting for the device to process this command.'}
                </p>

                <time
                  dateTime={
                    command.created_at
                  }
                >
                  {formatCommandTime(
                    command.created_at,
                  )}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="device-details-footer">
        {isEditing ? (
          <>
            <button
              className="secondary-button"
              disabled={isSaving}
              onClick={cancelEditing}
              type="button"
            >
              Cancel
            </button>

            <button
              className="primary-button"
              disabled={isSaving}
              onClick={() =>
                void saveChanges()
              }
              type="button"
            >
              <Save
                size={16}
                aria-hidden="true"
              />

              {isSaving
                ? 'Saving...'
                : 'Save Changes'}
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            disabled={
              sendingCommand !== null
            }
            onClick={startEditing}
            type="button"
          >
            <Pencil
              size={16}
              aria-hidden="true"
            />

            Edit Device
          </button>
        )}
      </footer>
    </aside>
  )
}