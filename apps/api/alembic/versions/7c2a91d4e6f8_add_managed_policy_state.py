"""add managed policy state

Revision ID: 7c2a91d4e6f8
Revises: e53b91c4d7a2
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "7c2a91d4e6f8"
down_revision = "e53b91c4d7a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE device_command_type "
            "ADD VALUE IF NOT EXISTS 'SET_CAMERA_DISABLED'"
        )
        op.execute(
            "ALTER TYPE device_command_type "
            "ADD VALUE IF NOT EXISTS 'SET_LOCK_TIMEOUT'"
        )

    op.add_column(
        "devices",
        sa.Column(
            "supports_camera_policy",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "supports_lock_timeout_policy",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column("camera_disabled", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "devices",
        sa.Column(
            "maximum_time_to_lock_ms",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "desired_camera_disabled",
            sa.Boolean(),
            nullable=True,
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "desired_maximum_time_to_lock_ms",
            sa.Integer(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "devices",
        "desired_maximum_time_to_lock_ms",
    )
    op.drop_column("devices", "desired_camera_disabled")
    op.drop_column("devices", "maximum_time_to_lock_ms")
    op.drop_column("devices", "camera_disabled")
    op.drop_column(
        "devices",
        "supports_lock_timeout_policy",
    )
    op.drop_column("devices", "supports_camera_policy")

    # PostgreSQL enum values are intentionally retained on downgrade.