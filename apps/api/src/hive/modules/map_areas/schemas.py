from __future__ import annotations

import uuid
from datetime import datetime
from math import isfinite

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MapAreaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    points: list[tuple[float, float]] = Field(min_length=3, max_length=100)

    @model_validator(mode="after")
    def validate_coordinates(self):
        if not self.name.strip():
            raise ValueError("Area name cannot be blank.")
        if any(
            not (isfinite(lat) and isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180)
            for lat, lng in self.points
        ):
            raise ValueError("Coordinates must be valid latitude/longitude pairs.")
        return self


class MapAreaResponse(MapAreaCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    event_id: uuid.UUID
    created_at: datetime
