from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.devices.models import Device


class DeviceAgentRepository:
    """Database access used by authenticated device agents."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(
        self,
        device_id: uuid.UUID,
    ) -> Device | None:
        statement = select(Device).where(
            Device.id == device_id,
        )

        return self.db.scalar(statement)

    def update_last_seen(
        self,
        device: Device,
        *,
        now: datetime,
    ) -> Device:
        device.last_seen_at = now
        self.db.flush()
        return device