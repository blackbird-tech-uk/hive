from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from hive.db.base import Base


class DeviceCommandType(str, enum.Enum):
    LOCK_DEVICE = "LOCK_DEVICE"
    SET_CAMERA_DISABLED = "SET_CAMERA_DISABLED"
    SET_LOCK_TIMEOUT = "SET_LOCK_TIMEOUT"
    REBOOT = "REBOOT"
    SYNC = "SYNC"
    PING = "PING"
    RING = "RING"
    REFRESH_APPS = "REFRESH_APPS"
    LAUNCH_APP = "LAUNCH_APP"
    FORCE_STOP_APP = "FORCE_STOP_APP"
    UNINSTALL_APP = "UNINSTALL_APP"
    SHOW_MESSAGE = "SHOW_MESSAGE"
    REQUEST_LOCATION = "REQUEST_LOCATION"


class DeviceCommandStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    COMPLETED = "completed"
    FAILED = "failed"


class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "devices.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    command: Mapped[DeviceCommandType] = mapped_column(
        Enum(
            DeviceCommandType,
            name="device_command_type",
        ),
        nullable=False,
    )

    payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    status: Mapped[DeviceCommandStatus] = mapped_column(
        Enum(
            DeviceCommandStatus,
            name="device_command_status",
        ),
        nullable=False,
        default=DeviceCommandStatus.PENDING,
        index=True,
    )

    result_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
