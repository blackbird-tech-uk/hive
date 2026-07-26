from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hive.db.base import Base

if TYPE_CHECKING:
    from hive.modules.organizations.models import Organization


def utc_now() -> datetime:
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
    __tablename__ = "devices"

    __table_args__ = (
        UniqueConstraint("organization_id", "hive_id", name="uq_devices_organization_hive_id"),
        UniqueConstraint("organization_id", "asset_id", name="uq_devices_organization_asset_id"),
        UniqueConstraint("organization_id", "serial_number", name="uq_devices_organization_serial_number"),
        UniqueConstraint("organization_id", "imei", name="uq_devices_organization_imei"),
        Index("ix_devices_organization_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    hive_id: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False)
    imei: Mapped[str | None] = mapped_column(String(15), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="Unitech EA660")
    android_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    build_version: Mapped[str | None] = mapped_column(String(100), nullable=True)

    agent_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_charging: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    wifi_ssid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    status: Mapped[DeviceStatus] = mapped_column(
        Enum(
            DeviceStatus,
            name="device_status",
            values_callable=lambda enum_class: [member.name for member in enum_class],
        ),
        nullable=False,
        default=DeviceStatus.AVAILABLE,
    )

    condition: Mapped[DeviceCondition] = mapped_column(
        Enum(
            DeviceCondition,
            name="device_condition",
            values_callable=lambda enum_class: [member.name for member in enum_class],
        ),
        nullable=False,
        default=DeviceCondition.GOOD,
    )

    device_token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="devices",
    )