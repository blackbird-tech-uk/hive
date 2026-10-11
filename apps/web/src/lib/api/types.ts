// =====================================================
// Hive API Types
// Shared models used throughout the frontend.
// =====================================================

/* ---------- Authentication ---------- */

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

/* ---------- Organizations ---------- */

export type OrganizationStatus =
  | 'active'
  | 'suspended'
  | 'archived'

export interface Organization {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  created_at: string
  updated_at: string
}

/* ---------- Devices ---------- */

export interface Device {
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

    management_mode:
    | 'standard'
    | 'device_admin'
    | 'device_owner'
    | string
  is_device_admin: boolean
  is_device_owner: boolean
  supports_lock_task: boolean
  supports_device_lock: boolean
  is_lock_task_active: boolean
  supports_camera_policy: boolean
  supports_lock_timeout_policy: boolean
  camera_disabled: boolean | null
  maximum_time_to_lock_ms: number | null
  desired_camera_disabled: boolean | null
  desired_maximum_time_to_lock_ms: number | null
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

/* ---------- Installed Applications ---------- */

export interface InstalledApplication {
  id: string
  organization_id: string
  device_id: string
  package_name: string
  app_name: string | null
  version_name: string | null
  version_code: number | null
  is_system_app: boolean
  is_enabled: boolean
  first_installed_at: string | null
  last_updated_at: string | null
  reported_at: string
  created_at: string
  updated_at: string
}

/* ---------- Device Locations ---------- */

export interface DeviceLocation {
  id: string
  organization_id: string
  device_id: string

  latitude: number
  longitude: number

  accuracy: number | null
  altitude: number | null
  speed: number | null
  bearing: number | null

  provider: string | null

  recorded_at: string
  created_at: string
}

/* ---------- Device Commands ---------- */

export type DeviceCommandStatus =
  | 'pending'
  | 'sent'
  | 'acknowledged'
  | 'completed'
  | 'failed'

export interface DeviceCommand {
  id: string

  device_id: string

  command: string

  payload: Record<string, unknown>

  status: DeviceCommandStatus | string

  result_message: string | null

  created_at: string
  sent_at: string | null
  acknowledged_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface CreateDeviceCommandPayload {
  command: string
  payload?: Record<string, unknown>
}

export interface UpdateDevicePayload {
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

/* ---------- Assignments ---------- */

export interface Assignment {
  id: string
  device_id: string
  event_id: string
  assigned_to_name: string | null
  assigned_location: string | null
  status: 'assigned' | 'returned' | 'lost' | 'repair' | string
  assigned_at: string
  returned_at: string | null
  notes: string | null
}

/* ---------- Events ---------- */

export type EventStatus =
  | 'draft'
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived'

export interface Event {
  id: string

  name: string
  venue: string

  start_date: string
  end_date: string

  status: EventStatus | string

  notes: string | null
}

export interface CreateEventPayload {
  name: string
  venue: string

  start_date: string
  end_date: string

  status: EventStatus

  notes?: string
}

/* ---------- Enrollment ---------- */

export interface CreateEnrollmentTokenPayload {
  label?: string
  expires_in_hours?: number
  max_uses?: number
}

export interface EnrollmentTokenCreatedResponse {
  id: string
  organization_id: string

  token: string
  token_prefix: string

  label: string | null

  max_uses: number
  use_count: number

  expires_at: string
  created_at: string
}

export interface EnrollmentTokenResponse {
  id: string
  organization_id: string
  created_by_user_id: string

  token_prefix: string
  label: string | null

  max_uses: number
  use_count: number

  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

/* ---------- Errors ---------- */

export interface ApiErrorBody {
  detail?: string
}





