"""add device management capabilities

Revision ID: d42ac83fe9b1
Revises: c31fd5a17b42
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d42ac83fe9b1"
down_revision: Union[str, None] = "c31fd5a17b42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


device_management_mode = sa.Enum(
    "standard",
    "device_admin",
    "device_owner",
    name="device_management_mode",
)


def upgrade() -> None:
    device_management_mode.create(
        op.get_bind(),
        checkfirst=True,
    )

    op.add_column(
        "devices",
        sa.Column(
            "management_mode",
            device_management_mode,
            nullable=False,
            server_default="standard",
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_device_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_device_owner",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "supports_lock_task",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "devices",
        "management_mode",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_device_admin",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_device_owner",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "supports_lock_task",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "devices",
        "supports_lock_task",
    )
    op.drop_column(
        "devices",
        "is_device_owner",
    )
    op.drop_column(
        "devices",
        "is_device_admin",
    )
    op.drop_column(
        "devices",
        "management_mode",
    )

    device_management_mode.drop(
        op.get_bind(),
        checkfirst=True,
    )
