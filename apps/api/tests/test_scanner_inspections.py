"""Validation and API registration checks for scanner inspections."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from hive.api.v1.router import api_router
from hive.modules.inspections.models import ScannerInspection
from hive.modules.inspections.schemas import InspectionCreate, InspectionResponse


def valid_checks() -> dict[str, bool]:
    return {
        "hive_connection_ok": True,
        "chrome_ok": True,
        "smartscan_ok": True,
        "google_play_ok": True,
        "battery_charging_ok": True,
    }


def test_inspection_requires_all_five_checks() -> None:
    with pytest.raises(ValidationError):
        InspectionCreate.model_validate({"chrome_ok": True})


def test_inspection_rejects_overlong_notes() -> None:
    with pytest.raises(ValidationError):
        InspectionCreate(**valid_checks(), notes="x" * 2001)


def test_inspection_accepts_failed_checks() -> None:
    checks = valid_checks()
    checks["smartscan_ok"] = False
    inspection = InspectionCreate(**checks)
    assert inspection.smartscan_ok is False


def test_inspection_response_includes_server_attribution() -> None:
    inspection = ScannerInspection(
        id=uuid4(),
        organization_id=uuid4(),
        device_id=uuid4(),
        inspected_by_user_id=uuid4(),
        inspected_at=datetime.now(timezone.utc),
        **valid_checks(),
    )
    response = InspectionResponse.model_validate(inspection)
    assert response.inspected_by_user_id == inspection.inspected_by_user_id


def test_inspection_routes_registered() -> None:
    paths = {
        (route.path, method)
        for route in api_router.routes
        for method in getattr(route, "methods", set())
    }
    path = "/api/v1/organizations/{organization_id}/devices/{device_id}/inspections"
    assert (path, "GET") in paths
    assert (path, "POST") in paths
