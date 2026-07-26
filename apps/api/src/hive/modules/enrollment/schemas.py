from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EnrollmentTokenCreate(BaseModel):
    """Payload for creating a device-enrollment token."""

    label: str | None = Field(
        default=None,
        max_length=150,
    )
    expires_in_hours: int = Field(
        default=24,
        ge=1,
        le=720,
    )
    max_uses: int = Field(
        default=1,
        ge=1,
        le=1000,
    )


class EnrollmentTokenCreatedResponse(BaseModel):
    """Response returned once when a token is created."""

    id: uuid.UUID
    organization_id: uuid.UUID
    token: str
    token_prefix: str
    label: str | None
    max_uses: int
    use_count: int
    expires_at: datetime
    created_at: datetime


class EnrollmentTokenResponse(BaseModel):
    """Safe token metadata without its plaintext value."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    created_by_user_id: uuid.UUID
    token_prefix: str
    label: str | None
    max_uses: int
    use_count: int
    expires_at: datetime
    revoked_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime


class DeviceEnrollmentRequest(BaseModel):
    """Information sent by an Android device during enrollment."""

    token: str = Field(
        min_length=10,
        max_length=100,
    )
    asset_id: str | None = Field(
        default=None,
        max_length=100,
    )
    serial_number: str = Field(
        min_length=1,
        max_length=100,
    )
    imei: str | None = Field(
        default=None,
        min_length=15,
        max_length=15,
    )
    manufacturer: str | None = Field(
        default=None,
        max_length=100,
    )
    model: str = Field(
        min_length=1,
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

    @field_validator("token")
    @classmethod
    def normalize_token(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("imei")
    @classmethod
    def validate_imei(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized.isdigit():
            raise ValueError("IMEI must contain digits only")

        return normalized


class DeviceEnrollmentResponse(BaseModel):
    """Credentials and configuration returned to an enrolled device."""

    device_id: uuid.UUID
    organization_id: uuid.UUID
    hive_id: str
    device_token: str
    token_type: str = "bearer"
    expires_in: int
    heartbeat_interval_seconds: int = 60
    enrolled_at: datetime