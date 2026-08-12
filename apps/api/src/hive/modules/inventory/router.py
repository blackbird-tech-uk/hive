from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.device_agent.dependencies import CurrentDevice
from hive.modules.devices.service import (
    DeviceNotFoundError,
    DevicePermissionDeniedError,
    DeviceService,
)
from hive.modules.inventory.schemas import (
    InstalledApplicationInventoryResponse,
    InstalledApplicationInventoryUpload,
    InstalledApplicationResponse,
)
from hive.modules.inventory.service import InstalledApplicationService

router = APIRouter(
    tags=["Installed Applications"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db),
]


@router.post(
    "/device-agent/apps",
    response_model=InstalledApplicationInventoryResponse,
    status_code=status.HTTP_200_OK,
)
def upload_installed_applications(
    payload: InstalledApplicationInventoryUpload,
    db: DatabaseSession,
    current_device: CurrentDevice,
) -> InstalledApplicationInventoryResponse:
    """Replace inventory for the authenticated device."""

    return InstalledApplicationService(
        db
    ).replace_inventory(
        device=current_device,
        payload=payload,
    )


@router.get(
    "/organizations/{organization_id}/devices/{device_id}/apps",
    response_model=list[InstalledApplicationResponse],
)
def list_installed_applications(
    organization_id: UUID,
    device_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[InstalledApplicationResponse]:
    """Return installed applications for one managed device."""

    device_service = DeviceService(db)

    try:
        device_service.get_device(
            organization_id=organization_id,
            device_id=device_id,
            actor=current_user,
        )
    except DevicePermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except DeviceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return InstalledApplicationService(
        db
    ).list_inventory(
        organization_id=organization_id,
        device_id=device_id,
    )
