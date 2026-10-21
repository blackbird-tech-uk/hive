-- Apply through the controlled HIVE database migration process before deploying the API.
-- No changes to production are made by adding this file.
CREATE TABLE IF NOT EXISTS public.map_areas (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  points jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_map_areas_org_event_name UNIQUE (organization_id, event_id, name),
  CONSTRAINT map_areas_polygon_min_points CHECK (jsonb_typeof(points) = 'array' AND jsonb_array_length(points) >= 3)
);
CREATE INDEX IF NOT EXISTS ix_map_areas_organization_id ON public.map_areas (organization_id);
CREATE INDEX IF NOT EXISTS ix_map_areas_event_id ON public.map_areas (event_id);
-- All access is via the authenticated HIVE API; deny direct client access.
REVOKE ALL ON public.map_areas FROM anon, authenticated;
