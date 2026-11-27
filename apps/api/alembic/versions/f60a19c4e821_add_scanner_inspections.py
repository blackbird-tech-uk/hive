"""Add scanner inspection history."""

import sqlalchemy as sa
from alembic import op

revision = "f60a19c4e821"
down_revision = "7c2a91d4e6f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scanner_inspections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.Uuid(), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inspected_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hive_connection_ok", sa.Boolean(), nullable=False),
        sa.Column("chrome_ok", sa.Boolean(), nullable=False),
        sa.Column("smartscan_ok", sa.Boolean(), nullable=False),
        sa.Column("google_play_ok", sa.Boolean(), nullable=False),
        sa.Column("battery_charging_ok", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.String(2000), nullable=True),
    )
    op.create_index(
        "ix_scanner_inspections_device_time",
        "scanner_inspections",
        ["organization_id", "device_id", "inspected_at"],
    )
    op.execute("ALTER TABLE scanner_inspections ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_scanner_inspections_device_time", table_name="scanner_inspections")
    op.drop_table("scanner_inspections")
