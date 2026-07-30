import { api } from './client'
import { getOrganizationId } from './session'

import type {
  Device,
  UpdateDevicePayload,
} from './types'

export async function getDevices(): Promise<Device[]> {
  const organizationId = getOrganizationId()

  return api.get<Device[]>(
    `/organizations/${organizationId}/devices`,
  )
}

export async function getDevice(
  deviceId: string,
): Promise<Device> {
  const organizationId = getOrganizationId()

  return api.get<Device>(
    `/organizations/${organizationId}/devices/${deviceId}`,
  )
}

export async function updateDevice(
  deviceId: string,
  payload: UpdateDevicePayload,
): Promise<Device> {
  const organizationId = getOrganizationId()

  return api.patch<Device>(
    `/organizations/${organizationId}/devices/${deviceId}`,
    payload,
  )
}

export async function deleteDevice(
  deviceId: string,
): Promise<void> {
  const organizationId = getOrganizationId()

  return api.delete<void>(
    `/organizations/${organizationId}/devices/${deviceId}`,
  )
}