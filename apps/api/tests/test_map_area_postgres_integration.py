"""Real PostgreSQL migration and tenant isolation tests on a disposable CI service.

Never runs unless explicitly enabled with the isolated CI environment flag.
"""

import os
import subprocess
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from hive.core.config import settings
from hive.modules.assignments.models import Assignment
from hive.modules.assignments.schemas import AssignmentCreate
from hive.modules.assignments.service import AssignmentService
from hive.modules.devices.models import Device
from hive.modules.events.models import Event
from hive.modules.map_areas.models import MapArea
from hive.modules.organizations.models import Organization, OrganizationMembership
from hive.modules.users.models import User, UserRole

pytestmark = pytest.mark.skipif(
    os.environ.get("HIVE_ISOLATED_POSTGRES_TEST") != "1",
    reason="Requires explicitly isolated PostgreSQL CI service",
)


def migrate(revision):
    subprocess.run(
        ["alembic", "-c", "alembic.ini", "upgrade" if revision != "-1" else "downgrade",
         revision],
        check=True,
        env=os.environ.copy(),
    )


def test_real_postgres_upgrade_tenant_isolation_and_downgrade(monkeypatch):
    # Prevent any possibility of running these destructive checks on Supabase or Railway.
    assert settings.environment == "development"
    assert "localhost:5432/hive_test" in settings.database_url
    assert "hive_test:isolated_test_only@" in settings.database_url

    engine = create_engine(settings.database_url)
    migrate("7c2a91d4e6f8")
    org_id, foreign_org_id, event_id = uuid4(), uuid4(), uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO organizations (id, name, slug, status, created_at, updated_at) "
                 "VALUES (:id, 'Isolated', 'isolated', 'active', now(), now())"),
            {"id": org_id},
        )
        conn.execute(
            text("INSERT INTO events "
                 "(id, name, venue, start_date, end_date, status) "
                 "VALUES (:id, 'Test', 'Test venue', :start, :end, 'planned')"),
            {"id": event_id, "start": date(2026, 11, 1), "end": date(2026, 11, 2)},
        )

    migrate("head")
    inspector = inspect(engine)
    assert "map_areas" in inspector.get_table_names()
    assert "map_area_id" in {c["name"] for c in inspector.get_columns("assignments")}
    assert "organization_id" in {c["name"] for c in inspector.get_columns("events")}

    with Session(engine) as db:
        assert db.get(Event, event_id).organization_id == org_id
        actor = User(
            username="isolated_user", display_name="Isolated", job_title="Tester",
            role=UserRole.SYSTEM_ADMINISTRATOR, password_hash="test-only",
        )
        other_org = Organization(id=foreign_org_id, name="Foreign", slug="foreign")
        db.add_all([actor, other_org])
        db.flush()
        db.add(OrganizationMembership(organization_id=org_id, user_id=actor.id))
        scanner = Device(
            organization_id=org_id, hive_id="CI-1", asset_id="CI-1",
            serial_number="CI-SERIAL-1",
        )
        area = MapArea(
            organization_id=org_id, event_id=event_id, name="Registration A",
            points=[[52.4, -1.5], [52.41, -1.5], [52.41, -1.49]],
        )
        foreign_area = MapArea(
            organization_id=foreign_org_id, event_id=event_id,
            name="Foreign area",
            points=[[52.4, -1.5], [52.41, -1.5], [52.41, -1.49]],
        )
        db.add_all([scanner, area, foreign_area])
        db.commit()
        db.refresh(scanner)
        db.refresh(area)
        db.refresh(foreign_area)

        service = AssignmentService(db)
        with pytest.raises(ValueError, match="Allocated area not found"):
            service.create(
                AssignmentCreate(
                    device_id=scanner.id, event_id=event_id, map_area_id=foreign_area.id,
                ),
                actor,
            )
        assert db.scalar(select(Assignment)) is None
        result = service.create(
            AssignmentCreate(
                device_id=scanner.id, event_id=event_id, map_area_id=area.id,
            ),
            actor,
        )
        assert result.map_area_id == area.id
        assert result.assigned_location == "Registration A"
        assert db.get(Assignment, result.id).map_area_id == area.id

        # The FK must reject deletion of a polygon referenced by an assignment.
        from sqlalchemy.exc import IntegrityError

        with pytest.raises(IntegrityError):
            db.delete(area)
            db.commit()
        db.rollback()

    migrate("-1")
    inspector = inspect(engine)
    assert "map_areas" not in inspector.get_table_names()
    assert "map_area_id" not in {c["name"] for c in inspector.get_columns("assignments")}
    assert "organization_id" not in {c["name"] for c in inspector.get_columns("events")}
    engine.dispose()
