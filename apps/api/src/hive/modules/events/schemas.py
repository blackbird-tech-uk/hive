from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    venue: str = Field(min_length=1, max_length=150)
    start_date: date
    end_date: date
    status: str = Field(default="planned", min_length=1, max_length=30)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> EventCreate:
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date.")

        return self


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    venue: str | None = Field(default=None, min_length=1, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=30)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> EventUpdate:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("End date cannot be before start date.")

        return self


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    venue: str
    start_date: date
    end_date: date
    status: str
    notes: str | None