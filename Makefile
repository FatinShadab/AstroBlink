# ==============================================================
# AstroBlink — Makefile (convenience targets only)
# All commands use docker compose with infra/ config files.
# ==============================================================

COMPOSE_BASE   := docker compose -f infra/docker-compose.yml --project-directory .
COMPOSE_DEV    := $(COMPOSE_BASE) -f infra/docker-compose.override.yml
COMPOSE_PROD   := $(COMPOSE_BASE) -f infra/docker-compose.prod.yml

.DEFAULT_GOAL := help

# ── Core ─────────────────────────────────────────────────────

.PHONY: up
up: ## Start dev stack (postgres, redis, minio, api, client)
	$(COMPOSE_DEV) up --build -d

.PHONY: up-worker
up-worker: ## Start dev stack including the worker (ingestion) service
	$(COMPOSE_DEV) --profile worker up --build -d

.PHONY: down
down: ## Stop all services
	$(COMPOSE_DEV) --profile worker down

.PHONY: logs
logs: ## Tail logs for all services
	$(COMPOSE_DEV) --profile worker logs -f

.PHONY: build
build: ## Build all images (no cache)
	$(COMPOSE_DEV) --profile worker build

.PHONY: up-prod
up-prod: ## Start prod-like stack (built images, no bind mounts)
	$(COMPOSE_PROD) --profile worker up --build -d

# ── Database ─────────────────────────────────────────────────

.PHONY: migrate
migrate: ## Run Alembic migrations via the migrate service
	$(COMPOSE_DEV) run --rm migrate

.PHONY: seed
seed: ## Seed dev database and MinIO with fake subjects
	$(COMPOSE_DEV) run --rm --no-deps api python /build/scripts/seed_dev.py

# ── Testing ──────────────────────────────────────────────────

.PHONY: test
test: test-api test-worker test-client ## Run all tests

.PHONY: test-api
test-api: ## Run API tests inside container
	$(COMPOSE_DEV) run --rm --no-deps api python -m pytest tests/ -v

.PHONY: test-worker
test-worker: ## Run worker tests inside container
	$(COMPOSE_DEV) run --rm --no-deps worker python -m pytest tests/ -v

.PHONY: test-client
test-client: ## Run client tests inside container
	$(COMPOSE_DEV) run --rm --no-deps client npx vitest run

# ── Lint ─────────────────────────────────────────────────────

.PHONY: lint
lint: lint-api lint-worker lint-client ## Run all linters

.PHONY: lint-api
lint-api: ## Lint API with ruff
	$(COMPOSE_DEV) run --rm --no-deps api python -m ruff check app/ tests/

.PHONY: lint-worker
lint-worker: ## Lint worker with ruff
	$(COMPOSE_DEV) run --rm --no-deps worker python -m ruff check worker/ tests/

.PHONY: lint-client
lint-client: ## Lint client with ESLint
	$(COMPOSE_DEV) run --rm --no-deps client npx eslint src/

# ── Health ───────────────────────────────────────────────────

.PHONY: health
health: ## Hit every health endpoint
	@echo "── API ──"
	@curl -sf http://localhost:$${API_PORT:-8000}/health && echo " OK" || echo " FAIL"
	@echo "── Client ──"
	@curl -sf http://localhost:$${CLIENT_PORT:-3000}/health && echo " OK" || echo " FAIL"
	@echo "── MinIO ──"
	@curl -sf http://localhost:$${MINIO_PORT:-9000}/minio/health/live && echo " OK" || echo " FAIL"

# ── Standalone Builds (prove no cross-folder deps) ───────────

.PHONY: build-standalone
build-standalone: ## Build each app image using only its folder as context
	docker build ./api -t astroblink-api:standalone-test
	docker build ./worker -t astroblink-worker:standalone-test
	docker build ./client -t astroblink-client:standalone-test --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# ── Cleanup ──────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove all containers, volumes, and images (asks for confirmation)
	@echo "This will remove ALL AstroBlink containers, volumes, and images."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	$(COMPOSE_DEV) --profile worker down -v --rmi local
	docker image prune -f --filter "label=org.opencontainers.image.title=astroblink-*"

# ── Help ─────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
