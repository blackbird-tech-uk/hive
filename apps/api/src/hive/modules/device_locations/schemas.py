from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceLocationResponse(BaseModel):
    """Location data returned to the dashboard."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID

    latitude: float
    longitude: float

    accuracy_meters: float | None = None
    altitude_meters: float | None = None
    speed_meters_per_second: float | None = None
    bearing_degrees: float | None = None

    recorded_at: datetime
    created_at: datetime


class DeviceLocationHistoryQuery(BaseModel):
    """Validation for location-history limits."""

    limit: int = Field(
        default=100,
        ge=1,
        le=1000,
    )