# Contributing to Hive

## Branch strategy

- `main` is always releasable.
- Work is completed on short-lived branches.
- Branch names use `feature/`, `fix/`, `chore/`, or `docs/` prefixes.
- Pull requests require passing CI and a clear Definition of Done.

## Commit convention

Hive uses Conventional Commits:

- `feat:` user-facing functionality
- `fix:` defect correction
- `chore:` tooling or maintenance
- `docs:` documentation only
- `test:` test-only change
- `refactor:` internal change without behaviour change

## Engineering rules

- Business logic belongs in domain/application layers, not route handlers or UI components.
- Modules may communicate through explicit service interfaces, not direct database access across module boundaries.
- Database migrations are mandatory for schema changes.
- Public API changes must update the OpenAPI contract.
- New behaviour requires automated tests.
