const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api/v1";

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
  asset_id?: string;
  serial_number?: string;
  imei?: string | null;
  model?: string;
  android_version?: string | null;
  build_version?: string | null;
  status?: string;
  condition?: string;
  notes?: string | null;
};

export async function getDevices(): Promise<Device[]> {
  const response = await fetch(`${API_BASE_URL}/devices`);

  if (!response.ok) {
    throw new Error(`Unable to load devices: ${response.status}`);
  }

  return response.json();
}

export async function updateDevice(
  deviceId: string,
  payload: UpdateDevicePayload,
): Promise<Device> {
  const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Unable to update device: ${response.status}`;

    try {
      const errorBody = (await response.json()) as {
        detail?: string;
      };

      if (errorBody.detail) {
        message = errorBody.detail;
      }
    } catch {
      // Keep the fallback message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

export type EventStatus =
  | "draft"
  | "planned"
  | "active"
  | "completed"
  | "cancelled"
  | "archived";

export type Event = {
  id: string;
  name: string;
  venue: string;
  start_date: string;
  end_date: string;
  status: EventStatus | string;
  notes: string | null;
};

export type CreateEventPayload = {
  name: string;
  venue: string;
  start_date: string;
  end_date: string;
  status: EventStatus;
  notes?: string;
};

export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${API_BASE_URL}/events`);

  if (!response.ok) {
    throw new Error(`Unable to load events: ${response.status}`);
  }

  return response.json();
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<Event> {
  const response = await fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      errorBody || `Unable to create event: ${response.status}`,
    );
  }

  return response.json();
}