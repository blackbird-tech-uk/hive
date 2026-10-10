import { api } from './client'

import {
  clearAuthSession,
  saveAuthSession,
} from './session'

import type {
  AuthenticatedUser,
  TokenResponse,
} from './types'

export async function loginUser(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const response =
    await api.post<TokenResponse>(
      '/auth/login',
      {
        username,
        password,
      },
    )

  saveAuthSession({
    accessToken: response.access_token,
    organizationId: null,
  })

  return response
}

export async function logoutUser(): Promise<void> {
  clearAuthSession()
}

export function setActiveOrganization(
  organizationId: string,
): void {
  const session = {
    accessToken:
      localStorage.getItem(
        'hive_access_token',
      ),
    organizationId,
  }

  saveAuthSession(session)
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return api.get<AuthenticatedUser>(
    '/auth/me',
  )
}