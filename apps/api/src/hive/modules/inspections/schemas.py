from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InspectionCreate(BaseModel):
    hive_connection_ok: bool
    chrome_ok: bool
    smartscan_ok: bool
    google_play_ok: bool
    battery_charging_ok: bool
    notes: str | None = Field(default=None, max_length=2000)


class InspectionResponse(InspectionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    device_id: UUID
    inspected_by_user_id: UUID
    inspected_at: datetime
