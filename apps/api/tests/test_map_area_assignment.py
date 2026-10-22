"""Tenant and event checks for allocated scanner areas."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from hive.modules.assignments.schemas import AssignmentCreate
from hive.modules.assignments.service import AssignmentService
from hive.modules.devices.models import DeviceStatus
from hive.modules.users.models import UserRole


def setup_service(monkeypatch):
    db = MagicMock()
    service = AssignmentService(db)
    org_id, event_id, device_id, area_id = (uuid4() for _ in range(4))
    device = SimpleNamespace(
        id=device_id, organization_id=org_id, status=DeviceStatus.AVAILABLE,
    )
    db.get.return_value = device
    service.event_repository.get_by_id = MagicMock(
        return_value=SimpleNamespace(organization_id=org_id),
    )
    org_service = MagicMock()
    monkeypatch.setattr(
        "hive.modules.assignments.service.OrganizationService",
        lambda _db: org_service,
    )
    actor = SimpleNamespace(role=UserRole.SYSTEM_ADMINISTRATOR)
    payload = AssignmentCreate(
        device_id=device_id, event_id=event_id, map_area_id=area_id,
    )
    return db, service, actor, payload, org_id, event_id, area_id


def test_rejects_area_from_different_organisation_or_event(monkeypatch):
    db, service, actor, payload, *_ = setup_service(monkeypatch)
    db.scalar.return_value = None

    with pytest.raises(ValueError, match="not found for this organisation and event"):
        service.create(payload, actor)

    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_accepts_matching_saved_area(monkeypatch):
    db, service, actor, payload, org_id, event_id, area_id = setup_service(
        monkeypatch,
    )
    db.scalar.return_value = SimpleNamespace(
        id=area_id, name="Registration A",
        organization_id=org_id, event_id=event_id,
    )
    service.create(payload, actor)

    saved = db.add.call_args.args[0]
    assert saved.map_area_id == area_id
    assert saved.assigned_location == "Registration A"
    db.commit.assert_called_once()


def test_read_only_user_cannot_assign_area(monkeypatch):
    db, service, actor, payload, *_ = setup_service(monkeypatch)
    actor.role = UserRole.READ_ONLY

    with pytest.raises(PermissionError, match="Read-only"):
        service.create(payload, actor)

    db.add.assert_not_called()


def test_rejects_event_owned_by_another_organisation(monkeypatch):
    db, service, actor, payload, *_ = setup_service(monkeypatch)
    service.event_repository.get_by_id.return_value = SimpleNamespace(
        organization_id=uuid4(),
    )

    with pytest.raises(ValueError, match="Event not found for this organisation"):
        service.create(payload, actor)

    db.add.assert_not_called()
