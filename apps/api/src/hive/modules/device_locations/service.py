from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from hive.modules.device_locations.repository import (
    DeviceLocationRepository,
)


class DeviceLocationService:
    """Business logic for device locations."""

    def __init__(self, db: Session) -> None:
        self.repository = DeviceLocationRepository(db)

    def list_latest_locations(self):
        """Return the latest location for every device."""
        return self.repository.get_latest_locations()

    def get_device_history(
        self,
        device_id: uuid.UUID,
        limit: int = 100,
    ):
        """Return location history for a device."""
        return self.repository.get_location_history(
            device_id=device_id,
            limit=limit,
        )