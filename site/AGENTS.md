# openchart

Instructions for coding agents working in this repository. Keep this file under about 200 lines: it is loaded at the start of every session. Put detail that matters only for one area in a doc and link it from Deeper context.

<!-- Setup note (delete this comment when done): each comment below that starts with the fill marker says what to write from the real project. Replace it with real content, or delete the section if it truly doesn't apply. `stacks verify` fails while any remain. -->

## Overview

<!-- stacks:fill Two or three sentences: what this project is, who uses it, and the main technologies. -->

## Commands

Run these from the repo root. They are the only supported way to build, test, and run the project; if a command here is wrong, fix it here in the same change.

| Command | What it does |
| --- | --- |
| `make install` | Install dependencies (frozen lockfile when CI is set) and, outside CI, Playwright's Chromium |
| `make dev` | Astro dev server on PORT_WEB |
| `make lint` | Biome for TS, JS, CSS and JSON; Prettier for .astro files |
| `make format` | Apply Biome and Prettier fixes |
| `make check` | Type-check pages, components and content (astro check) |
| `make test` | Unit and component tests |
| `make coverage` | Unit and component tests with coverage |
| `make build` | Static build into dist/, then the acceptance tests over it |
| `make preview` | Serve the production build on PORT_WEB |
| `make e2e` | Browser and accessibility tests against the production build |
| `make clean` | Remove build output, test output and Astro caches |
| `make deploy-check` | Build, then serve dist/ through wrangler pages dev and check headers, canonical URLs and the 404 page |
<!-- stacks:fill Make the table match the real Makefile or scripts: keep install, dev, test, a single test, lint, format, typecheck, build, and any service start/stop, remove rows for commands that don't exist, and run each once to confirm it works. Include how to run one test file. -->

## Architecture map

<!-- stacks:fill A short tree of the top-level directories and what lives in each, plus one line on how requests or data flow between the parts. Only directories that exist. -->

## Agent harness

<!-- stacks:fill Document the selected agents' actual harness: where hooks, rules and skills live and which config wires each agent's hooks. Include a table mapping each rule to the paths it covers. Link any harness docs. Keep this section for Codex-only and multiple-agent projects too. Before writing it, when both Claude Code and Codex are targets, make one skill tree: move each `.agents/skills/*` directory into `.claude/skills/` without overwriting an existing skill, then replace `.agents/skills` with a tracked symlink to `../.claude/skills` (or create the symlink if `.agents/skills` does not exist), and write new skills under `.claude/skills/`. With Codex alone, skills live in `.agents/skills/`; with Claude alone, in `.claude/skills/`. When the project has `.claude/rules/` and Codex is a target, add: "Codex does not load `.claude/rules/` automatically: it reads the rules covering the files it changes before editing them." -->


## Conventions

<!-- stacks:fill The patterns this codebase follows that an agent would not guess: module boundaries, where config is loaded, naming, how generated code is produced and that it is never hand-edited. -->

- Prefer the project's existing patterns and dependencies over new ones. Add a dependency only when nothing in the project already covers the need.
- Keep changes scoped to the task. Mention unrelated problems you notice instead of fixing them in the same change.
- Organize folders by feature or domain. Give each module one responsibility; keep domain rules independent of I/O and use public interfaces across boundaries.
- Name files for their contents. Keep functions small, with names that read as the steps of the operation; avoid catch-all utils and speculative abstractions.
- Put a file-level doc comment at the top of every source file explaining its role in the system, using the language's convention (JSDoc for TS/JS, a module docstring for Python, a package comment for Go, `//!` for Rust). Keep required directives in place; generated source stays generator-owned.
- Add a README.md to each folder that is a meaningful architectural unit: purpose, place in the system and where to start reading. Judge whether trivial folders, fixtures or generated output need one; don't add empty ceremony.
- Keep comments about constraints and reasons. Let names and types explain ordinary mechanics, and update documentation when responsibilities change.

Read [code style](docs/guidance/engineering/code-style.md) and [architecture](docs/guidance/engineering/architecture.md) before writing code.

## Guardrails

