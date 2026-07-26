import { useEffect, useState } from 'react'
import { Pencil, Save, X } from 'lucide-react'

import {
  updateDevice,
  type Device,
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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function DeviceDetails({
  device,
  onClose,
  onUpdated,
}: DeviceDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(device.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(device.notes ?? '')
    setIsEditing(false)
    setError(null)
  }, [device])

  function startEditing() {
    setNotes(device.notes ?? '')
    setError(null)
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

    const payload: UpdateDevicePayload = {
      notes: notes.trim() || null,
    }

    try {
      const updatedDevice = await updateDevice(device.id, payload)

      onUpdated(updatedDevice)
      setIsEditing(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update scanner.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <aside
      aria-label="Device details"
      className="device-details-panel"
    >
      <header className="device-details-header">
        <div>
          <p className="eyebrow">DEVICE PROFILE</p>
          <h3>{device.hive_id}</h3>
          <p>{device.model}</p>
        </div>

        <button
          aria-label="Close device details"
          className="icon-button"
          disabled={isSaving}
          onClick={onClose}
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="device-details-status">
        <StatusBadge status={device.status} />

        <span className="badge subtle-badge">
          {formatLabel(device.condition)}
        </span>
      </div>

      <dl className="device-details-grid">
        <div>
          <dt>Asset ID</dt>
          <dd>{device.asset_id ?? 'Not recorded'}</dd>
        </div>

        <div>
          <dt>Serial number</dt>
          <dd>{device.serial_number ?? 'Not recorded'}</dd>
        </div>

        <div>
          <dt>IMEI</dt>
          <dd>{device.imei ?? 'Not recorded'}</dd>
        </div>

        <div>
          <dt>Android</dt>
          <dd>{device.android_version ?? 'Unknown'}</dd>
        </div>

        <div className="device-details-wide">
          <dt>Build version</dt>
          <dd>{device.build_version ?? 'Not recorded'}</dd>
        </div>

        <div className="device-details-wide">
          <dt>Notes</dt>

          {isEditing ? (
            <textarea
              aria-label="Device notes"
              className="device-notes-input"
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              value={notes}
            />
          ) : (
            <dd>{device.notes ?? 'No notes added'}</dd>
          )}
        </div>
      </dl>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

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
              onClick={() => void saveChanges()}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            onClick={startEditing}
            type="button"
          >
            <Pencil size={16} aria-hidden="true" />
            Edit Scanner
          </button>
        )}
      </footer>
    </aside>
  )
}