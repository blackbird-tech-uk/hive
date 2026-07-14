from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from hive.modules.devices.models import DeviceCondition, DeviceStatus


class DeviceCreate(BaseModel):
    asset_id: str = Field(min_length=1, max_length=100)
    serial_number: str = Field(min_length=1, max_length=100)
    imei: str | None = Field(default=None, min_length=15, max_length=15)
    model: str = Field(default="Unitech EA660", min_length=1, max_length=100)
    android_version: str | None = Field(default=None, max_length=50)
    build_version: str | None = Field(default=None, max_length=100)
    condition: DeviceCondition = DeviceCondition.GOOD
    notes: str | None = None


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hive_id: str
    asset_id: str
    serial_number: str
    imei: str | None
    model: str
    android_version: str | None
    build_version: str | None
    status: DeviceStatus
    condition: DeviceCondition
    notes: str | None
    created_at: datetime
    updated_at: datetime