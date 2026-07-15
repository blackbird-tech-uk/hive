from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.events.models import Event


class EventRepository:
    """Database access for Hive events."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, event: Event) -> Event:
        self.db.add(event)
        self.db.flush()
        return event

    def get_by_id(self, event_id: uuid.UUID) -> Event | None:
        return self.db.scalar(
            select(Event).where(Event.id == event_id)
        )

    def list_all(self) -> Sequence[Event]:
        return self.db.scalars(
            select(Event).order_by(Event.start_date.asc())
        ).all()