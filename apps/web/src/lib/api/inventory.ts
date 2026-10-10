import { api } from './client'
import { getOrganizationId } from './session'

import type {
  InstalledApplication,
} from './types'

export async function getDeviceApplications(
  deviceId: string,
): Promise<InstalledApplication[]> {
  const organizationId = getOrganizationId()

  return api.get<InstalledApplication[]>(
    `/organizations/${organizationId}/devices/${deviceId}/apps`,
  )
}
