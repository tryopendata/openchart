# @opendata-ai

Data visualization library monorepo. Declarative chart and table specs rendered via SVG (charts) and DOM (tables).

## Read these first (skip the codebase investigation step)

Before grepping the repo to find where something lives, check:

- [`docs/codebase-map.md`](../docs/codebase-map.md) — lookup table of file paths, function names, package boundaries, and common "files that don't exist but you'll think they do" gotchas. Covers theme infra, annotation system, chrome layout, mark types, animation system, etc.
- [`docs/architecture.md`](../docs/architecture.md) — the high-level *why*: package dependency graph, compile pipeline, registry pattern, theme resolution.

If your task involves finding files/functions in this repo, the codebase map almost certainly already has them. Use it instead of a fresh exploration pass. If something's missing or wrong in the map, update it as part of your work so the next session benefits.

## Architecture

```
packages/
├── core/       # Types, spec builders, formatters, palettes (d3-color, d3-format)
├── engine/     # Spec validation, data compilation, scale/layout (d3-scale, d3-shape, d3-array)
├── vanilla/    # DOM rendering: createChart(), createTable(), createGraph() (d3-force for graphs)
├── react/      # React wrappers: <Chart />, <DataTable />, <Graph />, <VizThemeProvider />
├── vue/        # Vue 3 wrappers: <Chart />, <DataTable />, <Graph />, <VizThemeProvider />
└── svelte/     # Svelte 5 wrappers: <Chart />, <DataTable />, <Graph />, <VizThemeProvider />
examples/       # Ladle stories for interactive development
```

Build order matters: core -> engine -> vanilla + react + vue + svelte (parallel).

## Quick Commands

```bash
bun run build             # Build all packages (respects order)
bun run test              # Run all tests (vitest)
bun run lint              # Biome across all packages
bun run typecheck         # TypeScript --noEmit across all packages
bun run dev               # Ladle dev server (examples)
```

Per-package:

```bash
cd packages/core && bun run test       # Test one package
cd packages/core && bun run typecheck  # Typecheck one package
```

## Prerequisites

- bun - Package manager and runtime
- Node.js - Required by some dev tooling

## Visual Verification

When changes affect chart rendering, use the `playwright-cli` skill to visually verify the result.

## Conventions

- All packages are ESM-only (`"type": "module"`)
- Builds use tsup (except svelte which uses svelte-package)
- Workspace dependencies use `workspace:*` protocol
- Tests use happy-dom for DOM simulation
- React package uses @testing-library/react for component tests
- Vue package uses @vue/test-utils for component tests
- Svelte package uses @testing-library/svelte for component tests
- Svelte package uses svelte-check for typechecking (not tsc)
