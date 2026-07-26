from __future__ import annotations


class DeviceAgentError(Exception):
    """Base error for device-agent operations."""


class InvalidDeviceTokenError(DeviceAgentError):
    """Raised when a device JWT is missing, invalid or expired."""

    def __init__(self) -> None:
        super().__init__(
            "The device authentication token is invalid or expired."
        )


class InvalidDeviceTokenTypeError(DeviceAgentError):
    """Raised when a user token is used against the device-agent API."""

    def __init__(self) -> None:
        super().__init__(
            "This endpoint requires a device authentication token."
        )


class DeviceNotFoundError(DeviceAgentError):
    """Raised when the authenticated device no longer exists."""

    def __init__(self) -> None:
        super().__init__(
            "The authenticated device could not be found."
        )


class DeviceTokenRevokedError(DeviceAgentError):
    """Raised when a device JWT has been invalidated."""

    def __init__(self) -> None:
        super().__init__(
            "The device authentication token has been revoked."
        )


class DeviceOrganizationMismatchError(DeviceAgentError):
    """Raised when the JWT organization does not match the device."""

    def __init__(self) -> None:
        super().__init__(
            "The device does not belong to the token organization."
        )


class InvalidHeartbeatError(DeviceAgentError):
    """Raised when heartbeat data cannot be accepted."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)