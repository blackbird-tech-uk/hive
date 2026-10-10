from __future__ import annotations

from sqlalchemy.orm import Session

from hive.modules.assignments.models import Assignment
from hive.modules.assignments.repository import AssignmentRepository
from hive.modules.assignments.schemas import AssignmentCreate
from hive.modules.devices.models import DeviceStatus
from hive.modules.devices.repository import DeviceRepository
from hive.modules.events.repository import EventRepository


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db

        self.assignment_repository = AssignmentRepository(db)
        self.device_repository = DeviceRepository(db)
        self.event_repository = EventRepository(db)

    def list(self) -> list[Assignment]:
        return self.assignment_repository.list()

    def create(self, payload: AssignmentCreate) -> Assignment:
        device = self.device_repository.get_by_id(payload.device_id)

        if device is None:
            raise ValueError("Device not found.")

        event = self.event_repository.get_by_id(payload.event_id)

        if event is None:
            raise ValueError("Event not found.")

        if device.status != DeviceStatus.AVAILABLE:
            raise ValueError("Device is not available.")

        assignment = Assignment(
            device_id=payload.device_id,
            event_id=payload.event_id,
            assigned_to_name=payload.assigned_to_name,
            assigned_location=payload.assigned_location,
            notes=payload.notes,
        )

        device.status = DeviceStatus.ASSIGNED

        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)

        return assignment