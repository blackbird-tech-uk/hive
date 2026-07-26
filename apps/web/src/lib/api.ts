const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000/api/v1'

const ACCESS_TOKEN_KEY = 'hive_access_token'
const ORGANIZATION_ID_KEY =
  'hive_active_organization_id'

export type AuthSession = {
  accessToken: string | null
  organizationId: string | null
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type AuthenticatedUser = {
  id: string
  username: string
  display_name?: string | null
  email?: string | null
  job_title?: string | null
  role?: string
  is_active?: boolean
}

export type Organization = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Device = {
  id: string
  organization_id: string
  hive_id: string
  asset_id: string
  serial_number: string
  imei: string | null

  manufacturer: string | null
  model: string | null
  android_version: string | null
  build_version: string | null
  agent_version: string | null

  battery_level: number | null
  is_charging: boolean | null
  wifi_ssid: string | null
  ip_address: string | null

  status: string
  condition: string

  enrolled_at: string | null
  last_seen_at: string | null

  notes: string | null
  created_at: string
  updated_at: string
}

export type UpdateDevicePayload = {
  asset_id?: string
  serial_number?: string
  imei?: string | null
  model?: string
  android_version?: string | null
  build_version?: string | null
  status?: string
  condition?: string
  notes?: string | null
}

export type EventStatus =
  | 'draft'
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived'

export type Event = {
  id: string
  name: string
  venue: string
  start_date: string
  end_date: string
  status: EventStatus | string
  notes: string | null
}

export type CreateEventPayload = {
  name: string
  venue: string
  start_date: string
  end_date: string
  status: EventStatus
  notes?: string
}

type ApiErrorBody = {
  detail?: string
}

export function restoreAuthSession(): AuthSession {
  return {
    accessToken:
      sessionStorage.getItem(ACCESS_TOKEN_KEY),
    organizationId:
      sessionStorage.getItem(ORGANIZATION_ID_KEY),
  }
}

export function saveAuthSession(
  session: AuthSession,
): void {
  if (session.accessToken) {
    sessionStorage.setItem(
      ACCESS_TOKEN_KEY,
      session.accessToken,
    )
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }

  if (session.organizationId) {
    sessionStorage.setItem(
      ORGANIZATION_ID_KEY,
      session.organizationId,
    )
  } else {
    sessionStorage.removeItem(
      ORGANIZATION_ID_KEY,
    )
  }
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(ORGANIZATION_ID_KEY)
}

function getAccessToken(): string {
  const token =
    sessionStorage.getItem(ACCESS_TOKEN_KEY)

  if (!token) {
    throw new Error(
      'You are not authenticated.',
    )
  }

  return token
}

function getOrganizationId(): string {
  const organizationId =
    sessionStorage.getItem(ORGANIZATION_ID_KEY)

  if (!organizationId) {
    throw new Error(
      'No active organisation has been selected.',
    )
  }

  return organizationId
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body =
      (await response.json()) as ApiErrorBody

    return body.detail || fallback
  } catch {
    return fallback
  }
}

async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken()

  const headers = new Headers(options.headers)

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  )

  if (
    options.body &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    )
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

  return response
}

export async function loginUser(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const response = await fetch(
    `${API_BASE_URL}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        'Unable to sign in.',
      ),
    )
  }

  return response.json()
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const response =
    await authenticatedFetch('/auth/me')

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        'Unable to load your account.',
      ),
    )
  }

  return response.json()
}

export async function getOrganizations(): Promise<
  Organization[]
> {
  const response =
    await authenticatedFetch('/organizations')

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        'Unable to load organisations.',
      ),
    )
  }

  return response.json()
}

export async function getDevices(): Promise<
  Device[]
> {
  const organizationId = getOrganizationId()

  const response = await authenticatedFetch(
    `/organizations/${organizationId}/devices`,
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Unable to load devices: ${response.status}`,
      ),
    )
  }

  return response.json()
}

export async function updateDevice(
  deviceId: string,
  payload: UpdateDevicePayload,
): Promise<Device> {
  const response = await authenticatedFetch(
    `/devices/${deviceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Unable to update device: ${response.status}`,
      ),
    )
  }

  return response.json()
}

export async function getEvents(): Promise<Event[]> {
  const response =
    await authenticatedFetch('/events')

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Unable to load events: ${response.status}`,
      ),
    )
  }

  return response.json()
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<Event> {
  const response = await authenticatedFetch(
    '/events',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Unable to create event: ${response.status}`,
      ),
    )
  }

  return response.json()
}