"""Regression coverage for scanner versus user JWT expiry."""

import jwt

from hive.core.config import settings
from hive.core.security import create_access_token


def test_device_token_lifetime_is_thirty_days():
    token, expires_in = create_access_token(
        "device-id",
        additional_claims={"type": "device"},
        expires_in_minutes=settings.device_token_expire_minutes,
    )
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    assert expires_in == 30 * 24 * 60 * 60
    assert payload["exp"] - payload["iat"] == expires_in
    assert payload["type"] == "device"


def test_user_token_lifetime_remains_unchanged():
    token, expires_in = create_access_token("user-id")
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    assert expires_in == settings.jwt_access_token_expire_minutes * 60
    assert payload["exp"] - payload["iat"] == expires_in
    assert payload["type"] == "access"
