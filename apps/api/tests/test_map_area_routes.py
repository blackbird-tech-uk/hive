"""API-level tests for allocated-area authentication and tenant isolation."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from hive.db.session import get_db
from hive.main import app
from hive.modules.auth.dependencies import get_current_user
from hive.modules.organizations.exceptions import OrganizationAccessDeniedError
from hive.modules.users.models import UserRole


def test_map_area_route_requires_authentication():
    client = TestClient(app)
    response = client.get(
        f"/api/v1/organizations/{uuid4()}/events/{uuid4()}/map-areas",
    )
    assert response.status_code == 401


def test_map_area_route_denies_other_organisation(monkeypatch):
    db = MagicMock()
    actor = SimpleNamespace(id=uuid4(), role=UserRole.SYSTEM_ADMINISTRATOR)

    def deny_organisation(self, **_kwargs):
        raise OrganizationAccessDeniedError(uuid4())

    monkeypatch.setattr(
        "hive.modules.map_areas.router.OrganizationService.get_organization_for_user",
        deny_organisation,
    )
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: actor
    try:
        response = TestClient(app).get(
            f"/api/v1/organizations/{uuid4()}/events/{uuid4()}/map-areas",
        )
        assert response.status_code == 404
        db.scalars.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_map_area_route_rejects_event_from_other_organisation(monkeypatch):
    db = MagicMock()
    org_id = uuid4()
    actor = SimpleNamespace(id=uuid4(), role=UserRole.SYSTEM_ADMINISTRATOR)
    db.get.return_value = SimpleNamespace(organization_id=uuid4())

    monkeypatch.setattr(
        "hive.modules.map_areas.router.OrganizationService.get_organization_for_user",
        lambda _self, **_kwargs: SimpleNamespace(id=org_id),
    )
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: actor
    try:
        response = TestClient(app).get(
            f"/api/v1/organizations/{org_id}/events/{uuid4()}/map-areas",
        )
        assert response.status_code == 404
        db.scalars.assert_not_called()
    finally:
        app.dependency_overrides.clear()
