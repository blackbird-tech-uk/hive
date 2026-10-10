from __future__ import annotations

import argparse
import os
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import select

from hive.db.session import SessionLocal
from hive.modules.organizations.models import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationStatus,
)
from hive.modules.rbac.seed import seed_permissions, seed_roles, assign_owner_role
from hive.modules.users.models import User, UserRole
from hive.modules.users.service import password_hash

PASSWORD_ENV_VAR = "HIVE_BOOTSTRAP_PASSWORD"


def bootstrap_alpha(
    *,
    username: str,
    display_name: str,
    job_title: str,
    organization_name: str,
    organization_slug: str,
) -> None:
    password = os.environ.get(PASSWORD_ENV_VAR)
    if not password or len(password) < 8:
        raise RuntimeError(
            f"{PASSWORD_ENV_VAR} must be set and contain at least 8 characters."
        )

    username = username.strip().lower()
    organization_slug = organization_slug.strip().lower()
    now = datetime.now(timezone.utc)
    db = SessionLocal()

    try:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(
                username=username,
                display_name=display_name.strip(),
                email=None,
                job_title=job_title.strip(),
                role=UserRole.SYSTEM_ADMINISTRATOR,
                password_hash=password_hash.hash(password),
                is_active=True,
            )
            db.add(user)
            db.flush()
        elif user.role is not UserRole.SYSTEM_ADMINISTRATOR:
            raise RuntimeError(
                f"Existing user '{username}' is not a system administrator."
            )

        organization = db.scalar(
            select(Organization).where(Organization.slug == organization_slug)
        )
        if organization is None:
            organization = Organization(
                name=organization_name.strip(),
                slug=organization_slug,
                status=OrganizationStatus.ACTIVE,
            )
            db.add(organization)
            db.flush()

        membership = db.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.user_id == user.id,
            )
        )
        if membership is None:
            membership = OrganizationMembership(
                organization_id=organization.id,
                user_id=user.id,
                status=MembershipStatus.ACTIVE,
                joined_at=now,
            )
            db.add(membership)
            db.flush()
        elif membership.status is not MembershipStatus.ACTIVE:
            raise RuntimeError("Existing owner membership is not active.")

        permissions = seed_permissions(db)
        roles = seed_roles(db, organization, permissions)
        assign_owner_role(
            db,
            organization=organization,
            user=user,
            owner_role=roles["owner"],
        )

        db.commit()
        print(f"Alpha bootstrap complete for '{username}'.")
        print(f"Organization '{organization_slug}' is ready.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def parse_arguments(
    arguments: Sequence[str] | None = None,
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap Hive Alpha with one system administrator."
    )
    parser.add_argument("--username", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--job-title", default="System Administrator")
    parser.add_argument("--organization-name", default="Blackbird")
    parser.add_argument("--organization-slug", default="blackbird")
    return parser.parse_args(arguments)


def main() -> None:
    arguments = parse_arguments()
    bootstrap_alpha(
        username=arguments.username,
        display_name=arguments.display_name,
        job_title=arguments.job_title,
        organization_name=arguments.organization_name,
        organization_slug=arguments.organization_slug,
    )


if __name__ == "__main__":
    main()
