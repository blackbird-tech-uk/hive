import { api } from './client'
import { getOrganizationId } from './session'

import type {
  CreateEnrollmentTokenPayload,
  EnrollmentTokenCreatedResponse,
  EnrollmentTokenResponse,
} from './types'

export async function createEnrollmentToken(
  payload: CreateEnrollmentTokenPayload,
): Promise<EnrollmentTokenCreatedResponse> {
  const organizationId =
    getOrganizationId()

  return api.post<EnrollmentTokenCreatedResponse>(
    `/organizations/${organizationId}/enrollment-tokens`,
    {
      label: payload.label ?? null,
      expires_in_hours:
        payload.expires_in_hours ?? 24,
      max_uses: payload.max_uses ?? 1,
    },
  )
}

export async function getEnrollmentTokens(): Promise<
  EnrollmentTokenResponse[]
> {
  const organizationId =
    getOrganizationId()

  return api.get<EnrollmentTokenResponse[]>(
    `/organizations/${organizationId}/enrollment-tokens`,
  )
}

export async function revokeEnrollmentToken(
  tokenId: string,
): Promise<EnrollmentTokenResponse> {
  const organizationId =
    getOrganizationId()

  return api.post<EnrollmentTokenResponse>(
    `/organizations/${organizationId}/enrollment-tokens/${tokenId}/revoke`,
  )
}