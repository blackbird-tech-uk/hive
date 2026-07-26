from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.events.schemas import (
    EventCreate,
    EventResponse,
    EventUpdate,
)
from hive.modules.events.service import EventNotFoundError, EventService

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
    db: Session = Depends(get_db),
):
    service = EventService(db)
    return service.create_event(payload)


@router.get(
    "",
    response_model=list[EventResponse],
)
def list_events(
    db: Session = Depends(get_db),
):
    service = EventService(db)
    return service.list_events()


@router.get(
    "/{event_id}",
    response_model=EventResponse,
)
def get_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = EventService(db)

    try:
        return service.get_event(event_id)
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
    db: Session = Depends(get_db),
):
    service = EventService(db)

    try:
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