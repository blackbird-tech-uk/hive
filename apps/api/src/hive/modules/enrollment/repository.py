from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.enrollment.models import EnrollmentToken
from hive.modules.organizations.models import (
    MembershipStatus,
    OrganizationMembership,
)
from hive.modules.rbac.models import (
    MembershipRole,
    Permission,
    RolePermission,
)


class EnrollmentRepository:
    """Database access for enrollment tokens."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(
        self,
        enrollment_token: EnrollmentToken,
    ) -> EnrollmentToken:
        self.db.add(enrollment_token)
        self.db.flush()

        return enrollment_token

    def get_by_id(
        self,
        *,
        organization_id: uuid.UUID,
        token_id: uuid.UUID,
    ) -> EnrollmentToken | None:
        statement = select(EnrollmentToken).where(
            EnrollmentToken.id == token_id,
            EnrollmentToken.organization_id == organization_id,
        )

        return self.db.scalar(statement)

    def get_by_hash(
        self,
        token_hash: str,
    ) -> EnrollmentToken | None:
        statement = select(EnrollmentToken).where(
            EnrollmentToken.token_hash == token_hash
        )

        return self.db.scalar(statement)

    def get_by_hash_for_update(
        self,
        token_hash: str,
    ) -> EnrollmentToken | None:
        """Lock a token row while it is being redeemed."""

        statement = (
            select(EnrollmentToken)
            .where(
                EnrollmentToken.token_hash == token_hash
            )
            .with_for_update()
        )

        return self.db.scalar(statement)

    def list_for_organization(
        self,
        organization_id: uuid.UUID,
    ) -> Sequence[EnrollmentToken]:
        statement = (
            select(EnrollmentToken)
            .where(
                EnrollmentToken.organization_id == organization_id
            )
            .order_by(EnrollmentToken.created_at.desc())
        )

        return self.db.scalars(statement).all()

    def user_has_permission(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        permission_code: str,
    ) -> bool:
        statement = (
            select(Permission.id)
            .join(
                RolePermission,
                RolePermission.permission_id == Permission.id,
            )
            .join(
                MembershipRole,
                MembershipRole.role_id == RolePermission.role_id,
            )
            .join(
                OrganizationMembership,
                OrganizationMembership.id
                == MembershipRole.membership_id,
            )
            .where(
                OrganizationMembership.organization_id
                == organization_id,
                OrganizationMembership.user_id == user_id,
                OrganizationMembership.status
                == MembershipStatus.ACTIVE,
                Permission.code == permission_code,
            )
            .limit(1)
        )

        return self.db.scalar(statement) is not None