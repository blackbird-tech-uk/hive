from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hive.db.base import Base

if TYPE_CHECKING:
    from hive.modules.devices.models import Device


def utc_now() -> datetime:
    """Return the current UTC time."""

    return datetime.now(UTC)


class DeviceLocation(Base):
    """A location reported by an enrolled device."""

    __tablename__ = "device_locations"

    __table_args__ = (
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_device_locations_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_device_locations_longitude",
        ),
        CheckConstraint(
            "accuracy IS NULL OR accuracy >= 0",
            name="ck_device_locations_accuracy",
        ),
        Index(
            "ix_device_locations_device_recorded_at",
            "device_id",
            "recorded_at",
        ),
        Index(
            "ix_device_locations_organization_recorded_at",
            "organization_id",
            "recorded_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
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

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    accuracy: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    altitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    speed: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    bearing: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    provider: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    device: Mapped["Device"] = relationship(
        "Device",
        back_populates="locations",
    )