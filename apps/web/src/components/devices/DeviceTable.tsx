import {
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  CircleOff,
  Radio,
  Wifi,
} from 'lucide-react'

import type { Device } from '../../lib/api'
import './device-mobile.css'
import { StatusBadge } from './StatusBadge'

const ONLINE_THRESHOLD_MS = 20 * 60 * 1_000

interface DeviceTableProps {
  devices: Device[]
  onSelectDevice: (device: Device) => void
  selectedDeviceIds?: Set<string>
  onToggleDevice?: (deviceId: string) => void
  onToggleAll?: () => void
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function isDeviceOnline(device: Device): boolean {
  if (!device.last_seen_at) return false
  const lastSeenTime = new Date(device.last_seen_at).getTime()
  if (Number.isNaN(lastSeenTime)) return false
  return Date.now() - lastSeenTime <= ONLINE_THRESHOLD_MS
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Never'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown'
  const differenceSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000))
  if (differenceSeconds < 10) return 'Just now'
  if (differenceSeconds < 60) return `${differenceSeconds}s ago`
  const differenceMinutes = Math.floor(differenceSeconds / 60)
  if (differenceMinutes < 60) return `${differenceMinutes}m ago`
  const differenceHours = Math.floor(differenceMinutes / 60)
  if (differenceHours < 24) return `${differenceHours}h ago`
  return `${Math.floor(differenceHours / 24)}d ago`
}

function BatteryIcon({ level, isCharging }: { level: number | null; isCharging: boolean | null }) {
  if (isCharging) return <BatteryCharging size={17} aria-hidden="true" />
  if (level === null) return <BatteryMedium size={17} aria-hidden="true" />
  if (level <= 20) return <BatteryLow size={17} aria-hidden="true" />
  if (level >= 80) return <BatteryFull size={17} aria-hidden="true" />
  return <BatteryMedium size={17} aria-hidden="true" />
}

export function DeviceTable({
  devices,
  onSelectDevice,
  selectedDeviceIds,
  onToggleDevice,
  onToggleAll,
}: DeviceTableProps) {
  const selectable = Boolean(selectedDeviceIds && onToggleDevice)
  const allSelected = selectable && devices.length > 0 && devices.every((device) => selectedDeviceIds!.has(device.id))

  return (
    <div className="device-table-wrapper">
      <div className="mobile-device-list" aria-label="Scanners">
        {selectable && devices.length > 0 && (
          <button
            type="button"
            className="mobile-device-select-all"
            aria-pressed={allSelected}
            onClick={() => onToggleAll?.()}
          >
            {allSelected ? 'Deselect all visible scanners' : `Select all ${devices.length} visible scanners`}
          </button>
        )}
        {devices.map((device) => {
          const online = isDeviceOnline(device)
          const selected = selectedDeviceIds?.has(device.id) ?? false
          return (
            <article className="mobile-device-card" key={device.id}>
              <div className="mobile-device-card-header">
                {selectable && <input type="checkbox" aria-label={`Select ${device.hive_id}`} checked={selected} onChange={() => onToggleDevice?.(device.id)} />}
                <div className="mobile-device-identity">
                  <strong>{device.hive_id}</strong>
                  <span>{device.asset_id || device.serial_number || 'No asset recorded'} · {device.model ?? 'Unknown model'}</span>
                </div>
                <span className={`connection-status ${online ? 'connection-status-online' : 'connection-status-offline'}`}>{online ? 'Online' : 'Offline'}</span>
              </div>
              <div className="mobile-device-metrics">
                <div><small>IP address</small><strong>{device.ip_address ?? 'Not reported'}</strong></div>
                <div><small>Status</small><strong>{formatLabel(device.status)}</strong></div>
                <div><small>Battery</small><strong>{device.battery_level === null ? 'Unknown' : `${device.battery_level}%`}{device.is_charging ? ' · Charging' : ''}</strong></div>
                <div><small>Wi-Fi</small><strong>{device.wifi_ssid ?? 'Unknown'}</strong></div>
                <div><small>Last seen</small><strong>{formatLastSeen(device.last_seen_at)}</strong></div>
                <div><small>Condition</small><strong>{formatLabel(device.condition)}</strong></div>
              </div>
              <button type="button" className="mobile-device-open" onClick={() => onSelectDevice(device)}>View scanner details</button>
            </article>
          )
        })}
      </div>
      <table className="device-table">
        <thead>
          <tr>
            {selectable && (
              <th className="device-selection-cell">
                <input
                  aria-label="Select all visible devices"
                  checked={allSelected}
                  onChange={() => onToggleAll?.()}
                  type="checkbox"
                />
              </th>
            )}
            <th>Device</th><th>Connection</th><th>Battery</th><th>Network</th><th>IP address</th><th>Last seen</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const online = isDeviceOnline(device)
            const selected = selectedDeviceIds?.has(device.id) ?? false
            return (
              <tr
                className={`device-table-row${selected ? ' device-table-row--selected' : ''}`}
                key={device.id}
                onClick={() => onSelectDevice(device)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectDevice(device)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {selectable && (
                  <td className="device-selection-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`Select ${device.hive_id}`}
                      checked={selected}
                      onChange={() => onToggleDevice?.(device.id)}
                      type="checkbox"
                    />
                  </td>
                )}
                <td><div className="device-identity"><div className="device-icon"><Radio size={17} aria-hidden="true" /></div><div><strong>{device.hive_id}</strong><span>{device.asset_id || device.serial_number || 'No asset recorded'}</span><small>{device.model ?? 'Unknown model'}</small></div></div></td>
                <td><span className={`connection-status ${online ? 'connection-status-online' : 'connection-status-offline'}`}>{online ? <Radio size={15} aria-hidden="true" /> : <CircleOff size={15} aria-hidden="true" />}{online ? 'Online' : 'Offline'}</span></td>
                <td><div className="device-battery"><BatteryIcon level={device.battery_level} isCharging={device.is_charging} /><span>{device.battery_level !== null ? `${device.battery_level}%` : 'Unknown'}</span>{device.is_charging && <small>Charging</small>}</div></td>
                <td><div className="device-network"><Wifi size={16} aria-hidden="true" /><span>{device.wifi_ssid ?? 'Unknown network'}</span></div></td>
                <td><code>{device.ip_address ?? 'Not reported'}</code></td>
                <td><div className="device-last-seen"><strong>{formatLastSeen(device.last_seen_at)}</strong><span>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('en-GB') : 'No heartbeat received'}</span></div></td>
                <td><StatusBadge status={device.status} /><span className="badge subtle-badge">{formatLabel(device.condition)}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}