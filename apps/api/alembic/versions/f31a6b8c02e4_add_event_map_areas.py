"""Add persistent event map areas and scanner area references.

Revision ID: f31a6b8c02e4
Revises: 7c2a91d4e6f8
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f31a6b8c02e4"
down_revision: str | Sequence[str] | None = "7c2a91d4e6f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "map_areas",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "organization_id", sa.UUID(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id", sa.UUID(),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("points", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint(
            "organization_id", "event_id", "name",
            name="uq_map_areas_org_event_name",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(points) = 'array' AND jsonb_array_length(points) >= 3",
            name="ck_map_areas_polygon_min_points",
        ),
    )
    op.create_index("ix_map_areas_organization_id", "map_areas", ["organization_id"])
    op.create_index("ix_map_areas_event_id", "map_areas", ["event_id"])
    op.add_column("assignments", sa.Column("map_area_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_assignments_map_area_id", "assignments", "map_areas",
        ["map_area_id"], ["id"], ondelete="RESTRICT",
    )
    op.create_index("ix_assignments_map_area_id", "assignments", ["map_area_id"])
    op.execute("REVOKE ALL ON map_areas FROM anon, authenticated")


def downgrade() -> None:
    op.drop_index("ix_assignments_map_area_id", table_name="assignments")
    op.drop_constraint("fk_assignments_map_area_id", "assignments", type_="foreignkey")
    op.drop_column("assignments", "map_area_id")
    op.drop_index("ix_map_areas_event_id", table_name="map_areas")
    op.drop_index("ix_map_areas_organization_id", table_name="map_areas")
    op.drop_table("map_areas")
