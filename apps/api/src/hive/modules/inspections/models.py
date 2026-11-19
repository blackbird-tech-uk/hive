from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from hive.db.base import Base


class ScannerInspection(Base):
    __tablename__ = "scanner_inspections"
    __table_args__ = (
        Index(
            "ix_scanner_inspections_device_time",
            "organization_id",
            "device_id",
            "inspected_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    inspected_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    hive_connection_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    chrome_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    smartscan_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    google_play_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    battery_charging_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
