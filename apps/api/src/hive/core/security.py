from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash

from hive.core.config import settings

password_hash = PasswordHash.recommended()


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Check a plain password against its stored hash."""
    return password_hash.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(
    subject: str,
    additional_claims: dict[str, Any] | None = None,
    *,
    expires_in_minutes: int | None = None,
) -> tuple[str, int]:
    """Create a signed JWT access token."""
    lifetime_minutes = (
        expires_in_minutes
        if expires_in_minutes is not None
        else settings.jwt_access_token_expire_minutes
    )
    expires_in = lifetime_minutes * 60

    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=expires_in
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }

    if additional_claims:
        payload.update(additional_claims)

    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token."""
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )