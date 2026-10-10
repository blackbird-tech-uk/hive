import { api } from './client'
import { getOrganizationId } from './session'

import type {
  DeviceCommand,
  CreateDeviceCommandPayload,
} from './types'

export async function getDeviceCommands(
  deviceId: string,
): Promise<DeviceCommand[]> {
  return api.get<DeviceCommand[]>(
    `/device-commands/devices/${deviceId}`,
  )
}

export async function createDeviceCommand(
  deviceId: string,
  payload: CreateDeviceCommandPayload,
): Promise<DeviceCommand> {
  const organizationId = getOrganizationId()

  return api.post<DeviceCommand>(
    `/device-commands/organizations/${organizationId}/devices/${deviceId}`,
    {
      command: payload.command,
      payload: payload.payload ?? {},
    },
  )
}