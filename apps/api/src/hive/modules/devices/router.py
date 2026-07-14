from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.devices.schemas import DeviceCreate, DeviceResponse
from hive.modules.devices.service import (
    DeviceAlreadyExistsError,
    DeviceService,
)

router = APIRouter(
    prefix="/devices",
    tags=["Devices"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    payload: DeviceCreate,
    db: DatabaseSession,
) -> DeviceResponse:
    """Register a new device in Hive."""
    service = DeviceService(db)

    try:
        return service.create_device(payload)
    except DeviceAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=list[DeviceResponse],
)
def list_devices(db: DatabaseSession) -> list[DeviceResponse]:
    """Return all devices registered in Hive."""
    service = DeviceService(db)
    return list(service.list_devices())