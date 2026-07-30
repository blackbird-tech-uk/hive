import { api } from './client'
import { getOrganizationId } from './session'

import type {
  CreateEnrollmentTokenPayload,
  EnrollmentTokenResponse,
} from './types'

export async function createEnrollmentToken(
  payload: CreateEnrollmentTokenPayload,
): Promise<EnrollmentTokenResponse> {
  const organizationId =
    getOrganizationId()

  return api.post<EnrollmentTokenResponse>(
    `/organizations/${organizationId}/enrollment-tokens`,
    {
      label: payload.label ?? null,
      expires_in_hours:
        payload.expires_in_hours ?? 24,
      max_uses: payload.max_uses ?? 1,
    },
  )
}