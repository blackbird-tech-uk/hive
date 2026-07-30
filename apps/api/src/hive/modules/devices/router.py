from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.devices.schemas import (
    DeviceCreate,
    DeviceResponse,
    DeviceTokenResponse,
    DeviceUpdate,
)
from hive.modules.devices.service import (
    DeviceAlreadyExistsError,
    DeviceDeletionError,
    DeviceNotFoundError,
    DevicePermissionDeniedError,
    DeviceService,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/devices",
    tags=["Devices"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db),
]


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    organization_id: UUID,
    payload: DeviceCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> DeviceResponse:
    service = DeviceService(db)

    try:
        return service.create_device(
            organization_id=organization_id,
            payload=payload,
            actor=current_user,
        )
    except DevicePermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except DeviceAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=list[DeviceResponse],
)
def list_devices(
    organization_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[DeviceResponse]:
    service = DeviceService(db)

    try:
        return list(
            service.list_devices(
                organization_id=organization_id,
                actor=current_user,
            )
        )
    except DevicePermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
)
def get_device(
    organization_id: UUID,
    device_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> DeviceResponse:
    service = DeviceService(db)

    try:
        return service.get_device(
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


@router.patch(
    "/{device_id}",
    response_model=DeviceResponse,
)
def update_device(
    organization_id: UUID,
    device_id: UUID,
    payload: DeviceUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> DeviceResponse:
    service = DeviceService(db)

    try:
        return service.update_device(
            organization_id=organization_id,
            device_id=device_id,
            payload=payload,
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
    except DeviceAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_device(
    organization_id: UUID,
    device_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Response:
    """Permanently remove a managed device."""

    service = DeviceService(db)

    try:
        service.delete_device(
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
    except DeviceDeletionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


@router.post(
    "/{device_id}/token",
    response_model=DeviceTokenResponse,
    status_code=status.HTTP_200_OK,
)
def issue_device_token(
    organization_id: UUID,
    device_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> DeviceTokenResponse:
    service = DeviceService(db)

    try:
        return service.issue_device_token(
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