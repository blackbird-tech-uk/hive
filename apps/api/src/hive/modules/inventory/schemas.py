from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class InstalledApplicationUpload(BaseModel):
    """One installed application reported by an agent."""

    package_name: str = Field(
        min_length=1,
        max_length=255,
    )

    app_name: str | None = Field(
        default=None,
        max_length=255,
    )

    version_name: str | None = Field(
        default=None,
        max_length=100,
    )

    version_code: int | None = Field(
        default=None,
        ge=0,
    )

    is_system_app: bool = False
    is_enabled: bool = True

    first_installed_at: datetime | None = None
    last_updated_at: datetime | None = None


class InstalledApplicationInventoryUpload(
    BaseModel,
):
    """Complete application inventory from one device."""

    applications: list[
        InstalledApplicationUpload
    ] = Field(
        default_factory=list,
        max_length=5000,
    )


class InstalledApplicationResponse(BaseModel):
    """Stored installed-application information."""

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    organization_id: uuid.UUID
    device_id: uuid.UUID

    package_name: str
    app_name: str | None
    version_name: str | None
    version_code: int | None

    is_system_app: bool
    is_enabled: bool

    first_installed_at: datetime | None
    last_updated_at: datetime | None
    reported_at: datetime
    created_at: datetime
    updated_at: datetime


class InstalledApplicationInventoryResponse(
    BaseModel,
):
    """Result returned after inventory synchronisation."""

    device_id: uuid.UUID
    application_count: int
    reported_at: datetime