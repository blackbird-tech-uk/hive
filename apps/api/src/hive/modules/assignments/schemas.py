from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class AssignmentStatus(str, Enum):
    assigned = "assigned"
    returned = "returned"
    lost = "lost"
    repair = "repair"


class AssignmentCreate(BaseModel):
    device_id: uuid.UUID
    event_id: uuid.UUID

    map_area_id: uuid.UUID | None = None
    assigned_to_name: str | None = Field(default=None, max_length=150)
    assigned_location: str | None = Field(default=None, max_length=150)
    notes: str | None = None


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID

    device_id: uuid.UUID
    event_id: uuid.UUID

    map_area_id: uuid.UUID | None
    assigned_to_name: str | None
    assigned_location: str | None

    status: AssignmentStatus

    assigned_at: datetime
    returned_at: datetime | None

    notes: str | None