export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'

export type DeviceUpdatedMessage<TDevice = unknown> = {
  type: 'device.updated'
  device: TDevice
}

export type RealtimeMessage<TDevice = unknown> =
  | DeviceUpdatedMessage<TDevice>
  | {
      type: 'ping'
    }

type RealtimeOptions<TDevice> = {
  token: string
  organizationId: string
  onDeviceUpdated: (device: TDevice) => void
  onStatusChange?: (
    status: RealtimeConnectionStatus,
  ) => void
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000/api/v1'

function createWebSocketUrl(
  organizationId: string,
  token: string,
): string {
  const websocketBaseUrl = API_BASE_URL.replace(
    /^http/,
    'ws',
  )

  const encodedOrganizationId =
    encodeURIComponent(organizationId)

  const encodedToken = encodeURIComponent(token)

  return (
    `${websocketBaseUrl}/realtime/organizations/` +
    `${encodedOrganizationId}/devices?token=${encodedToken}`
  )
}

export function connectToDeviceUpdates<TDevice>({
  token,
  organizationId,
  onDeviceUpdated,
  onStatusChange,
}: RealtimeOptions<TDevice>): () => void {
  let websocket: WebSocket | null = null
  let reconnectTimer: number | null = null
  let reconnectAttempts = 0
  let closedManually = false

  const connect = () => {
    if (closedManually) {
      return
    }

    onStatusChange?.('connecting')

    websocket = new WebSocket(
      createWebSocketUrl(
        organizationId,
        token,
      ),
    )

    websocket.onopen = () => {
      reconnectAttempts = 0
      onStatusChange?.('connected')
    }

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(
          event.data,
        ) as RealtimeMessage<TDevice>

        if (message.type === 'device.updated') {
          onDeviceUpdated(message.device)
        }
      } catch (error) {
        console.error(
          'Unable to process realtime message:',
          error,
        )
      }
    }

    websocket.onerror = () => {
      websocket?.close()
    }

    websocket.onclose = () => {
      websocket = null

      if (closedManually) {
        onStatusChange?.('disconnected')
        return
      }

      onStatusChange?.('disconnected')

      const reconnectDelay = Math.min(
        1000 * 2 ** reconnectAttempts,
        30000,
      )

      reconnectAttempts += 1

      reconnectTimer = window.setTimeout(
        connect,
        reconnectDelay,
      )
    }
  }

  connect()

  return () => {
    closedManually = true

    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
    }

    websocket?.close()
    websocket = null
  }
}