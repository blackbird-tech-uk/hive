"""reserve historical users migration revision

Revision ID: 8d8629f178c0
Revises: 93819c0b486a
Create Date: 2026-07-17 10:46:28.191040

The following revision, 5e20cedf32e4, creates the canonical Hive users schema.
This revision remains in the Alembic chain as a no-op so a fresh database does
not create the users table twice.
"""

from typing import Sequence, Union

revision: str = "8d8629f178c0"
down_revision: Union[str, Sequence[str], None] = "93819c0b486a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Users are created by the following canonical migration."""
    pass


def downgrade() -> None:
    """This revision applies no schema changes."""
    pass
