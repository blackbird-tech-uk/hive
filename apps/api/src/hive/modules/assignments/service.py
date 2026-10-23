from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.assignments.models import Assignment, AssignmentStatus
from hive.modules.assignments.repository import AssignmentRepository
from hive.modules.assignments.schemas import AssignmentCreate
from hive.modules.devices.models import Device, DeviceStatus
from hive.modules.devices.repository import DeviceRepository
from hive.modules.events.repository import EventRepository
from hive.modules.map_areas.models import MapArea
from hive.modules.organizations.exceptions import (
    OrganizationAccessDeniedError,
    OrganizationNotFoundError,
)
from hive.modules.organizations.service import OrganizationService
from hive.modules.users.models import User, UserRole


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db

        self.assignment_repository = AssignmentRepository(db)
        self.device_repository = DeviceRepository(db)
        self.event_repository = EventRepository(db)

    def list(self, actor: User) -> list[Assignment]:
        # Only expose assignments belonging to organisations the actor can access.
        memberships = actor.organization_memberships
        allowed = [m.organization_id for m in memberships if m.status.value == 'active']
        return list(self.db.scalars(
            select(Assignment).join(Device, Assignment.device_id == Device.id)
            .where(Device.organization_id.in_(allowed))
        ).all())

    def create(self, payload: AssignmentCreate, actor: User) -> Assignment:
        device = self.db.get(Device, payload.device_id, with_for_update=True)

        if device is None:
            raise ValueError("Device not found.")

        try:
            OrganizationService(self.db).get_organization_for_user(
                organization_id=device.organization_id, actor=actor,
            )
        except (OrganizationAccessDeniedError, OrganizationNotFoundError) as exc:
            raise PermissionError('Organisation access denied.') from exc
        if actor.role == UserRole.READ_ONLY:
            raise PermissionError('Read-only users cannot assign scanners.')

        event = self.event_repository.get_by_id(payload.event_id)

        if event is None or event.organization_id != device.organization_id:
            raise ValueError("Event not found for this organisation.")

        existing = self.db.scalar(select(Assignment.id).where(
            Assignment.device_id == payload.device_id,
            Assignment.status == AssignmentStatus.ASSIGNED,
        ))
        if existing is not None:
            raise ValueError("Scanner already has an active assignment.")

        if device.status != DeviceStatus.AVAILABLE:
            raise ValueError("Device is not available.")

        area = None
        if payload.map_area_id is not None:
            area = self.db.scalar(select(MapArea).where(
                MapArea.id == payload.map_area_id,
                MapArea.organization_id == device.organization_id,
                MapArea.event_id == payload.event_id,
            ))
            if area is None:
                raise ValueError('Allocated area not found for this organisation and event.')

        assignment = Assignment(
            device_id=payload.device_id,
            event_id=payload.event_id,
            assigned_to_name=payload.assigned_to_name,
            map_area_id=area.id if area else None,
            assigned_location=area.name if area else payload.assigned_location,
            notes=payload.notes,
        )

        device.status = DeviceStatus.ASSIGNED

        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)

        return assignment

    def move_area(self, assignment_id: uuid.UUID, area_id: uuid.UUID, actor: User) -> Assignment:
        assignment = self.db.get(Assignment, assignment_id)
        if assignment is None:
            raise ValueError("Assignment not found.")
        device = self.db.get(Device, assignment.device_id, with_for_update=True)
        if device is None:
            raise ValueError("Scanner not found.")
        try:
            OrganizationService(self.db).get_organization_for_user(
                organization_id=device.organization_id, actor=actor,
            )
        except (OrganizationAccessDeniedError, OrganizationNotFoundError) as exc:
            raise PermissionError("Organisation access denied.") from exc
        if actor.role == UserRole.READ_ONLY:
            raise PermissionError("Read-only users cannot move scanners.")
        if assignment.status != AssignmentStatus.ASSIGNED:
            raise ValueError("Only active assignments can be moved.")
        event = self.event_repository.get_by_id(assignment.event_id)
        if event is None or event.organization_id != device.organization_id:
            raise ValueError("Event not found for this organisation.")
        area = self.db.scalar(select(MapArea).where(
            MapArea.id == area_id,
            MapArea.organization_id == device.organization_id,
            MapArea.event_id == assignment.event_id,
        ))
        if area is None:
            raise ValueError("Allocated area not found for this organisation and event.")
        assignment.map_area_id = area.id
        assignment.assigned_location = area.name
        self.db.commit()
        self.db.refresh(assignment)
        return assignment
