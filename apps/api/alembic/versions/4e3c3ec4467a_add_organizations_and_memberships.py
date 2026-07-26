"""Add organizations and memberships.

Revision ID: 4e3c3ec4467a
Revises: 5e20cedf32e4
Create Date: 2026-07-17 17:39:52.792566
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# Revision identifiers, used by Alembic.
revision: str = "4e3c3ec4467a"
down_revision: str | Sequence[str] | None = "5e20cedf32e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


organization_status_enum = postgresql.ENUM(
    "active",
    "suspended",
    "archived",
    name="organization_status",
    create_type=False,
)

membership_status_enum = postgresql.ENUM(
    "invited",
    "active",
    "suspended",
    "removed",
    name="membership_status",
    create_type=False,
)


def upgrade() -> None:
    """Create organizations and organization memberships."""

    bind = op.get_bind()

    organization_status_enum.create(bind, checkfirst=True)
    membership_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "organizations",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "slug",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "status",
            organization_status_enum,
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_organizations_slug"),
        "organizations",
        ["slug"],
        unique=True,
    )

    op.create_table(
        "organization_memberships",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "status",
            membership_status_enum,
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_organization_memberships_organization_user",
        ),
    )

    op.create_index(
        op.f("ix_organization_memberships_organization_id"),
        "organization_memberships",
        ["organization_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_organization_memberships_user_id"),
        "organization_memberships",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove organizations and organization memberships."""

    op.drop_index(
        op.f("ix_organization_memberships_user_id"),
        table_name="organization_memberships",
    )

    op.drop_index(
        op.f("ix_organization_memberships_organization_id"),
        table_name="organization_memberships",
    )

    op.drop_table("organization_memberships")

    op.drop_index(
        op.f("ix_organizations_slug"),
        table_name="organizations",
    )

    op.drop_table("organizations")

    bind = op.get_bind()

    membership_status_enum.drop(bind, checkfirst=True)
    organization_status_enum.drop(bind, checkfirst=True)