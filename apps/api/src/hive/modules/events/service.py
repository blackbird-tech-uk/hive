from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from hive.modules.events.models import Event
from hive.modules.events.repository import EventRepository
from hive.modules.events.schemas import EventCreate, EventUpdate


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
            status=payload.status.strip().lower(),
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

    def update_event(
        self,
        event_id: uuid.UUID,
        payload: EventUpdate,
    ) -> Event:
        event = self.get_event(event_id)

        updates = payload.model_dump(exclude_unset=True)

        new_start_date = updates.get("start_date", event.start_date)
        new_end_date = updates.get("end_date", event.end_date)

        if new_end_date < new_start_date:
            raise ValueError("End date cannot be before start date.")

        if "name" in updates:
            event.name = updates["name"].strip()

        if "venue" in updates:
            event.venue = updates["venue"].strip()

        if "start_date" in updates:
            event.start_date = updates["start_date"]

        if "end_date" in updates:
            event.end_date = updates["end_date"]

        if "status" in updates:
            event.status = updates["status"].strip().lower()

        if "notes" in updates:
            event.notes = updates["notes"]

        self.db.commit()
        self.db.refresh(event)

        return event