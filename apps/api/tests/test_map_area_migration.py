"""Compile the map-area Alembic revision in isolated PostgreSQL offline mode.

This validates migration SQL without connecting to a production database.
A disposable PostgreSQL upgrade/downgrade is still required before release.
"""

from importlib.util import module_from_spec, spec_from_file_location
from io import StringIO
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic/versions/f31a6b8c02e4_add_event_map_areas.py"
)


def render_sql(operation: str) -> str:
    spec = spec_from_file_location("map_area_revision", MIGRATION)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    output = StringIO()
    context = MigrationContext.configure(
        url="postgresql://",
        opts={"as_sql": True, "output_buffer": output},
    )
    with Operations.context(context):
        getattr(module, operation)()
    return output.getvalue()


def test_upgrade_compiles_postgresql_ddl():
    sql = render_sql("upgrade")
    assert "CREATE TABLE map_areas" in sql
    assert "ALTER TABLE assignments ADD COLUMN map_area_id" in sql
    assert "fk_assignments_map_area_id" in sql
    assert "CREATE INDEX ix_map_areas_organization_id" in sql
    assert "DO $hive$" in sql
    assert "REVOKE ALL ON map_areas FROM authenticated" in sql


def test_downgrade_compiles_postgresql_ddl():
    sql = render_sql("downgrade")
    assert "DROP TABLE map_areas" in sql
    assert "DROP COLUMN map_area_id" in sql
