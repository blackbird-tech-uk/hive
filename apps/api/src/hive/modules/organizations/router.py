from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.organizations.exceptions import (
    OrganizationAccessDeniedError,
    OrganizationNotFoundError,
    OrganizationSlugAlreadyExistsError,
)
from hive.modules.organizations.schemas import (
    OrganizationCreate,
    OrganizationResponse,
)
from hive.modules.organizations.service import OrganizationService

router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    payload: OrganizationCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> OrganizationResponse:
    service = OrganizationService(db)

    try:
        return service.create_organization(
            payload=payload,
            actor=current_user,
        )
    except OrganizationSlugAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=list[OrganizationResponse],
)
def list_organizations(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[OrganizationResponse]:
    service = OrganizationService(db)

    return list(
        service.list_organizations_for_user(
            actor=current_user,
        )
    )


@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def get_organization(
    organization_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> OrganizationResponse:
    service = OrganizationService(db)

    try:
        return service.get_organization_for_user(
            organization_id=organization_id,
            actor=current_user,
        )
    except (
        OrganizationNotFoundError,
        OrganizationAccessDeniedError,
    ) as exc:
        # Use the same response for missing and inaccessible organizations
        # to avoid exposing whether another tenant exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization was not found.",
        ) from exc