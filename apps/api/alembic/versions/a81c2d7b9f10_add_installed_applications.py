"""add installed applications

Revision ID: a81c2d7b9f10
Revises: 9ea448727eed
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "a81c2d7b9f10"
down_revision: Union[str, None] = "9ea448727eed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "installed_applications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("package_name", sa.String(length=255), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=True),
        sa.Column("version_name", sa.String(length=100), nullable=True),
        sa.Column("version_code", sa.BigInteger(), nullable=True),
        sa.Column(
            "is_system_app",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "first_installed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "device_id",
            "package_name",
            name="uq_installed_applications_device_package",
        ),
    )

    op.create_index(
        op.f("ix_installed_applications_device_id"),
        "installed_applications",
        ["device_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_installed_applications_organization_id"),
        "installed_applications",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_installed_applications_organization_id"),
        table_name="installed_applications",
    )
    op.drop_index(
        op.f("ix_installed_applications_device_id"),
        table_name="installed_applications",
    )
    op.drop_table("installed_applications")
