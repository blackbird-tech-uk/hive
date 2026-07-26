from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceAgentResponse(BaseModel):
    """Authenticated device details returned to the Android agent."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    hive_id: str
    asset_id: str
    serial_number: str
    imei: str | None
    manufacturer: str | None
    model: str
    android_version: str | None
    build_version: str | None
    agent_version: str | None
    battery_level: int | None
    is_charging: bool | None
    wifi_ssid: str | None
    ip_address: str | None
    enrolled_at: datetime | None
    last_seen_at: datetime | None


class DeviceHeartbeatRequest(BaseModel):
    """Telemetry sent by an enrolled Android device."""

    battery_level: int | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    is_charging: bool | None = None

    wifi_ssid: str | None = Field(
        default=None,
        max_length=255,
    )

    ip_address: str | None = Field(
        default=None,
        max_length=45,
    )

    agent_version: str | None = Field(
        default=None,
        max_length=100,
    )

    android_version: str | None = Field(
        default=None,
        max_length=50,
    )

    build_version: str | None = Field(
        default=None,
        max_length=100,
    )


class DeviceHeartbeatResponse(BaseModel):
    """Confirmation returned after a heartbeat is accepted."""

    device_id: uuid.UUID
    hive_id: str
    accepted: bool = True
    server_time: datetime
    heartbeat_interval_seconds: int = 300
    last_seen_at: datetime