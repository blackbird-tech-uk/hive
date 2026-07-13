# Sprint 1 — Project Architecture and Foundation

## 1. Goal

Create a production-oriented, GitHub-ready monorepo that establishes Hive's application boundaries, development standards, local environment, and continuous integration foundations.

## 2. Tasks

- Create monorepo structure for web, API, Android, contracts, infrastructure, and documentation.
- Create a runnable FastAPI application with versioned routing and health endpoint.
- Create a runnable React/TypeScript application shell with Hive visual direction.
- Create an Android Kotlin application shell with WorkManager dependency and manifest permissions required for future heartbeat reporting.
- Create Docker development environment with PostgreSQL.
- Add linting, formatting, testing, dependency automation, and CI workflows.
- Record architecture decisions and repository contribution rules.

## 3. Folder changes

See the repository tree in the root README and `docs/architecture/overview.md`.

## 4. Files created

This sprint creates the complete initial repository scaffold, including root governance files, application manifests, source entry points, CI workflows, Docker files, and architecture documentation.

## 5. Code

The API exposes `GET /api/v1/health`. The web application renders the Hive product shell. The Android project establishes the package and dependencies for the future Hive Agent.

## 6. Testing

- Backend health route test using pytest.
- Frontend smoke test using Vitest and Testing Library.
- CI jobs for API and web lint/test/build.
- Android debug build job.

## 7. Git commit message

```text
chore: establish Hive production monorepo architecture
```

## 8. Definition of Done

- Repository can be cloned without undocumented setup steps.
- `docker compose up --build` starts PostgreSQL, API, and web applications.
- API health test passes.
- Web smoke test passes.
- CI configuration validates API, web, and Android projects.
- Architecture choices and development conventions are documented.
- No V1 business feature is falsely marked complete.
