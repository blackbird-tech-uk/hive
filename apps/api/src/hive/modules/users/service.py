from __future__ import annotations

import uuid
from collections.abc import Sequence

from pwdlib import PasswordHash
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.modules.users.models import User
from hive.modules.users.repository import UserRepository
from hive.modules.users.schemas import UserCreate, UserUpdate

password_hash = PasswordHash.recommended()


class UserAlreadyExistsError(Exception):
    """Raised when a username or email address already exists."""

    def __init__(self, field: str, value: str) -> None:
        super().__init__(f"A user with {field} '{value}' already exists.")


class UserNotFoundError(Exception):
    """Raised when a user cannot be found."""

    def __init__(self, user_id: object) -> None:
        super().__init__(f"User '{user_id}' was not found.")


class UserService:
    """Business rules for managing Hive users."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UserRepository(db)

    def create_user(self, payload: UserCreate) -> User:
        username = payload.username.strip().lower()
        display_name = payload.display_name.strip()
        email = payload.email.strip().lower() if payload.email else None

        if self.repository.get_by_username(username) is not None:
            raise UserAlreadyExistsError("username", username)

        if email and self.repository.get_by_email(email) is not None:
            raise UserAlreadyExistsError("email", email)

        user = User(
            username=username,
            display_name=display_name,
            email=email,
            job_title=payload.job_title.strip(),
            role=payload.role,
            password_hash=password_hash.hash(payload.password),
            is_active=True,
        )

        try:
            self.repository.add(user)
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise UserAlreadyExistsError("username", username) from None

        return user

    def list_users(self) -> Sequence[User]:
        return self.repository.list_all()

    def get_user(self, user_id: uuid.UUID) -> User:
        user = self.repository.get_by_id(user_id)

        if user is None:
            raise UserNotFoundError(user_id)

        return user

    def update_user(
        self,
        user_id: uuid.UUID,
        payload: UserUpdate,
    ) -> User:
        user = self.get_user(user_id)
        updates = payload.model_dump(exclude_unset=True)

        if "username" in updates:
            username = updates["username"].strip().lower()
            existing = self.repository.get_by_username(username)

            if existing is not None and existing.id != user.id:
                raise UserAlreadyExistsError("username", username)

            user.username = username

        if "display_name" in updates:
            user.display_name = updates["display_name"].strip()

        if "email" in updates:
            raw_email = updates["email"]
            email = raw_email.strip().lower() if raw_email else None

            if email:
                existing = self.repository.get_by_email(email)

                if existing is not None and existing.id != user.id:
                    raise UserAlreadyExistsError("email", email)

            user.email = email

        if "job_title" in updates:
            user.job_title = updates["job_title"].strip()

        if "role" in updates:
            user.role = updates["role"]

        if "is_active" in updates:
            user.is_active = updates["is_active"]

        if "password" in updates:
            user.password_hash = password_hash.hash(updates["password"])

        try:
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise UserAlreadyExistsError(
                "username",
                user.username,
            ) from None

        return user