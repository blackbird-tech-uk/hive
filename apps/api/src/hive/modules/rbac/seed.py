from __future__ import annotations

import argparse
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.db.session import SessionLocal
from hive.modules.devices.models import Device
from hive.modules.organizations.models import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
)
from hive.modules.rbac.models import (
    MembershipRole,
    Permission,
    Role,
    RolePermission,
)
from hive.modules.users.models import User


PERMISSIONS: tuple[tuple[str, str, str], ...] = (
    (
        "organization.read",
        "View organization",
        "View organization information.",
    ),
    (
        "organization.update",
        "Update organization",
        "Update organization settings.",
    ),
    (
        "members.read",
        "View members",
        "View organization members.",
    ),
    (
        "members.manage",
        "Manage members",
        "Invite, update and remove organization members.",
    ),
    (
        "roles.read",
        "View roles",
        "View roles and permissions.",
    ),
    (
        "roles.manage",
        "Manage roles",
        "Create, update and assign roles.",
    ),
    (
        "devices.read",
        "View devices",
        "View devices belonging to the organization.",
    ),
    (
        "devices.create",
        "Create devices",
        "Register devices within the organization.",
    ),
    (
        "devices.update",
        "Update devices",
        "Update device information and settings.",
    ),
    (
        "devices.delete",
        "Delete devices",
        "Remove devices from the organization.",
    ),
    (
        "devices.command",
        "Send device commands",
        "Send supported remote commands to devices.",
    ),
    (
        "enrollment.manage",
        "Manage device enrollment",
        "Create, view and revoke device enrollment tokens.",
    ),
    (
        "audit.read",
        "View audit log",
        "View organization audit events.",
    ),
)


ROLE_PERMISSIONS: dict[str, tuple[str, ...]] = {
    "owner": tuple(
        permission_code
        for permission_code, _, _ in PERMISSIONS
    ),
    "admin": (
        "organization.read",
        "organization.update",
        "members.read",
        "members.manage",
        "roles.read",
        "roles.manage",
        "devices.read",
        "devices.create",
        "devices.update",
        "devices.delete",
        "devices.command",
        "enrollment.manage",
        "audit.read",
    ),
    "manager": (
        "organization.read",
        "members.read",
        "roles.read",
        "devices.read",
        "devices.create",
        "devices.update",
        "devices.command",
        "audit.read",
    ),
    "technician": (
        "organization.read",
        "devices.read",
        "devices.create",
        "devices.update",
        "devices.command",
    ),
    "viewer": (
        "organization.read",
        "members.read",
        "roles.read",
        "devices.read",
        "audit.read",
    ),
}


ROLE_DETAILS: dict[str, tuple[str, str]] = {
    "owner": (
        "Owner",
        "Full control of the organization and its resources.",
    ),
    "admin": (
        "Administrator",
        "Administrative access to members, roles and devices.",
    ),
    "manager": (
        "Manager",
        "Operational management of devices and reporting.",
    ),
    "technician": (
        "Technician",
        "Register, maintain and control managed devices.",
    ),
    "viewer": (
        "Viewer",
        "Read-only access to organization information.",
    ),
}


def get_organization(
    db: Session,
    organization_slug: str,
) -> Organization:
    statement = select(Organization).where(
        Organization.slug == organization_slug
    )

    organization = db.scalar(statement)

    if organization is None:
        raise RuntimeError(
            f"Organization '{organization_slug}' was not found."
        )

    return organization


def get_user(
    db: Session,
    username: str,
) -> User:
    statement = select(User).where(
        User.username == username
    )

    user = db.scalar(statement)

    if user is None:
        raise RuntimeError(
            f"User '{username}' was not found."
        )

    return user


def seed_permissions(
    db: Session,
) -> dict[str, Permission]:
    permission_map: dict[str, Permission] = {}

    for code, name, description in PERMISSIONS:
        statement = select(Permission).where(
            Permission.code == code
        )

        permission = db.scalar(statement)

        if permission is None:
            permission = Permission(
                code=code,
                name=name,
                description=description,
            )
            db.add(permission)
        else:
            permission.name = name
            permission.description = description

        permission_map[code] = permission

    db.flush()

    return permission_map


def seed_roles(
    db: Session,
    organization: Organization,
    permissions: dict[str, Permission],
) -> dict[str, Role]:
    role_map: dict[str, Role] = {}

    for slug, permission_codes in ROLE_PERMISSIONS.items():
        name, description = ROLE_DETAILS[slug]

        statement = select(Role).where(
            Role.organization_id == organization.id,
            Role.slug == slug,
        )

        role = db.scalar(statement)

        if role is None:
            role = Role(
                organization_id=organization.id,
                name=name,
                slug=slug,
                description=description,
                is_system=True,
            )
            db.add(role)
            db.flush()
        else:
            role.name = name
            role.description = description
            role.is_system = True

        role_map[slug] = role

        for permission_code in permission_codes:
            permission = permissions[permission_code]

            existing_statement = select(RolePermission).where(
                RolePermission.role_id == role.id,
                RolePermission.permission_id == permission.id,
            )

            existing = db.scalar(existing_statement)

            if existing is None:
                db.add(
                    RolePermission(
                        role_id=role.id,
                        permission_id=permission.id,
                    )
                )

    db.flush()

    return role_map


def assign_owner_role(
    db: Session,
    *,
    organization: Organization,
    user: User,
    owner_role: Role,
) -> None:
    membership_statement = select(
        OrganizationMembership
    ).where(
        OrganizationMembership.organization_id
        == organization.id,
        OrganizationMembership.user_id == user.id,
    )

    membership = db.scalar(membership_statement)

    if membership is None:
        raise RuntimeError(
            f"User '{user.username}' is not a member of "
            f"organization '{organization.slug}'."
        )

    if membership.status is not MembershipStatus.ACTIVE:
        raise RuntimeError(
            f"Membership for '{user.username}' is not active."
        )

    assignment_statement = select(MembershipRole).where(
        MembershipRole.membership_id == membership.id,
        MembershipRole.role_id == owner_role.id,
    )

    assignment = db.scalar(assignment_statement)

    if assignment is None:
        db.add(
            MembershipRole(
                membership_id=membership.id,
                role_id=owner_role.id,
            )
        )


def seed_rbac(
    *,
    organization_slug: str,
    owner_username: str,
) -> None:
    db = SessionLocal()

    try:
        organization = get_organization(
            db,
            organization_slug.strip().lower(),
        )

        user = get_user(
            db,
            owner_username.strip().lower(),
        )

        permissions = seed_permissions(db)

        roles = seed_roles(
            db,
            organization,
            permissions,
        )

        assign_owner_role(
            db,
            organization=organization,
            user=user,
            owner_role=roles["owner"],
        )

        db.commit()

        print(
            f"RBAC seeded successfully for "
            f"'{organization.slug}'."
        )
        print(
            f"User '{user.username}' has been assigned "
            f"the Owner role."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def parse_arguments(
    arguments: Sequence[str] | None = None,
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed Hive organization RBAC data."
    )

    parser.add_argument(
        "--organization-slug",
        required=True,
    )

    parser.add_argument(
        "--owner-username",
        required=True,
    )

    return parser.parse_args(arguments)


def main() -> None:
    arguments = parse_arguments()

    seed_rbac(
        organization_slug=arguments.organization_slug,
        owner_username=arguments.owner_username,
    )


if __name__ == "__main__":
    main()