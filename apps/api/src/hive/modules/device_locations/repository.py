from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.device_locations.models import DeviceLocation


class DeviceLocationRepository:
    """Database access for device locations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_latest_locations(self) -> list[DeviceLocation]:
        """Return the latest location for every device."""

        statement = (
            select(DeviceLocation)
            .distinct(DeviceLocation.device_id)
            .order_by(
                DeviceLocation.device_id,
                DeviceLocation.recorded_at.desc(),
            )
        )

        return list(self.db.scalars(statement))

    def get_location_history(
        self,
        device_id: uuid.UUID,
        limit: int = 100,
    ) -> list[DeviceLocation]:
        """Return recent location history for a device."""

        statement = (
            select(DeviceLocation)
            .where(DeviceLocation.device_id == device_id)
            .order_by(DeviceLocation.recorded_at.desc())
            .limit(limit)
        )

        return list(self.db.scalars(statement))