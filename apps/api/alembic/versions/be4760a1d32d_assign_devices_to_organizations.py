"""Assign devices to organizations.

Revision ID: be4760a1d32d
Revises: 3f965ca30d17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "be4760a1d32d"
down_revision: str | Sequence[str] | None = "3f965ca30d17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Assign existing and future devices to an organization."""

    # Add the column as nullable first so existing rows remain valid.
    op.add_column(
        "devices",
        sa.Column(
            "organization_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    # Assign all existing devices to the Blackbird organization.
    bind = op.get_bind()

    blackbird_organization_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM organizations
            WHERE slug = :slug
            """
        ),
        {"slug": "blackbird"},
    ).scalar_one_or_none()

    if blackbird_organization_id is None:
        # Fresh installations have no bootstrap data yet. Seed the tenant that
        # this historical migration requires; bootstrap_alpha will reuse it.
        blackbird_organization_id = bind.execute(
            sa.text(
                """
                INSERT INTO organizations (
                    id, name, slug, status, created_at, updated_at
                )
                VALUES (
                    gen_random_uuid(), :name, :slug, :status,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING id
                """
            ),
            {
                "name": "Blackbird",
                "slug": "blackbird",
                "status": "active",
            },
        ).scalar_one()

    bind.execute(
        sa.text(
            """
            UPDATE devices
            SET organization_id = :organization_id
            WHERE organization_id IS NULL
            """
        ),
        {
            "organization_id": blackbird_organization_id,
        },
    )

    # Now that every existing row has an organization, make it required.
    op.alter_column(
        "devices",
        "organization_id",
        existing_type=sa.UUID(),
        nullable=False,
    )

    op.create_foreign_key(
        "fk_devices_organization_id_organizations",
        "devices",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        op.f("ix_devices_organization_id"),
        "devices",
        ["organization_id"],
        unique=False,
    )

    op.create_index(
        "ix_devices_organization_status",
        "devices",
        ["organization_id", "status"],
        unique=False,
    )

    # Remove the old globally unique indexes.
    op.drop_index(
        op.f("ix_devices_hive_id"),
        table_name="devices",
    )
    op.drop_index(
        op.f("ix_devices_asset_id"),
        table_name="devices",
    )
    op.drop_index(
        op.f("ix_devices_serial_number"),
        table_name="devices",
    )
    op.drop_index(
        op.f("ix_devices_imei"),
        table_name="devices",
    )

    # Identifiers are unique within an organization.
    op.create_unique_constraint(
        "uq_devices_organization_hive_id",
        "devices",
        ["organization_id", "hive_id"],
    )
    op.create_unique_constraint(
        "uq_devices_organization_asset_id",
        "devices",
        ["organization_id", "asset_id"],
    )
    op.create_unique_constraint(
        "uq_devices_organization_serial_number",
        "devices",
        ["organization_id", "serial_number"],
    )
    op.create_unique_constraint(
        "uq_devices_organization_imei",
        "devices",
        ["organization_id", "imei"],
    )


def downgrade() -> None:
    """Remove device organization ownership."""

    op.drop_constraint(
        "uq_devices_organization_imei",
        "devices",
        type_="unique",
    )
    op.drop_constraint(
        "uq_devices_organization_serial_number",
        "devices",
        type_="unique",
    )
    op.drop_constraint(
        "uq_devices_organization_asset_id",
        "devices",
        type_="unique",
    )
    op.drop_constraint(
        "uq_devices_organization_hive_id",
        "devices",
        type_="unique",
    )

    op.create_index(
        op.f("ix_devices_imei"),
        "devices",
        ["imei"],
        unique=True,
    )
    op.create_index(
        op.f("ix_devices_serial_number"),
        "devices",
        ["serial_number"],
        unique=True,
    )
    op.create_index(
        op.f("ix_devices_asset_id"),
        "devices",
        ["asset_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_devices_hive_id"),
        "devices",
        ["hive_id"],
        unique=True,
    )

    op.drop_index(
        "ix_devices_organization_status",
        table_name="devices",
    )
    op.drop_index(
        op.f("ix_devices_organization_id"),
        table_name="devices",
    )

    op.drop_constraint(
        "fk_devices_organization_id_organizations",
        "devices",
        type_="foreignkey",
    )

    op.drop_column(
        "devices",
        "organization_id",
    )