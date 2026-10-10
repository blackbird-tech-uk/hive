"""add ring device command

Revision ID: 9e9127f12236
Revises: 636de596787d
Create Date: 2026-07-28 19:29:44.736824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e9127f12236'
down_revision: Union[str, Sequence[str], None] = '636de596787d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
