# Hive by Blackbird

Hive is Blackbird's commercial device-management platform for event operations. Version 1 focuses on Unitech EA660 scanners and provides the foundation for device telemetry, event assignment, inventory state, and an Android reporting agent.

## Repository shape

This repository is a modular monorepo:

- `apps/web` — React, TypeScript, Tailwind CSS frontend
- `apps/api` — FastAPI, SQLAlchemy, PostgreSQL backend
- `apps/android-agent` — Kotlin Android agent for EA660 scanners
- `packages/contracts` — shared API contracts and generated clients
- `infrastructure` — local and deployment infrastructure
- `docs` — architecture decisions, product documentation, and sprint records

## Architecture

Hive begins as a modular monolith. Device, event, and inventory capabilities live in one deployable backend while retaining strict module boundaries. This gives Blackbird a practical V1 development model without locking the product into a tightly coupled codebase.

See [`docs/architecture/overview.md`](docs/architecture/overview.md).

## Local development

### Requirements

- Docker Desktop
- Node.js 22+
- Python 3.12+
- Android Studio with JDK 17 for the Android agent

### Start the platform

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Web: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432

### Health check

```bash
curl http://localhost:8000/api/v1/health
```

## Current status

Sprint 1 establishes the complete project architecture, repository conventions, local Docker environment, CI foundations, and runnable application shells.

## Product ownership

Blackbird retains ownership of Hive product design, source code, branding, and deployment configuration.
