from datetime import datetime, timezone

from sqlalchemy.orm import Session

from hive.core.security import create_access_token, verify_password
from hive.modules.auth.schemas import TokenResponse
from hive.modules.users.models import User
from hive.modules.users.repository import UserRepository


class InvalidCredentialsError(Exception):
    """Raised when login credentials are invalid."""


class InactiveUserError(Exception):
    """Raised when an inactive user attempts to log in."""


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def authenticate(
        self,
        username: str,
        password: str,
    ) -> User:
        normalised_username = username.strip().lower()
        user = self.users.get_by_username(normalised_username)

        if user is None:
            raise InvalidCredentialsError

        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError

        if not user.is_active:
            raise InactiveUserError

        return user

    def login(
        self,
        username: str,
        password: str,
    ) -> TokenResponse:
        user = self.authenticate(username, password)

        token, expires_in = create_access_token(
            subject=str(user.id),
            additional_claims={
                "username": user.username,
                "role": user.role.value,
            },
        )

        user.last_login_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(user)

        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
        )