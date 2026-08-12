from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeviceAgentResponse(BaseModel):
    """Information returned to an authenticated device agent."""

    id: UUID
    organization_id: UUID
    hive_id: str
    asset_id: str
    serial_number: str
    imei: str | None = None
    manufacturer: str | None = None
    model: str
    android_version: str | None = None
    build_version: str | None = None
    agent_version: str | None = None
    battery_level: int | None = None
    is_charging: bool | None = None
    wifi_ssid: str | None = None
    ip_address: str | None = None
    management_mode: str | None = None
    is_device_admin: bool | None = None
    is_device_owner: bool | None = None
    supports_lock_task: bool | None = None
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
    enrolled_at: datetime | None = None
    last_seen_at: datetime | None = None

    model_config = ConfigDict(
        from_attributes=True,
    )


class DeviceHeartbeatRequest(BaseModel):
    """Telemetry submitted by a device during a heartbeat."""

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

    imei: str | None = Field(
        default=None,
        min_length=15,
        max_length=15,
        pattern=r"^\d{15}$",
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

    management_mode: str | None = Field(
        default=None,
        max_length=32,
    )

    is_device_admin: bool | None = None
    is_device_owner: bool | None = None
    supports_lock_task: bool | None = None
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None


class DeviceCommandDelivery(BaseModel):
    """A command delivered to an authenticated device."""

    id: UUID
    command: str
    payload: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class DeviceHeartbeatResponse(BaseModel):
    """Response returned after a successful heartbeat."""

    device_id: UUID
    hive_id: str
    accepted: bool
    server_time: datetime
    heartbeat_interval_seconds: int
    last_seen_at: datetime | None
    commands: list[DeviceCommandDelivery]


class DeviceLocationUpload(BaseModel):
    """Location report submitted by an authenticated device."""

    latitude: float = Field(
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ge=-180,
        le=180,
    )

    accuracy: float | None = Field(
        default=None,
        ge=0,
    )

    altitude: float | None = None

    speed: float | None = Field(
        default=None,
        ge=0,
    )

    bearing: float | None = Field(
        default=None,
        ge=0,
        le=360,
    )

    provider: str | None = Field(
        default=None,
        max_length=50,
    )

    recorded_at: datetime


class DeviceLocationResponse(BaseModel):
    """A location report stored by Hive."""

    id: UUID
    organization_id: UUID
    device_id: UUID

    latitude: float
    longitude: float
    accuracy: float | None = None
    altitude: float | None = None
    speed: float | None = None
    bearing: float | None = None
    provider: str | None = None

    recorded_at: datetime
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )







