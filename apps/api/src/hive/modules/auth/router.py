from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.auth.schemas import LoginRequest, TokenResponse
from hive.modules.auth.service import (
    AuthService,
    InactiveUserError,
    InvalidCredentialsError,
)
from hive.modules.users.schemas import UserResponse

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    db: DbSession,
) -> TokenResponse:
    service = AuthService(db)

    try:
        return service.login(
            username=payload.username,
            password=payload.password,
        )

    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    except InactiveUserError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive.",
        ) from error


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: CurrentUser,
) -> UserResponse:
    return UserResponse.model_validate(current_user)