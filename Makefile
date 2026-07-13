.PHONY: up down logs test lint format install-api install-web

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	cd apps/api && pytest
	cd apps/web && npm test -- --run

lint:
	cd apps/api && ruff check src tests
	cd apps/web && npm run lint

format:
	cd apps/api && ruff format src tests
	cd apps/web && npm run format

install-api:
	cd apps/api && python -m pip install -e ".[dev]"

install-web:
	cd apps/web && npm install
