from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.device_locations.schemas import (
    DeviceLocationResponse,
)
from hive.modules.device_locations.service import (
    DeviceLocationService,
)

DatabaseSession = Annotated[Session, Depends(get_db)]

router = APIRouter(
    prefix="/device-locations",
    tags=["Device Locations"],
)


@router.get(
    "/latest",
    response_model=list[DeviceLocationResponse],
)
def get_latest_locations(
    db: DatabaseSession,
) -> list[DeviceLocationResponse]:
    """Return the latest location for every device."""

    service = DeviceLocationService(db)

    return [
        DeviceLocationResponse.model_validate(location)
        for location in service.list_latest_locations()
    ]


@router.get(
    "/history/{device_id}",
    response_model=list[DeviceLocationResponse],
)
def get_device_location_history(
    device_id: uuid.UUID,
    db: DatabaseSession,
    limit: int = Query(
        default=100,
        ge=1,
        le=1000,
    ),
) -> list[DeviceLocationResponse]:
    """Return recent location history for a device."""

    service = DeviceLocationService(db)

    return [
        DeviceLocationResponse.model_validate(location)
        for location in service.get_device_history(
            device_id=device_id,
            limit=limit,
        )
    ]