- Destructive commands, credential-shaped writes and real `.env` writes are guarded by native hooks when this project targets Claude Code, Codex, OpenCode or Cursor. A block means ask the user; never rephrase a command or use another tool to bypass it.
- Store credentials in environment variables or a secrets manager. Write variable names and placeholders in `.env.example`; ask the user to set real values.
- Load the selected agent's applicable project skills or rules before changing their area.
- Treat lint diagnostics as work to resolve. Run the project check command before finishing; instructions and hooks do not replace tests.

## Testing

<!-- stacks:fill Test layers (unit, integration, end-to-end), which runner each uses, what is real and what is faked, the test harness files to build on, and anything tests need running first (a database, a .env). -->

- Default to integration tests of observable behavior through public interfaces, with real project modules and storage. Use unit tests for pure logic and a few end-to-end tests for critical journeys.
- Mock only uncontrolled boundaries: third-party services, time and randomness. Match real contracts, including failures; don't mock internal modules.
- Assert outputs, typed errors and user-visible results. Name tests for behavior; avoid private state and internal mock-call assertions.
- A bug fix starts with a reproducing test that fails before the fix. Cover error paths as well as successful operations.
- Await completion or a bounded condition wait, never a guessed sleep. Register listeners before triggering events.
- Isolate state and resources per test or worker; restore globals and close resources. Diagnose flakes as state leaks, races or resource conflicts before changing timeouts.
- Never weaken or skip a test to get green. Read executed and skipped counts; a filter matching no tests proves nothing.

Read [testing](docs/guidance/engineering/testing.md) before writing or changing tests.

## Error handling

<!-- stacks:fill The project's error pattern: error types, where errors are caught, logged, and turned into responses or exit codes. -->

- Never swallow an error or turn failure into apparent success. Handle it where recovery is possible, or pass it on.
- Use typed errors, stable codes or the project's Result pattern for expected failures. Catch only what you can handle; let unexpected bugs reach the handling boundary.
- Add operation context when wrapping a failure, and preserve the original cause and stack. Observe failures from promises and background tasks too.
- Log an error once, at the boundary that handles it.
- Fail on missing required dependencies. Retry only transient failures when safe and bounded; optional fallbacks must report degraded behavior, never silently return defaults.
- Write actionable messages: what failed, why and the next step when known. Keep secrets and personal data out of messages and logs.
- Release resources on every exit path. Preserve the primary failure if cleanup also fails.

Read [error handling](docs/guidance/engineering/errors.md) before changing failure or recovery paths.

## Debugging

- If a fix hasn't worked after two attempts with no new diagnostic step in between, stop. Write down what you learned, list two or three other root-cause hypotheses, and ask which to pursue. Running a new diagnostic between attempts resets the count.
- Read logs and error output before guessing.

<!-- stacks:fill Where the running app writes logs, how to get verbose output, and any known failure signatures. Delete this comment if there is nothing project-specific yet. -->

## Build workarounds

Things in the tree that exist to get a build through, not because they are right. Each one says when it can be removed. Re-check them when upgrading the tools involved.

| Where | What and why | Remove when |
| --- | --- | --- |
<!-- stacks:fill Add a row for every workaround, patch, pin, or disabled check you had to introduce while setting the project up. If there are none, write "None yet." under the table header and remove the empty table. -->

## Deferred

Explicitly out of scope for now, so nobody mistakes them for forgotten work.

<!-- stacks:fill List what was deliberately left out (e.g. CI deploys, a production database, a second platform), or write "Nothing yet." -->

## Pending user actions

Steps only a human can do (accounts, API keys, DNS, signing identities). Check here before reporting one of these as a problem.

<!-- stacks:fill List each with how to confirm it is done, or write "None." -->

## Deeper context

Read the engineering guidance before writing code; read the other docs when the task needs them.

| Need | Read |
| --- | --- |
| Engineering rules for every agent | [docs/guidance/engineering/](docs/guidance/engineering/index.md) |
<!-- stacks:fill One row per doc that exists (README, architecture notes, runbooks). Remove the table if there are none yet. -->
