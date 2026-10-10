import type { AuthSession } from './types'

export const ACCESS_TOKEN_KEY = 'hive_access_token'
export const ORGANIZATION_ID_KEY =
  'hive_active_organization_id'

export function restoreAuthSession(): AuthSession {
  return {
    accessToken: localStorage.getItem(
      ACCESS_TOKEN_KEY,
    ),
    organizationId: localStorage.getItem(
      ORGANIZATION_ID_KEY,
    ),
  }
}

export function saveAuthSession(
  session: AuthSession,
): void {
  if (session.accessToken) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      session.accessToken,
    )
  } else {
    localStorage.removeItem(
      ACCESS_TOKEN_KEY,
    )
  }

  if (session.organizationId) {
    localStorage.setItem(
      ORGANIZATION_ID_KEY,
      session.organizationId,
    )
  } else {
    localStorage.removeItem(
      ORGANIZATION_ID_KEY,
    )
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  )

  localStorage.removeItem(
    ORGANIZATION_ID_KEY,
  )
}

export function getAccessToken(): string {
  const token = localStorage.getItem(
    ACCESS_TOKEN_KEY,
  )

  if (!token) {
    throw new Error(
      'You are not authenticated.',
    )
  }

  return token
}

export function getOrganizationId(): string {
  const organizationId =
    localStorage.getItem(
      ORGANIZATION_ID_KEY,
    )

  if (!organizationId) {
    throw new Error(
      'No active organisation selected.'
    )
  }

  return organizationId
}