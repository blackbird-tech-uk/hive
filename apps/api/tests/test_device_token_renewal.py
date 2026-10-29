"""Device JWT renewal regression tests (no database required)."""

from unittest.mock import Mock, patch
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from hive.core.config import settings
from hive.core.security import create_access_token
from hive.modules.enrollment.router import renew_device_token


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_renewal_preserves_device_identity_and_revocation_version():
    device_id, organization_id = uuid4(), uuid4()
    old, _ = create_access_token(
        str(device_id),
        additional_claims={
            "type": "device",
            "organization_id": str(organization_id),
            "token_version": 4,
        },
        expires_in_minutes=5,
    )
    device = Mock(id=device_id, organization_id=organization_id,
                  hive_id="HB-6D4480", device_token_version=4)
    with patch("hive.modules.enrollment.router.DeviceRepository") as repo:
        repo.return_value.get_by_id.return_value = device
        response = renew_device_token(db=Mock(), credentials=credentials(old))
    claims = jwt.decode(response.device_token, settings.jwt_secret_key,
                        algorithms=[settings.jwt_algorithm])
    assert claims["sub"] == str(device_id)
    assert claims["organization_id"] == str(organization_id)
    assert claims["token_version"] == 4
    assert response.expires_in == settings.device_token_expire_minutes * 60


@pytest.mark.parametrize("kind", ["access", "device"])
def test_renewal_rejects_wrong_type_or_revoked_device(kind):
    device_id, organization_id = uuid4(), uuid4()
    token, _ = create_access_token(
        str(device_id),
        additional_claims={
            "type": kind,
            "organization_id": str(organization_id),
            "token_version": 3,
        },
    )
    with patch("hive.modules.enrollment.router.DeviceRepository") as repo:
        repo.return_value.get_by_id.return_value = Mock(
            device_token_version=4
        )
        with pytest.raises(HTTPException) as exc:
            renew_device_token(db=Mock(), credentials=credentials(token))
    assert exc.value.status_code == 401


def test_renewal_rejects_expired_token():
    token, _ = create_access_token(
        str(uuid4()),
        additional_claims={
            "type": "device",
            "organization_id": str(uuid4()),
            "token_version": 1,
        },
        expires_in_minutes=-1,
    )
    with pytest.raises(HTTPException) as exc:
        renew_device_token(db=Mock(), credentials=credentials(token))
    assert exc.value.status_code == 401


def test_renewal_requires_bearer_credentials():
    with pytest.raises(HTTPException) as exc:
        renew_device_token(db=Mock(), credentials=None)
    assert exc.value.status_code == 401
