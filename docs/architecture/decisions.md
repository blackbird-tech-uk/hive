# Architecture Decision Log

## ADR-001: Use a modular monolith

**Status:** Accepted

**Decision:** Build one FastAPI application split into business modules.

**Reason:** It provides low operational complexity and strong transaction support while preserving future extraction paths.

## ADR-002: Use a monorepo

**Status:** Accepted

**Decision:** Keep web, API, Android agent, contracts, infrastructure, and documentation in one repository.

**Reason:** Product contracts and coordinated releases can be reviewed together during the early product stage.

## ADR-003: PostgreSQL as system of record

**Status:** Accepted

**Decision:** Store operational state in PostgreSQL through SQLAlchemy.

**Reason:** Device assignment, inventory state, and event history require relational integrity and auditable transactions.

## ADR-004: REST before realtime transport

**Status:** Accepted

**Decision:** Use REST for V1 dashboard and heartbeat ingestion. Add server-sent events or WebSockets only after the core workflows are stable.

**Reason:** Automatic dashboard refresh can initially use controlled polling, which is easier to operate and test. The API boundary will support realtime delivery later.
