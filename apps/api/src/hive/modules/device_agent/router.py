from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from hive.core.realtime import device_connection_manager
from hive.db.session import get_db
from hive.modules.device_agent.dependencies import CurrentDevice
from hive.modules.device_agent.schemas import (
    DeviceAgentResponse,
    DeviceHeartbeatRequest,
    DeviceHeartbeatResponse,
)
from hive.modules.device_agent.service import DeviceAgentService

router = APIRouter(
    prefix="/device-agent",
    tags=["Device Agent"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db),
]


@router.get(
    "/me",
    response_model=DeviceAgentResponse,
    status_code=status.HTTP_200_OK,
)
def get_device_agent_me(
    db: DatabaseSession,
    current_device: CurrentDevice,
) -> DeviceAgentResponse:
    """Return the authenticated device."""

    service = DeviceAgentService(db)

    return service.get_current_device(
        current_device
    )


@router.post(
    "/heartbeat",
    response_model=DeviceHeartbeatResponse,
    status_code=status.HTTP_200_OK,
)
async def record_device_heartbeat(
    payload: DeviceHeartbeatRequest,
    db: DatabaseSession,
    current_device: CurrentDevice,
) -> DeviceHeartbeatResponse:
    """Record telemetry and broadcast the update."""

    service = DeviceAgentService(db)

    heartbeat_response = service.record_heartbeat(
        device=current_device,
        payload=payload,
    )

    device_response = DeviceAgentResponse.model_validate(
        current_device
    )

    await device_connection_manager.broadcast_device_update(
        organization_id=current_device.organization_id,
        device=device_response.model_dump(
            mode="json"
        ),
    )

    return heartbeat_response