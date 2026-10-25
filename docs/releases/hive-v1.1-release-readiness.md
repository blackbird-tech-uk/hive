# HIVE V1.1 — release readiness and change notes

Status: **PREPARATION ONLY — NOT DEPLOYED**  
Source: `feature/fleet-map-pins-zones` / draft PR #42  
Target: controlled web/API release; Android Agent remains separate.

## Changes identified in PR #42

- **Fleet map:** web map features, map pins/zones, map-area API client, types and styling.
- **Event areas:** persistent `map_areas` table, polygons, event ownership, and API routes.
- **Scanner assignments:** optional `map_area_id` association and assignment API changes.
- **Organisation isolation:** event tenant scoping, access checks, and tests.
- **API security:** configurable token lifetime and safer manual scanner-token rotation.
- **Android Agent (NOT in V1.1 release scope):** enrolment-state fixes, heartbeat/polling URL handling, version 0.1.1, APK artifact and signing diagnostics.

These are branch-level change summaries, not claims of production deployment.

## Database migration review

Migration `f31a6b8c02e4` revises `7c2a91d4e6f8`.

- Adds nullable `events.organization_id` with an organisation foreign key.
- Backfills legacy events **only if exactly one organisation exists**.
- Creates `map_areas` with organisation/event foreign keys and polygon validation.
- Adds nullable `assignments.map_area_id` and associated foreign key.
- Downgrade **drops the map_areas table and the added columns**. Treat this as destructive; prefer restore from a verified backup or a reviewed forward fix if production rollback is required.
- Before release: inspect current production Alembic revision and tenant counts, check for unowned legacy events, take and verify a restorable database backup, rehearse migration against an isolated copy, and test organisation isolation.

## Gates before deployment

- [ ] Confirm the exact release commit and **exclude Android Agent** from the production release.
- [ ] Reconcile 106 commits against `main`; split or cherry-pick reviewed web/API changes onto a dedicated release branch.
- [ ] Verify green API/Web CI on the **release commit** (not just earlier branch commits).
- [ ] Verify isolated PostgreSQL migration upgrade and application smoke tests.
- [ ] Confirm production schema, data ownership and backup/restore plan.
- [ ] Check Railway and Vercel deployment configuration and rollback paths.
- [ ] Approve release window, deploy backend migration/API first, then web.
- [ ] Smoke test login, organisation isolation, events, scanner inventory, assignments, map areas and dashboard.
- [ ] Record deployment SHAs and post-release observations.

## Rollout policy

Do **not** merge all of PR #42 or run the migration on production as a shortcut. Do not install a new Android APK on LB164 until signing compatibility and token renewal are validated. Railway and Vercel production remain unchanged during preparation.
