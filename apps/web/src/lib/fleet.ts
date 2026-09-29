import type { Device } from './api'

export const DEVICE_ONLINE_THRESHOLD_MS = 20 * 60 * 1_000
export const LOW_BATTERY_THRESHOLD = 20

export type FleetFilter = 'all' | 'online' | 'offline' | 'low_battery' | 'attention'

export function normaliseSearchValue(value: string | null | undefined): string {
  return value?.toLowerCase().trim() ?? ''
}

export function isDeviceOnline(device: Device, currentTime: number): boolean {
  if (!device.last_seen_at) return false
  const lastSeenTime = new Date(device.last_seen_at).getTime()
  return !Number.isNaN(lastSeenTime) && currentTime - lastSeenTime <= DEVICE_ONLINE_THRESHOLD_MS
}

export function isLowBattery(device: Device): boolean {
  return device.battery_level !== null
    && device.battery_level !== undefined
    && device.battery_level <= LOW_BATTERY_THRESHOLD
    && device.is_charging !== true
}

export function needsAttention(device: Device, currentTime: number): boolean {
  return !isDeviceOnline(device, currentTime)
    || isLowBattery(device)
    || device.condition.toLowerCase() !== 'good'
}

export function matchesFleetFilter(device: Device, filter: FleetFilter, currentTime: number): boolean {
  const online = isDeviceOnline(device, currentTime)
  if (filter === 'online') return online
  if (filter === 'offline') return !online
  if (filter === 'low_battery') return isLowBattery(device)
  if (filter === 'attention') return needsAttention(device, currentTime)
  return true
}

export function matchesDeviceSearch(device: Device, searchQuery: string, currentTime: number): boolean {
  const query = normaliseSearchValue(searchQuery)
  if (!query) return true
  const online = isDeviceOnline(device, currentTime)
  return [
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
    online ? 'online' : 'offline',
  ].some((value) => normaliseSearchValue(value).includes(query))
}
