from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.events.schemas import (
    EventCreate,
    EventResponse,
    EventUpdate,
)
from hive.modules.events.service import EventNotFoundError, EventService

def accessible_orgs(actor: CurrentUser) -> set[uuid.UUID]:
    return {
        membership.organization_id
        for membership in actor.organization_memberships
        if membership.status.value == "active"
        and membership.organization.status.value == "active"
    }


router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    payload: EventCreate,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    allowed = accessible_orgs(actor)
    organization_id = payload.organization_id
    if organization_id is None and len(allowed) == 1:
        organization_id = next(iter(allowed))
    if organization_id not in allowed:
        raise HTTPException(status_code=403, detail='Select an accessible organisation.')
    return EventService(db).create_event(payload.model_copy(update={'organization_id': organization_id}))


@router.get(
    "",
    response_model=list[EventResponse],
)
def list_events(
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    allowed = accessible_orgs(actor)
    return [event for event in EventService(db).list_events()
            if event.organization_id in allowed]


@router.get(
    "/{event_id}",
    response_model=EventResponse,
)
def get_event(
    event_id: uuid.UUID,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    service = EventService(db)

    try:
        event = service.get_event(event_id)
        if event.organization_id not in accessible_orgs(actor):
            raise EventNotFoundError(event_id)
        return event
    except EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        ) from exc


@router.patch(
    "/{event_id}",
    response_model=EventResponse,
)
def update_event(
    event_id: uuid.UUID,
    payload: EventUpdate,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    service = EventService(db)

    try:
        event = service.get_event(event_id)
        if event.organization_id not in accessible_orgs(actor):
            raise EventNotFoundError(event_id)
        return service.update_event(event_id, payload)
    except EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc