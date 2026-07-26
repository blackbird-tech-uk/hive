"""add device enrollment metadata

Revision ID: 5ba9b380cc24
Revises: 91e8f71ce976
Create Date: 2026-07-23 10:36:14.924796
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5ba9b380cc24"
down_revision: Union[str, Sequence[str], None] = "91e8f71ce976"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "devices",
        sa.Column(
            "manufacturer",
            sa.String(length=100),
            nullable=True,
        ),
    )

    # Temporary server_default backfills existing rows.
    op.add_column(
        "devices",
        sa.Column(
            "device_token_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )

    op.add_column(
        "devices",
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "devices",
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Remove the DB default. Future inserts use the SQLAlchemy model default.
    op.alter_column(
        "devices",
        "device_token_version",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("devices", "last_seen_at")
    op.drop_column("devices", "enrolled_at")
    op.drop_column("devices", "device_token_version")
    op.drop_column("devices", "manufacturer")