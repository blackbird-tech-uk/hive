# Scanner readiness inspections — implementation contract

## Goal
Persist per-scanner pre-show inspection results, attributed to the authenticated HIVE user, and compute a trustworthy readiness indicator. This document is a design contract, **not a deployed feature**.

## Data model (proposed)
Append-only `scanner_inspections` records:
- `id` UUID primary key
- `organization_id` UUID, required
- `device_id` UUID, required, references device in the same organization
- `event_id` UUID nullable, only if event belongs to same organization
- `inspected_by_user_id` UUID, populated **server-side** from authenticated session
- `inspected_at` timestamp with timezone, server-generated
- `hive_connection_ok`, `chrome_ok`, `smartscan_ok`, `google_play_ok`, `battery_charging_ok`: booleans, all required
- `notes` optional bounded text (e.g. 2000 characters)

Do not store Google credentials, 2FA codes, or authentication tokens in inspection notes.

## API (proposed)
- `GET /organizations/{organization_id}/devices/{device_id}/inspections` — newest first, paginated
- `POST /organizations/{organization_id}/devices/{device_id}/inspections` — create immutable inspection; actor derived from auth context
- `GET /organizations/{organization_id}/scanner-readiness` — fleet summary

All endpoints require authenticated organization membership and appropriate read/write permissions. Verify device and event ownership; never trust organization, actor, or timestamp fields supplied by clients. No anonymous access. Add indexes for organization/device/time and organization/event/time. Enforce RLS on exposed tables or keep tables private behind authorized API access.

## Status calculation (proposed)
- **Not ready:** latest inspection has any failed mandatory check.
- **Needs inspection:** no inspection, inspection older than configurable validity window, or device not recently connected.
- **Ready for show:** all mandatory checks passed, inspection within validity window, device has a recent heartbeat, and required app inventory is verified.
- **Offline:** independent connectivity signal; never replace a failed inspection with a positive state merely because a heartbeat arrives.

Unknown/missing app inventory must not be treated as a pass. Google Play access is a manual staff verification, not a remotely detectable Google login state. Store readiness as a computed result or reproducible view, not an untraceable manually edited label.

## Rollout
1. Add database model and migration with authorization tests.
2. Implement secured API and cross-organization isolation tests.
3. Add per-device checklist form, submit confirmation, and inspection history.
4. Add fleet readiness badges and office/event/status filters when authoritative office assignment exists.
5. Test with LB164 without reinstalling the Android agent; verify a second office account cannot access another organization's inspections.

## Open decisions
- Inspection validity window (suggest 7 days for pre-show sign-off, configurable later).
- Whether inspection is event-specific or reusable across events.
- Roles allowed to sign off or invalidate a completed inspection.
