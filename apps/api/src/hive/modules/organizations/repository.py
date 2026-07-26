from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.organizations.models import (
    Organization,
    OrganizationMembership,
)


class OrganizationRepository:
    """Database operations for organizations and memberships."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add_organization(
        self,
        organization: Organization,
    ) -> None:
        self.db.add(organization)

    def add_membership(
        self,
        membership: OrganizationMembership,
    ) -> None:
        self.db.add(membership)

    def get_by_id(
        self,
        organization_id: uuid.UUID,
    ) -> Organization | None:
        statement = select(Organization).where(
            Organization.id == organization_id
        )

        return self.db.scalar(statement)

    def get_by_slug(
        self,
        slug: str,
    ) -> Organization | None:
        statement = select(Organization).where(
            Organization.slug == slug
        )

        return self.db.scalar(statement)

    def list_for_user(
        self,
        user_id: uuid.UUID,
    ) -> Sequence[Organization]:
        statement = (
            select(Organization)
            .join(
                OrganizationMembership,
                OrganizationMembership.organization_id == Organization.id,
            )
            .where(
                OrganizationMembership.user_id == user_id,
            )
            .order_by(Organization.name.asc())
        )

        return self.db.scalars(statement).all()

    def get_membership(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> OrganizationMembership | None:
        statement = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )

        return self.db.scalar(statement)