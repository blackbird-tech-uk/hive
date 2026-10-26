from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from hive.db.base import Base


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    RETURNED = "returned"
    LOST = "lost"
    REPAIR = "repair"


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    map_area_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("map_areas.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    assigned_to_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    assigned_location: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(
            AssignmentStatus,
            name="assignment_status",
            values_callable=lambda enum_class: [
                item.value for item in enum_class
            ],
        ),
        nullable=False,
        default=AssignmentStatus.ASSIGNED,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )