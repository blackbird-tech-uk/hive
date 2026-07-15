from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from hive.modules.events.models import Event
from hive.modules.events.repository import EventRepository
from hive.modules.events.schemas import EventCreate


class EventNotFoundError(Exception):
    """Raised when an event cannot be found."""

    def __init__(self, event_id: uuid.UUID) -> None:
        super().__init__(f"Event '{event_id}' was not found.")


class EventService:
    """Business rules for Hive events."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = EventRepository(db)

    def create_event(self, payload: EventCreate) -> Event:
        event = Event(
            name=payload.name.strip(),
            venue=payload.venue.strip(),
            start_date=payload.start_date,
            end_date=payload.end_date,
            status=payload.status,
            notes=payload.notes,
        )

        self.repository.add(event)

        self.db.commit()
        self.db.refresh(event)

        return event

    def get_event(self, event_id: uuid.UUID) -> Event:
        event = self.repository.get_by_id(event_id)

        if event is None:
            raise EventNotFoundError(event_id)

        return event

    def list_events(self) -> Sequence[Event]:
        return self.repository.list_all()