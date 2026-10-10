from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class DeviceConnectionManager:
    """Manage live dashboard connections by organisation."""

    def __init__(self) -> None:
        self._connections: dict[
            UUID,
            set[WebSocket],
        ] = defaultdict(set)

    async def connect(
        self,
        *,
        organization_id: UUID,
        websocket: WebSocket,
    ) -> None:
        await websocket.accept()

        self._connections[organization_id].add(
            websocket
        )

    def disconnect(
        self,
        *,
        organization_id: UUID,
        websocket: WebSocket,
    ) -> None:
        connections = self._connections.get(
            organization_id
        )

        if not connections:
            return

        connections.discard(websocket)

        if not connections:
            self._connections.pop(
                organization_id,
                None,
            )

    async def broadcast_device_update(
        self,
        *,
        organization_id: UUID,
        device: dict[str, object],
    ) -> None:
        connections = list(
            self._connections.get(
                organization_id,
                set(),
            )
        )

        if not connections:
            return

        message = {
            "type": "device.updated",
            "device": device,
        }

        disconnected: list[WebSocket] = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(
                organization_id=organization_id,
                websocket=websocket,
            )


device_connection_manager = DeviceConnectionManager()