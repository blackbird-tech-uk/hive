"""add policy readiness state

Revision ID: e53b91c4d7a2
Revises: d42ac83fe9b1
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e53b91c4d7a2"
down_revision: Union[str, None] = "d42ac83fe9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column(
            "supports_device_lock",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_lock_task_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "devices",
        "supports_device_lock",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_lock_task_active",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("devices", "is_lock_task_active")
    op.drop_column("devices", "supports_device_lock")
