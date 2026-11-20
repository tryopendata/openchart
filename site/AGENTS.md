# openchart

Instructions for coding agents working in this repository. Keep this file under about 200 lines: it is loaded at the start of every session. Put detail that matters only for one area in a doc and link it from Deeper context.

## Overview

The OpenChart documentation site at https://openchart.steamfield.io: a landing page at `/`, the chart, table and map catalog with live demos, and the guides from the repository's `docs/` under `/docs/`. Developers and coding agents read it; every page is also served as Markdown and listed in `/llms.txt`. Built with Astro and static React, rendered by the OpenChart packages in this monorepo, and deployed to Cloudflare Pages.

## Commands

Run these from `site/`. They are the only supported way to build, test, and run the site; if a command here is wrong, fix it here in the same change. Dependencies install at the repository root (`bun install`), and the library packages must be built first (`bun run build` at the root).

| Command | What it does |
| --- | --- |
| `make install` | Install dependencies (frozen lockfile when CI is set) and, outside CI, Playwright's Chromium |
| `make dev` | Astro dev server on PORT_WEB (4321) |
| `make lint` | Biome for TS, JS, CSS and JSON; Prettier for .astro files |
| `make format` | Apply Biome and Prettier fixes |
| `make check` | Type-check pages, components and content (astro check) |
| `make test` | Unit and component tests (Vitest) |
| `bunx vitest run <file>` | One unit or component test file, e.g. `bunx vitest run src/lib/docs.test.ts` |
| `make coverage` | Unit and component tests with coverage |
| `make build` | Static build into dist/, then the acceptance tests over it |
| `make preview` | Serve the production build on PORT_WEB |
| `make e2e` | Browser and accessibility tests against the production build |
| `bunx playwright test <file>` | One browser test file, after a build |
| `make deploy-check` | Build, then serve dist/ through `wrangler pages dev` and check headers, canonical URLs and the 404 page |
| `make deploy-preview BRANCH=<name>` | Build and upload a preview (needs Cloudflare variables, see Deploy) |
| `make deploy` | Build and upload to production (needs Cloudflare variables, see Deploy) |
| `make clean` | Remove build output, test output and Astro caches |

## Architecture map

```
src/config.ts          product name, URL, install commands, landing content, docs areas and sections
src/content/docs/      catalog pages, one .mdx per chart type, grouped by section
src/content.config.ts  collections: catalog pages plus the repository's docs/*.md that declare a `section`
src/demos/             demo specs per section, found by registry.ts; fixtures/ for tests
src/lib/               docs navigation and exports, Markdown plugins, demo rendering, analytics, consent
src/components/        landing sections (static React), docs chrome, the Demo figure
src/layouts/           BaseLayout (head, header, footer, analytics) and DocsLayout (sidebar, outline, pager)
src/pages/             landing, docs and their .md exports, llms files, social cards, robots, 404, test fixtures
src/scripts/           browser code: theme, copy buttons, demo mounting
src/styles/            global tokens and demo styles
tests/                 build acceptance tests (build.test.ts) and the Pages check (deploy.test.mjs)
e2e/                   Playwright browser and axe tests
public/                static files, including _headers for Pages
```

At build time each demo spec is validated with the engine and rendered to static SVG; in the browser `src/scripts/demos.ts` mounts the live chart as it nears the viewport.

## Agent harness

Claude Code is the configured agent. `CLAUDE.md` imports this file. Hooks live in `.claude/hooks/` and are wired in `.claude/settings.json`; `.claude/README.md` describes each one. Path-scoped rules live in `.claude/rules/`. There are no project skills yet; add them under `.claude/skills/`.

| Rule | Covers |
| --- | --- |
| `.claude/rules/engineering.md` | Every TS, JS, Python, Go, Rust and JVM source file |
| `.claude/rules/site/docs.md` | `src/content/**`, `src/lib/docs.ts`, `src/lib/markdown.ts`, `src/layouts/DocsLayout.astro`, `src/pages/docs/**` |
| `.claude/rules/site/ui.md` | `src/components/**`, `src/layouts/**`, `src/pages/**`, `src/scripts/**`, `src/styles/**` |

## Conventions

