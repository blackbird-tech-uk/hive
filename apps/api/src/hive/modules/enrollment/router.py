from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from hive.core.config import settings
from hive.core.security import create_access_token, decode_access_token
from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.devices.repository import DeviceRepository
from hive.modules.devices.schemas import DeviceTokenResponse
from hive.modules.enrollment.exceptions import (
    EnrolledDeviceAlreadyExistsError,
    EnrollmentPermissionDeniedError,
    EnrollmentTokenAlreadyRevokedError,
    EnrollmentTokenExhaustedError,
    EnrollmentTokenExpiredError,
    EnrollmentTokenNotFoundError,
    EnrollmentTokenRevokedError,
    InvalidEnrollmentTokenError,
)
from hive.modules.enrollment.schemas import (
    DeviceEnrollmentRequest,
    DeviceEnrollmentResponse,
    EnrollmentTokenCreate,
    EnrollmentTokenCreatedResponse,
    EnrollmentTokenResponse,
)
from hive.modules.enrollment.service import EnrollmentService

router = APIRouter(
    prefix="/organizations/{organization_id}/enrollment-tokens",
    tags=["Enrollment"],
)

public_router = APIRouter(
    prefix="/enrollment",
    tags=["Device Enrollment"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=EnrollmentTokenCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_enrollment_token(
    organization_id: UUID,
    payload: EnrollmentTokenCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> EnrollmentTokenCreatedResponse:
    """Create an enrollment token and return its plaintext value once."""

    service = EnrollmentService(db)

    try:
        return service.create_token(
            organization_id=organization_id,
            payload=payload,
            actor=current_user,
        )
    except EnrollmentPermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=list[EnrollmentTokenResponse],
)
def list_enrollment_tokens(
    organization_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[EnrollmentTokenResponse]:
    """List safe enrollment-token metadata."""

    service = EnrollmentService(db)

    try:
        return list(
            service.list_tokens(
                organization_id=organization_id,
                actor=current_user,
            )
        )
    except EnrollmentPermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.post(
    "/{token_id}/revoke",
    response_model=EnrollmentTokenResponse,
)
def revoke_enrollment_token(
    organization_id: UUID,
    token_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> EnrollmentTokenResponse:
    """Revoke an enrollment token."""

    service = EnrollmentService(db)

    try:
        return service.revoke_token(
            organization_id=organization_id,
            token_id=token_id,
            actor=current_user,
        )
    except EnrollmentPermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except EnrollmentTokenNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except EnrollmentTokenAlreadyRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@public_router.post(
    "/redeem",
    response_model=DeviceEnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def redeem_enrollment_token(
    payload: DeviceEnrollmentRequest,
    db: DatabaseSession,
) -> DeviceEnrollmentResponse:
    """Enroll an Android device using a plaintext enrollment token."""

    service = EnrollmentService(db)

    try:
        return service.redeem_token(payload)
    except InvalidEnrollmentTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except (
        EnrollmentTokenExpiredError,
        EnrollmentTokenRevokedError,
        EnrollmentTokenExhaustedError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=str(exc),
        ) from exc
    except EnrolledDeviceAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

@public_router.post(
    "/renew",
    response_model=DeviceTokenResponse,
    status_code=status.HTTP_200_OK,
)
def renew_device_token(
    db: DatabaseSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(HTTPBearer(auto_error=False)),
    ],
) -> DeviceTokenResponse:
    """Renew a valid device JWT without changing the device's revocation version.

    Renewal requires an unexpired token and a matching current token version.
    Administratively rotated/revoked tokens cannot be renewed.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Device credentials required")
    try:
        claims = decode_access_token(credentials.credentials)
        if claims.get("type") != "device":
            raise ValueError("Not a device token")
        device_id = UUID(str(claims["sub"]))
        organization_id = UUID(str(claims["organization_id"]))
        version = int(claims["token_version"])
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid device credentials") from None

    device = DeviceRepository(db).get_by_id(
        organization_id=organization_id, device_id=device_id,
    )
    if device is None or device.device_token_version != version:
        raise HTTPException(status_code=401, detail="Device credentials revoked")

    token, expires_in = create_access_token(
        subject=str(device.id),
        additional_claims={
            "type": "device",
            "organization_id": str(device.organization_id),
            "token_version": device.device_token_version,
        },
        expires_in_minutes=settings.device_token_expire_minutes,
    )
    return DeviceTokenResponse(
        device_id=device.id,
        organization_id=device.organization_id,
        hive_id=device.hive_id,
        device_token=token,
        token_type="Bearer",
        expires_in=expires_in,
        token_version=device.device_token_version,
    )
