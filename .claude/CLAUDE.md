# @openchart

Data visualization library monorepo. Declarative chart and table specs rendered via SVG (charts) and DOM (tables).

## Architecture

```
packages/
├── core/       # Types, spec builders, formatters, palettes (d3-color, d3-format)
├── engine/     # Spec validation, data compilation, scale/layout (d3-scale, d3-shape, d3-array)
├── vanilla/    # DOM rendering: createChart(), createTable() (d3-force for graphs)
└── react/      # React wrappers: <Chart />, <DataTable />, <VizThemeProvider />
examples/       # Ladle stories for interactive development
```

Build order matters: core -> engine -> vanilla + react (parallel).

## Quick Commands

```bash
bun run build             # Build all packages (respects order)
bun run test              # Run all tests (vitest)
bun run lint              # ESLint across all packages
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
- Builds use tsup
- Workspace dependencies use `workspace:*` protocol
- Tests use happy-dom for DOM simulation
- React package uses @testing-library/react for component tests
