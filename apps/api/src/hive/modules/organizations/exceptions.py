from __future__ import annotations

import uuid


class OrganizationError(Exception):
    """Base exception for organization operations."""


class OrganizationNotFoundError(OrganizationError):
    """Raised when an organization cannot be found."""

    def __init__(self, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"Organization '{organization_id}' was not found."
        )


class OrganizationSlugAlreadyExistsError(OrganizationError):
    """Raised when an organization slug is already in use."""

    def __init__(self, slug: str) -> None:
        super().__init__(
            f"An organization with slug '{slug}' already exists."
        )


class OrganizationAccessDeniedError(OrganizationError):
    """Raised when a user cannot access an organization."""

    def __init__(self, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"You do not have access to organization "
            f"'{organization_id}'."
        )


class MembershipNotFoundError(OrganizationError):
    """Raised when an organization membership cannot be found."""


class MembershipAlreadyExistsError(OrganizationError):
    """Raised when a user already belongs to an organization."""