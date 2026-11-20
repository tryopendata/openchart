# openchart site commands.
#
# Adapt the recipes, but keep the target names: `stacks verify` calls install,
# lint, check, test, build, e2e and dev, and CI should call the same targets.

PORT_WEB ?= 4321
PORT_E2E ?= 4322
export PORT_WEB PORT_E2E

.DEFAULT_GOAL := help
.PHONY: help install dev lint format check test coverage build preview e2e clean

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

# Outside CI this also installs git hooks (when configured) and the Chromium
# build the browser tests use; CI installs Chromium in its own step.
install: ## Install dependencies (frozen lockfile when CI is set)
	bun install $(if $(CI),--frozen-lockfile)
	@if [ -z "$(CI)" ] && [ -f lefthook.yml ] && command -v lefthook >/dev/null 2>&1; then lefthook install; fi
	@if [ -z "$(CI)" ] && [ -x node_modules/.bin/playwright ]; then node_modules/.bin/playwright install chromium; fi

# --ignore-lock keeps astro dev in the foreground when it detects an agent
# (otherwise it backgrounds itself and exits). Stop a stray one: bunx astro dev stop
dev: ## Astro dev server on PORT_WEB
	bunx astro dev --port $(PORT_WEB) --ignore-lock

lint: ## Biome for TS, JS, CSS and JSON; Prettier for .astro files
	bunx biome check .
	bunx prettier --check "**/*.astro"

format: ## Apply Biome and Prettier fixes
	bunx biome check --write .
	bunx prettier --write "**/*.astro"

check: ## Type-check pages, components and content (astro check)
	@bun --no-install -e 'require.resolve("@astrojs/check"); require.resolve("typescript")' >/dev/null 2>&1 || { echo 'Missing checker dependencies. Run bun add -d @astrojs/check typescript, then make check.' >&2; exit 1; }
	bunx --no-install astro check

test: ## Unit and component tests
	bunx vitest run

coverage: ## Unit and component tests with coverage
	bunx vitest run --coverage

build: ## Static build into dist/, then the acceptance tests over it
	bunx astro build
	bunx vitest run --config vitest.build.config.ts

preview: ## Serve the production build on PORT_WEB
	bunx astro preview --port $(PORT_WEB) --ignore-lock

e2e: ## Browser and accessibility tests against the production build
	node scripts/e2e.mjs

clean: ## Remove build output, test output and Astro caches
	rm -rf dist .astro .astro-cache .vite-cache node_modules/.astro coverage playwright-report test-results
