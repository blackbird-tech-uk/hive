from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from hive.modules.users.models import UserRole


class UserBase(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9._-]+$",
    )

    display_name: str = Field(
        min_length=2,
        max_length=150,
    )

    email: EmailStr | None = None

    job_title: str = Field(
        min_length=2,
        max_length=150,
    )

    role: UserRole


class UserCreate(UserBase):
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class UserUpdate(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9._-]+$",
    )

    display_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    email: EmailStr | None = None

    job_title: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    role: UserRole | None = None

    password: str | None = Field(
        default=None,
        min_length=8,
        max_length=128,
    )

    is_active: bool | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime