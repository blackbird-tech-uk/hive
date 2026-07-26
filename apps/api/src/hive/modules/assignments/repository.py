from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.assignments.models import Assignment


class AssignmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[Assignment]:
        return list(
            self.db.scalars(
                select(Assignment).order_by(Assignment.assigned_at.desc())
            )
        )

    def get(self, assignment_id: uuid.UUID) -> Assignment | None:
        return self.db.get(Assignment, assignment_id)

    def create(self, assignment: Assignment) -> Assignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def update(self, assignment: Assignment) -> Assignment:
        self.db.commit()
        self.db.refresh(assignment)
        return assignment