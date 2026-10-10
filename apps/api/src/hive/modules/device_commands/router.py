from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.device_commands.schemas import (
    DeviceCommandCreate,
    DeviceCommandResponse,
    DeviceCommandResultUpdate,
)
from hive.modules.device_commands.service import (
    DeviceCommandNotFoundError,
    DeviceCommandService,
    DeviceNotFoundError,
)

router = APIRouter(
    prefix="/device-commands",
    tags=["Device Commands"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/organizations/{organization_id}/devices/{device_id}",
    response_model=DeviceCommandResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device_command(
    organization_id: uuid.UUID,
    device_id: uuid.UUID,
    payload: DeviceCommandCreate,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.create_command(
            organization_id=organization_id,
            device_id=device_id,
            payload=payload,
        )
    except DeviceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/devices/{device_id}",
    response_model=list[DeviceCommandResponse],
)
def list_device_commands(
    device_id: uuid.UUID,
    db: DatabaseSession,
) -> list[DeviceCommandResponse]:
    service = DeviceCommandService(db)

    return service.list_device_commands(device_id)


@router.get(
    "/devices/{device_id}/pending",
    response_model=list[DeviceCommandResponse],
)
def list_pending_device_commands(
    device_id: uuid.UUID,
    db: DatabaseSession,
) -> list[DeviceCommandResponse]:
    service = DeviceCommandService(db)

    return service.pending_commands(device_id)


@router.get(
    "/{command_id}",
    response_model=DeviceCommandResponse,
)
def get_device_command(
    command_id: uuid.UUID,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.get_command(command_id)
    except DeviceCommandNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{command_id}/sent",
    response_model=DeviceCommandResponse,
)
def mark_device_command_sent(
    command_id: uuid.UUID,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.mark_sent(command_id)
    except DeviceCommandNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{command_id}/acknowledge",
    response_model=DeviceCommandResponse,
)
def acknowledge_device_command(
    command_id: uuid.UUID,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.acknowledge_command(command_id)
    except DeviceCommandNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{command_id}/complete",
    response_model=DeviceCommandResponse,
)
def complete_device_command(
    command_id: uuid.UUID,
    payload: DeviceCommandResultUpdate,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.complete_command(
            command_id,
            result_message=payload.result_message,
        )
    except DeviceCommandNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{command_id}/fail",
    response_model=DeviceCommandResponse,
)
def fail_device_command(
    command_id: uuid.UUID,
    payload: DeviceCommandResultUpdate,
    db: DatabaseSession,
) -> DeviceCommandResponse:
    service = DeviceCommandService(db)

    try:
        return service.fail_command(
            command_id,
            result_message=payload.result_message,
        )
    except DeviceCommandNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc