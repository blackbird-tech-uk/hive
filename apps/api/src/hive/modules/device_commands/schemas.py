from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from hive.modules.device_commands.models import (
    DeviceCommandStatus,
    DeviceCommandType,
)


class DeviceCommandCreate(BaseModel):
    command: DeviceCommandType
    payload: dict[str, Any] | None = None


class DeviceCommandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID

    command: DeviceCommandType
    payload: dict[str, Any] | None

    status: DeviceCommandStatus
    result_message: str | None

    created_at: datetime
    sent_at: datetime | None
    acknowledged_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime


class DeviceCommandUpdate(BaseModel):
    status: DeviceCommandStatus
    result_message: str | None = None


class DeviceCommandResultUpdate(BaseModel):
    """Result returned after a device executes a command."""

    result_message: str | None = None