const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export type DeviceStatus =
  | 'available'
  | 'assigned'
  | 'in_use'
  | 'repair'
  | 'retired'

export type DeviceCondition =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'

export interface Device {
  id: string
  hive_id: string
  asset_id: string
  serial_number: string
  imei: string | null
  model: string
  android_version: string | null
  build_version: string | null
  status: DeviceStatus
  condition: DeviceCondition
  notes: string | null
  created_at: string
  updated_at: string
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`Hive API request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health')
}

export function getDevices(): Promise<Device[]> {
  return request<Device[]>('/devices')
}