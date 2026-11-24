# openchart site commands.
#
# Adapt the recipes, but keep the target names: `stacks verify` calls install,
# lint, check, test, build, e2e and dev, and CI should call the same targets.

PORT_WEB ?= 4321
PORT_E2E ?= 4322
export PORT_WEB PORT_E2E

.DEFAULT_GOAL := help
.PHONY: help install dev lint format check test coverage build preview e2e e2e-timings clean deploy-check deploy-preview deploy

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

# The deploy targets check their variables when make reads this file, so a
# missing one stops the run before the build starts.
ifneq ($(filter deploy deploy-preview,$(MAKECMDGOALS)),)
  ifeq ($(CLOUDFLARE_API_TOKEN),)
    $(error CLOUDFLARE_API_TOKEN is not set: export a Cloudflare API token with Pages edit access)
  endif
  ifeq ($(CLOUDFLARE_ACCOUNT_ID),)
    $(error CLOUDFLARE_ACCOUNT_ID is not set: export the Cloudflare account id that owns the openchart project)
  endif
endif
ifneq ($(filter deploy-preview,$(MAKECMDGOALS)),)
  ifeq ($(BRANCH),)
    $(error BRANCH is not set: run make deploy-preview BRANCH=<branch-name>)
  endif
  ifeq ($(BRANCH),main)
    $(error BRANCH=main is the Pages production branch: use make deploy to upload production)
  endif
endif

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

e2e-timings: ## Run the browser tests and record per-file times for CI's shard split
	PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-report/timings.json node scripts/e2e.mjs -- --reporter=json,dot
	node scripts/e2e-timings.mjs playwright-report/timings.json

clean: ## Remove build output, test output and Astro caches
	rm -rf dist .astro .astro-cache .vite-cache node_modules/.astro coverage playwright-report test-results

deploy-check: build ## Serve dist/ through wrangler pages dev and check headers, redirects, the RSS feed, the search index files, trailing-slash URLs and the 404 page
	node --test tests/deploy.test.mjs

# Cloudflare's Git integration deploys (AGENTS.md, Deploy). These are for manual
# uploads: they upload from this machine to the Cloudflare Pages project openchart. --no-install runs
# only the lockfile's wrangler, so a missing install never fetches an unpinned
# one while the Cloudflare token is in the environment.
deploy-preview: build ## Upload dist/ as a preview for BRANCH (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
	bunx --no-install wrangler pages deploy dist --project-name openchart --branch "$(BRANCH)"

deploy: build ## Upload dist/ to production (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
	bunx --no-install wrangler pages deploy dist --project-name openchart --branch main
