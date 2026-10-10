from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from hive.db.base import Base


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class EnrollmentToken(Base):
    """A secure, limited-use token for enrolling devices."""

    __tablename__ = "enrollment_tokens"

    __table_args__ = (
        CheckConstraint(
            "max_uses > 0",
            name="ck_enrollment_tokens_max_uses_positive",
        ),
        CheckConstraint(
            "use_count >= 0",
            name="ck_enrollment_tokens_use_count_non_negative",
        ),
        CheckConstraint(
            "use_count <= max_uses",
            name="ck_enrollment_tokens_use_count_not_over_limit",
        ),
        Index(
            "ix_enrollment_tokens_organization_active",
            "organization_id",
            "revoked_at",
            "expires_at",
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

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    token_prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    label: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    max_uses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    use_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )