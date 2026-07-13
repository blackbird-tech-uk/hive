from fastapi.testclient import TestClient

from hive.main import app

client = TestClient(app)


def test_health_check_returns_service_status() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "hive-api"
    assert payload["version"] == "0.1.0"
