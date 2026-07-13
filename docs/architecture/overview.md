# Hive Architecture Overview

## Architectural style

Hive V1 uses a modular monolith with Clean Architecture principles.

A modular monolith is the correct starting point because the product has one small development team, strongly related business capabilities, and no demonstrated need for independent service scaling. Microservices would increase deployment, observability, security, and data-consistency complexity before those costs provide value.

## System context

```text
EA660 Hive Agent ──HTTPS──> FastAPI REST API ──> PostgreSQL
                                  │
                                  └──HTTPS──> React Dashboard
```

## Backend layers

Each business module is expected to evolve toward four conceptual layers:

1. **Domain** — entities, value objects, and business rules.
2. **Application** — use cases and service interfaces.
3. **Infrastructure** — SQLAlchemy repositories and external integrations.
4. **Presentation** — FastAPI routes and request/response schemas.

The Sprint 1 shell establishes these boundaries without prematurely filling every layer with empty abstractions.

## Initial backend modules

- `devices` — identity, telemetry, health, availability, and device history
- `events` — events, device assignments, pick lists, and return lists
- `inventory` — condition, repairs, notes, and inventory state

## Important forward-compatible decisions

### Multi-company readiness

V1 is single-company, but domain records will later receive an `organisation_id`. We will not expose multi-tenant behaviour until authentication, authorisation, and tenant-isolation tests are in place.

### Device telemetry

The latest device state and historical telemetry serve different workloads. V1 may begin with PostgreSQL for both. Telemetry ingestion is isolated behind an application service so a time-series store or message queue can be introduced later without changing Android clients.

### Remote commands

Remote commands are deliberately excluded from V1. The future command subsystem will use asynchronous command records with acknowledgement, expiry, idempotency, and audit trails rather than synchronous HTTP calls to devices.

### API contracts

FastAPI's OpenAPI document is the source contract. Generated TypeScript and Kotlin clients can later be produced from the checked-in contract under `packages/contracts`.

## Deployment units

V1 has three deployable units:

- Web frontend
- API backend
- Android agent

PostgreSQL is managed infrastructure in production.
