import {
  clearAuthSession,
  getAccessToken,
} from './session'

import type { ApiErrorBody } from './types'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000/api/v1'

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body =
      (await response.json()) as ApiErrorBody

    return body.detail ?? fallback
  } catch {
    return fallback
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type')) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  try {
    const token = getAccessToken()

    headers.set(
      'Authorization',
      `Bearer ${token}`,
    )
  } catch {
    // Public endpoints don't require auth
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
  )

  if (response.status === 401) {
    clearAuthSession()

    window.dispatchEvent(
      new Event('hive-auth-expired'),
    )
  }

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Request failed (${response.status})`,
      ),
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  get<T>(path: string) {
    return request<T>(path)
  },

  post<T>(
    path: string,
    body?: unknown,
  ) {
    return request<T>(path, {
      method: 'POST',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    })
  },

  patch<T>(
    path: string,
    body?: unknown,
  ) {
    return request<T>(path, {
      method: 'PATCH',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    })
  },

  put<T>(
    path: string,
    body?: unknown,
  ) {
    return request<T>(path, {
      method: 'PUT',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    })
  },

  delete<T>(path: string) {
    return request<T>(path, {
      method: 'DELETE',
    })
  },
}