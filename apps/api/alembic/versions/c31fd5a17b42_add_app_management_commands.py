"""add app management commands

Revision ID: c31fd5a17b42
Revises: a81c2d7b9f10
Create Date: 2026-08-12
"""

from typing import Sequence, Union
from alembic import op

revision: str = "c31fd5a17b42"
down_revision: Union[str, None] = "a81c2d7b9f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'LAUNCH_APP'"
    )
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'FORCE_STOP_APP'"
    )
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'UNINSTALL_APP'"
    )


def downgrade() -> None:
    # PostgreSQL cannot safely drop enum members without rebuilding
    # dependent columns. Retaining these values is safe.
    pass
