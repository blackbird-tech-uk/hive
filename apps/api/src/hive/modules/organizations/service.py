from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.modules.organizations.exceptions import (
    OrganizationAccessDeniedError,
    OrganizationNotFoundError,
    OrganizationSlugAlreadyExistsError,
)
from hive.modules.organizations.models import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationStatus,
)
from hive.modules.organizations.repository import OrganizationRepository
from hive.modules.organizations.schemas import OrganizationCreate
from hive.modules.users.models import User


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class OrganizationService:
    """Business rules for managing Hive organizations."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = OrganizationRepository(db)

    def create_organization(
        self,
        *,
        payload: OrganizationCreate,
        actor: User,
    ) -> Organization:
        name = " ".join(payload.name.split())
        slug = payload.slug.strip().lower()

        if self.repository.get_by_slug(slug) is not None:
            raise OrganizationSlugAlreadyExistsError(slug)

        organization = Organization(
            name=name,
            slug=slug,
            status=OrganizationStatus.ACTIVE,
        )

        membership = OrganizationMembership(
            organization=organization,
            user_id=actor.id,
            status=MembershipStatus.ACTIVE,
            joined_at=utc_now(),
        )

        try:
            self.repository.add_organization(organization)
            self.repository.add_membership(membership)

            # Flush validates database constraints while retaining
            # control of the overall transaction.
            self.db.flush()

            self.db.commit()
            self.db.refresh(organization)
        except IntegrityError:
            self.db.rollback()
            raise OrganizationSlugAlreadyExistsError(slug) from None
        except Exception:
            self.db.rollback()
            raise

        return organization

    def list_organizations_for_user(
        self,
        *,
        actor: User,
    ) -> Sequence[Organization]:
        return self.repository.list_for_user(actor.id)

    def get_organization_for_user(
        self,
        *,
        organization_id: uuid.UUID,
        actor: User,
    ) -> Organization:
        organization = self.repository.get_by_id(organization_id)

        # Do not reveal whether an inaccessible tenant exists.
        if organization is None:
            raise OrganizationNotFoundError(organization_id)

        membership = self.repository.get_membership(
            organization_id=organization_id,
            user_id=actor.id,
        )

        if (
            membership is None
            or membership.status is not MembershipStatus.ACTIVE
        ):
            raise OrganizationAccessDeniedError(organization_id)

        if organization.status is not OrganizationStatus.ACTIVE:
            raise OrganizationAccessDeniedError(organization_id)

        return organization