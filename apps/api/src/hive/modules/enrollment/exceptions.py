from __future__ import annotations

import uuid


class EnrollmentError(Exception):
    """Base exception for enrollment operations."""


class EnrollmentPermissionDeniedError(EnrollmentError):
    """Raised when a user lacks enrollment permissions."""

    def __init__(self, permission_code: str) -> None:
        super().__init__(
            f"Permission '{permission_code}' is required."
        )


class EnrollmentTokenNotFoundError(EnrollmentError):
    """Raised when an administrative token lookup fails."""

    def __init__(self, token_id: uuid.UUID) -> None:
        super().__init__(
            f"Enrollment token '{token_id}' was not found."
        )


class EnrollmentTokenAlreadyRevokedError(EnrollmentError):
    """Raised when an administrator revokes a token twice."""

    def __init__(self, token_id: uuid.UUID) -> None:
        super().__init__(
            f"Enrollment token '{token_id}' is already revoked."
        )


class InvalidEnrollmentTokenError(EnrollmentError):
    """Raised when a plaintext enrollment token is unknown."""

    def __init__(self) -> None:
        super().__init__("The enrollment token is invalid.")


class EnrollmentTokenExpiredError(EnrollmentError):
    """Raised when an enrollment token has expired."""

    def __init__(self) -> None:
        super().__init__("The enrollment token has expired.")


class EnrollmentTokenRevokedError(EnrollmentError):
    """Raised when an enrollment token has been revoked."""

    def __init__(self) -> None:
        super().__init__("The enrollment token has been revoked.")


class EnrollmentTokenExhaustedError(EnrollmentError):
    """Raised when a token has reached its usage limit."""

    def __init__(self) -> None:
        super().__init__(
            "The enrollment token has reached its usage limit."
        )


class EnrolledDeviceAlreadyExistsError(EnrollmentError):
    """Raised when the submitted device identifiers already exist."""

    def __init__(self, field: str, value: str) -> None:
        super().__init__(
            f"A device with {field} '{value}' already exists."
        )