- Nothing lists pages by hand. A catalog page is one `.mdx` file; a repository doc becomes a page when its frontmatter declares `section`. Navigation, pager, Markdown exports, `llms.txt`, sitemap and social cards derive from the collections.
- A demo is a module under `src/demos/` exporting a `defineDemo` value; the registry finds it. Don't keep a shared list.
- `src/lib/collection.ts` is the only `astro:content` import outside routes. `src/lib/analytics.ts` is the only `posthog-js` import.
- Only components named in `site.islands` may hydrate, and only on the landing page; the build test enforces it.
- Colors are tokens defined in both theme blocks of `src/styles/global.css`.
- Prefer the project's existing patterns and dependencies over new ones. Add a dependency only when nothing in the project already covers the need.
- Keep changes scoped to the task. Mention unrelated problems you notice instead of fixing them in the same change.
- Give each module one responsibility; keep rules independent of I/O and use public interfaces across boundaries.
- Name files for their contents. Keep functions small, with names that read as the steps of the operation; avoid catch-all utils and speculative abstractions.
- Put a file-level doc comment at the top of every source file explaining its role in the system (JSDoc for TS/JS).
- Keep comments about constraints and reasons. Let names and types explain ordinary mechanics, and update documentation when responsibilities change.

Read [code style](docs/guidance/engineering/code-style.md) and [architecture](docs/guidance/engineering/architecture.md) before writing code.

## Guardrails

- Destructive commands, credential-shaped writes and real `.env` writes are guarded by hooks. A block means ask the user; never rephrase a command or use another tool to bypass it.
- Store credentials in environment variables or a secrets manager. Write variable names and placeholders in `.env.example`; ask the user to set real values.
- Load the applicable project rules before changing their area.
- Treat lint diagnostics as work to resolve. Run the project check command before finishing; instructions and hooks do not replace tests.

## Testing

| Layer | Runner | Where | Notes |
| --- | --- | --- | --- |
| Unit and component | Vitest, happy-dom | `src/**/*.test.{ts,tsx}` | `tests/setup.ts` adds jest-dom matchers and Testing Library cleanup |
| Build acceptance | Vitest, node | `tests/build.test.ts` | Reads the real `dist/`; runs inside `make build` |
| Browser | Playwright, Chromium, axe | `e2e/*.spec.ts` | Serves `dist/` with `astro preview` on PORT_E2E; `scripts/e2e.mjs` builds first when `dist/` is missing |
| Pages | `node --test` | `tests/deploy.test.mjs` | Serves `dist/` through `wrangler pages dev`; needs no Cloudflare account |

The OpenChart packages run for real, so build them first. Tests fake only what they can't control: the PostHog SDK loader and consent store, and browser globals such as a blocked `localStorage`.

- Default to integration tests of observable behavior through public interfaces. Use unit tests for pure logic and a few end-to-end tests for critical journeys.
- Mock only uncontrolled boundaries: third-party services, time and randomness. Match real contracts, including failures.
- A bug fix starts with a reproducing test that fails before the fix. Cover error paths as well as successful operations.
- Await completion or a bounded condition wait, never a guessed sleep.
- Never weaken or skip a test to get green. Read executed and skipped counts; a filter matching no tests proves nothing.

Read [testing](docs/guidance/engineering/testing.md) before writing or changing tests.

## Error handling

Content and demo mistakes fail the build with a typed error that names the file or demo id: `InvalidDemoError` (every validation problem listed), `UnknownDemoError`, `DuplicateDemoError`, `DemoFenceError`, `DemoExportError`, `DuplicatePageError`, `UnknownSectionError`, `InvalidRepoDocError`, `PageLocationError`. In the browser a demo that cannot mount throws `DemoMountError` with the original as `cause`, and `src/scripts/demos.ts` shows the failure state on that figure. Analytics is optional: a blocked SDK leaves it off without rejecting.

- Never swallow an error or turn failure into apparent success. Handle it where recovery is possible, or pass it on.
- Add operation context when wrapping a failure, and preserve the original cause.
- Write actionable messages: what failed, why and the next step when known. Keep secrets out of messages and logs.

Read [error handling](docs/guidance/engineering/errors.md) before changing failure or recovery paths.

## Debugging

- If a fix hasn't worked after two attempts with no new diagnostic step in between, stop. Write down what you learned, list two or three other root-cause hypotheses, and ask which to pursue.
- Read logs and error output before guessing. `astro build` names the page it failed on; Playwright keeps traces in `test-results/` and a report in `playwright-report/`.
- A stray dev or preview server: `bunx astro dev stop` or `bunx astro preview stop`.

