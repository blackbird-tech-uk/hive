import { Radio } from 'lucide-react'

import type { Device } from '../../lib/api'
import { StatusBadge } from './StatusBadge'

interface DeviceTableProps {
  devices: Device[]
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function DeviceTable({ devices }: DeviceTableProps) {
  return (
    <div className="device-table-wrapper">
      <table className="device-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Asset</th>
            <th>Model</th>
            <th>Status</th>
            <th>Condition</th>
            <th>Android</th>
          </tr>
        </thead>

        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>
                <div className="device-identity">
                  <div className="device-icon">
                    <Radio size={17} aria-hidden="true" />
                  </div>

                  <div>
                    <strong>{device.hive_id}</strong>
                    <span>{device.serial_number}</span>
                  </div>
                </div>
              </td>

              <td>{device.asset_id}</td>
              <td>{device.model}</td>

              <td>
                <StatusBadge status={device.status} />
              </td>

              <td>
                <span className="badge subtle-badge">
                  {formatLabel(device.condition)}
                </span>
              </td>

              <td>{device.android_version ?? 'Unknown'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}