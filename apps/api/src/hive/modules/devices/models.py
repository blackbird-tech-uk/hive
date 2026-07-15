from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from hive.db.base import Base


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class DeviceStatus(str, enum.Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    IN_USE = "in_use"
    REPAIR = "repair"
    RETIRED = "retired"


class DeviceCondition(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class Device(Base):
    """A physical Android device managed by Hive."""

    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    hive_id: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    asset_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    serial_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    imei: Mapped[str | None] = mapped_column(
        String(15),
        unique=True,
        nullable=True,
        index=True,
    )

    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Unitech EA660",
    )

    android_version: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    build_version: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="device_status"),
        nullable=False,
        default=DeviceStatus.AVAILABLE,
    )

    condition: Mapped[DeviceCondition] = mapped_column(
        Enum(DeviceCondition, name="device_condition"),
        nullable=False,
        default=DeviceCondition.GOOD,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )