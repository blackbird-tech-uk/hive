"""add ping device command

Revision ID: 636de596787d
Revises: 2b4f1946acfd
Create Date: 2026-07-28
"""

from collections.abc import Sequence

from alembic import op


revision: str = "636de596787d"
down_revision: str | None = "2b4f1946acfd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TYPE device_command_type
        ADD VALUE IF NOT EXISTS 'PING'
        """
    )


def downgrade() -> None:
    # Removing a value from a PostgreSQL enum requires rebuilding the enum.
    pass