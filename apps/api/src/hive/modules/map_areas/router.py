from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.events.models import Event
from hive.modules.map_areas.models import MapArea
from hive.modules.map_areas.schemas import MapAreaCreate, MapAreaResponse
from hive.modules.organizations.exceptions import (
    OrganizationAccessDeniedError,
    OrganizationNotFoundError,
)
from hive.modules.organizations.service import OrganizationService
from hive.modules.users.models import UserRole

router = APIRouter(
    prefix="/organizations/{organization_id}/events/{event_id}/map-areas",
    tags=["Map Areas"],
)
DatabaseSession = Annotated[Session, Depends(get_db)]


def check_access(
    db: Session, actor, organization_id: UUID, event_id: UUID,
    write: bool = False,
):
    try:
        OrganizationService(db).get_organization_for_user(
            organization_id=organization_id, actor=actor,
        )
    except (OrganizationNotFoundError, OrganizationAccessDeniedError):
        raise HTTPException(status_code=404, detail="Organization not found.") from None
    # Require both organisation membership and ownership of the requested event.
    event = db.get(Event, event_id)
    if event is None or event.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Event not found for this organisation.")
    if write and actor.role == UserRole.READ_ONLY:
        raise HTTPException(status_code=403, detail="Read-only users cannot edit map areas.")


@router.get("", response_model=list[MapAreaResponse])
def list_areas(
    organization_id: UUID, event_id: UUID,
    db: DatabaseSession, actor: CurrentUser,
):
    check_access(db, actor, organization_id, event_id)
    return db.scalars(
        select(MapArea).where(
            MapArea.organization_id == organization_id,
            MapArea.event_id == event_id,
        ).order_by(MapArea.name)
    ).all()


@router.post("", response_model=MapAreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(
    organization_id: UUID, event_id: UUID, payload: MapAreaCreate,
    db: DatabaseSession, actor: CurrentUser,
):
    check_access(db, actor, organization_id, event_id, write=True)
    area = MapArea(
        organization_id=organization_id,
        event_id=event_id,
        name=payload.name.strip(),
        points=[list(p) for p in payload.points],
    )
    db.add(area)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An area with this name already exists for this event.",
        ) from None
    db.refresh(area)
    return area


@router.put("/{area_id}", response_model=MapAreaResponse)
def update_area(
    organization_id: UUID, event_id: UUID, area_id: UUID, payload: MapAreaCreate,
    db: DatabaseSession, actor: CurrentUser,
):
    check_access(db, actor, organization_id, event_id, write=True)
    area = db.scalar(
        select(MapArea).where(
            MapArea.id == area_id,
            MapArea.organization_id == organization_id,
            MapArea.event_id == event_id,
        )
    )
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found.")
    area.name = payload.name.strip()
    area.points = [list(point) for point in payload.points]
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An area with this name already exists for this event.",
        ) from None
    db.refresh(area)
    return area


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    organization_id: UUID, event_id: UUID, area_id: UUID,
    db: DatabaseSession, actor: CurrentUser,
):
    check_access(db, actor, organization_id, event_id, write=True)
    area = db.scalar(
        select(MapArea).where(
            MapArea.id == area_id,
            MapArea.organization_id == organization_id,
            MapArea.event_id == event_id,
        )
    )
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found.")
    db.delete(area)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail='Area is assigned to a scanner and cannot be deleted.',
        ) from exc
    return Response(status_code=204)
