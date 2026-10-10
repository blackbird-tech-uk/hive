from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
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