## Deploy

- Cloudflare Pages project `openchart`, production branch `main`, served at https://openchart.steamfield.io. Uploads are direct (`wrangler pages deploy`), not Cloudflare's Git integration.
- The Site workflow (`.github/workflows/site.yml`) runs lint, check, test, build, the browser tests and `make deploy-check` on pushes and pull requests that touch the site, `docs/`, `packages/`, `examples/src/data/`, `bun.lock`, the root `package.json` or `bunfig.toml`, the workflow itself or `.github/actions/setup-bun/`. On `main` it then deploys production; on a pull request from a branch of this repository it deploys a preview for that branch, except a branch named `main`, which would upload to production. Runs are serialized per ref, and runs on `main` never cancel one another, so production deploys land in push order.
- Don't mark the checks job a required status check. The workflow is path-filtered, so a pull request that touches none of those paths never runs it and would wait forever.
- Both deploy jobs stay off until the repository variable `SITE_DEPLOY_ENABLED` is `true`. They read `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from repository secrets.
- From a machine: `make deploy-check` needs no account. `make deploy` and `make deploy-preview BRANCH=<name>` need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exported, and stop before building when one is missing. `make deploy-preview BRANCH=main` stops too: `main` is production, so use `make deploy`. Both run the workspace's wrangler (`bunx --no-install`) and never download one.
- Public build-time values (`PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`) come from the environment of `astro build`. In CI they are repository variables, passed only to the production build.
- Response headers (asset caching, security headers) are in `public/_headers`. `scripts/__tests__/site-workflow.test.mjs` at the repository root guards the workflow's invariants (run with `bun run test:scripts`).

## Analytics

`src/lib/analytics.ts` is the only module that loads `posthog-js`. `BaseLayout` passes it `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` (empty host means PostHog US cloud); without a key the SDK never loads, which is the state in dev, tests, CI and previews. Consent comes from the shared Steamfield banner (`src/lib/consent.ts`, the `sf-consent` cookie on `.steamfield.io`): until the visitor accepts, PostHog runs cookieless and stores nothing, and a withdrawal removes what it stored. Every event carries `site: "openchart"`. Event names are in `src/lib/events.ts`; send them with `track()`.

## Build workarounds

| Where | What and why | Remove when |
| --- | --- | --- |
| `tests/build.test.ts` | The "adding a docs page" probe copies the site to a `.site-probe-*` directory beside `site/`, not the OS temp dir, because the workspace hoists dependencies to the repository root and Node finds them by walking up | Dependencies install inside `site/` |
| `astro.config.mjs` | Astro and Vite caches are per checkout in `.astro-cache/` and `.vite-cache/`, so worktrees sharing a symlinked `node_modules` don't share a cache | Worktrees stop sharing `node_modules` |
| Repository root | The site resolves the OpenChart packages through their `dist/`, so `bun run build` at the root must run before any site command | The packages export source for the site |

## Deferred

- Search: `BaseLayout` has an empty `search` slot; no indexer yet.
- A pull request comment with the preview URL.

## Pending user actions

Steps only a human can do. Check here before reporting one of these as a problem.

- Create the Cloudflare Pages project `openchart` with production branch `main`. Done when `bunx wrangler pages project list` shows it.
- Attach the custom domain openchart.steamfield.io to the project and add a proxied CNAME in the steamfield.io zone pointing to the project's `pages.dev` subdomain. Done when the domain shows Active in the project.
- Add repository secrets `CLOUDFLARE_API_TOKEN` (scoped to Pages edit on the one account) and `CLOUDFLARE_ACCOUNT_ID`.
- Set repository variable `SITE_DEPLOY_ENABLED` to `true`. Done when the Site workflow's deploy jobs run instead of skipping.
- Optionally set repository variable `PUBLIC_POSTHOG_KEY` (and `PUBLIC_POSTHOG_HOST`) to turn on analytics in production.
- Add the site to the Steamfield product registry and privacy page, which live in another repository.

## Deeper context

Read the engineering guidance before writing code; read the other docs when the task needs them.

| Need | Read |
| --- | --- |
| Engineering rules for every agent | [docs/guidance/engineering/](docs/guidance/engineering/index.md) |
| Where things live, docs pages, Markdown, islands, theme, social cards | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Hooks and settings | [.claude/README.md](.claude/README.md) |
| Quickstart | [README.md](README.md) |
