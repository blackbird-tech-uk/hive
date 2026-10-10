from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from hive.core.security import decode_access_token
from hive.db.session import get_db
from hive.modules.device_agent.repository import DeviceAgentRepository
from hive.modules.devices.models import Device

bearer_scheme = HTTPBearer(auto_error=False)
DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_device(
    db: DatabaseSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> Device:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid, expired or revoked device token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_error

    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("type") != "device":
            raise credentials_error

        device_id = uuid.UUID(payload["sub"])
        organization_id = uuid.UUID(payload["organization_id"])
        token_version = int(payload["token_version"])
    except (
        jwt.InvalidTokenError,
        ValueError,
        KeyError,
        TypeError,
    ) as error:
        raise credentials_error from error

    device = DeviceAgentRepository(db).get_by_id(device_id)
    if device is None:
        raise credentials_error
    if device.organization_id != organization_id:
        raise credentials_error
    if device.device_token_version != token_version:
        raise credentials_error

    return device


CurrentDevice = Annotated[Device, Depends(get_current_device)]
