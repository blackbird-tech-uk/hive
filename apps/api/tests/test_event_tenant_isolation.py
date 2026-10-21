"""Isolated API tests for event tenant boundaries."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from hive.db.session import get_db
from hive.main import app
from hive.modules.auth.dependencies import get_current_user
from hive.modules.organizations.models import MembershipStatus, OrganizationStatus


def test_event_list_only_returns_accessible_tenant(monkeypatch):
    org_a, org_b = uuid4(), uuid4()
    membership = SimpleNamespace(
        organization_id=org_a,
        status=MembershipStatus.ACTIVE,
        organization=SimpleNamespace(status=OrganizationStatus.ACTIVE),
    )
    actor = SimpleNamespace(id=uuid4(), organization_memberships=[membership])
    def event(organization_id):
        return SimpleNamespace(
            id=uuid4(), organization_id=organization_id, name="Example",
            venue="Test", start_date="2026-11-01", end_date="2026-11-02",
            status="planned", notes=None,
        )

    events = [event(org_a), event(org_b), event(None)]
    monkeypatch.setattr(
        "hive.modules.events.router.EventService.list_events",
        lambda _self: events,
    )
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: actor
    try:
        response = TestClient(app).get("/api/v1/events")
        assert response.status_code == 200
        assert len(response.json()) == 1
    finally:
        app.dependency_overrides.clear()


def test_event_creation_rejects_other_organisation():
    org_a, org_b = uuid4(), uuid4()
    membership = SimpleNamespace(
        organization_id=org_a,
        status=MembershipStatus.ACTIVE,
        organization=SimpleNamespace(status=OrganizationStatus.ACTIVE),
    )
    actor = SimpleNamespace(id=uuid4(), organization_memberships=[membership])
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: actor
    try:
        response = TestClient(app).post(
            "/api/v1/events",
            json={
                "organization_id": str(org_b),
                "name": "Foreign event",
                "venue": "Test venue",
                "start_date": "2026-11-01",
                "end_date": "2026-11-02",
            },
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
