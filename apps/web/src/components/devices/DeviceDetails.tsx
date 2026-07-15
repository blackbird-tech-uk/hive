import { X } from 'lucide-react'

import type { Device } from '../../lib/api'
import { StatusBadge } from './StatusBadge'

interface DeviceDetailsProps {
  device: Device
  onClose: () => void
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
}: DeviceDetailsProps) {
  return (
    <aside className="device-details-panel" aria-label="Device details">
      <header className="device-details-header">
        <div>
          <p className="eyebrow">DEVICE PROFILE</p>
          <h3>{device.hive_id}</h3>
          <p>{device.model}</p>
        </div>

        <button
          aria-label="Close device details"
          className="icon-button"
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
          <dd>{device.asset_id}</dd>
        </div>

        <div>
          <dt>Serial number</dt>
          <dd>{device.serial_number}</dd>
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
          <dd>{device.notes ?? 'No notes added'}</dd>
        </div>
      </dl>
    </aside>
  )
}