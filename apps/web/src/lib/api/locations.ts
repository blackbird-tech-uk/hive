import { api } from './client'

import type {
  DeviceLocation,
} from './types'

export async function getDeviceLocationHistory(
  deviceId: string,
  limit = 1,
): Promise<DeviceLocation[]> {
  return api.get<DeviceLocation[]>(
    `/device-locations/history/${deviceId}?limit=${limit}`,
  )
}
export async function getLatestDeviceLocations(): Promise<DeviceLocation[]> {
  return api.get<DeviceLocation[]>('/device-locations/latest')
}
