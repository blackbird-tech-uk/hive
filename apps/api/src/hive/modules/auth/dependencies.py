import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from hive.core.security import decode_access_token
from hive.db.session import get_db
from hive.modules.users.models import User
from hive.modules.users.repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_error

    try:
        payload = decode_access_token(credentials.credentials)
        subject = payload.get("sub")

        if not subject:
            raise credentials_error

        user_id = uuid.UUID(subject)

    except (jwt.InvalidTokenError, ValueError, TypeError) as error:
        raise credentials_error from error

    user = UserRepository(db).get_by_id(user_id)

    if user is None:
        raise credentials_error

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive.",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]