# Contributing

How to set up the project, run tests, add chart types, add table cell types, and submit changes.

## Prerequisites

- **Bun** (package manager and script runner)
- **Node.js 20+** (runtime for TypeScript tooling)

## Setup

```bash
cd openchart
bun install
```

That's it. Bun installs all workspace packages and links the internal dependencies.

## Development

```bash
bun run dev         # Start the examples dev server (Ladle) at localhost:6006
bun run build       # Build all packages in dependency order
bun run test        # Run all tests
bun run typecheck   # Type-check all packages
bun run lint        # Lint all packages
```

The dev server uses [Ladle](https://ladle.dev) to render stories from `examples/src/`. Each story is a standalone React component that demonstrates a feature. Open it in a browser to see your changes live.

## Project structure

```
openchart/
  packages/
    core/           Types, theme, colors, a11y, locale (no DOM)
    engine/         Headless compiler: spec in, layout out
    vanilla/        DOM rendering: SVG charts, HTML tables
    react/          React components wrapping vanilla
  examples/         Ladle stories for visual development
  docs/             Documentation
```

Dependency direction: `core <- engine <- vanilla <- react`. Never import upstream.

For a deeper look at how the packages fit together, see [docs/architecture.md](docs/architecture.md).

## Adding a chart type

Chart types follow a registry pattern. Each chart registers itself when its module is imported. Use `packages/engine/src/charts/bar/` as a template (it's the simplest one).

### Step 1: Create the directory

```
packages/engine/src/charts/<type>/
  index.ts           # Registry hook + exports
  compute.ts         # Mark computation
  labels.ts          # Label positioning
  __tests__/
    compute.test.ts  # Tests
```

### Step 2: Write the compute function

`compute.ts` exports a function that takes the normalized spec, resolved scales, chart area rect, and layout strategy. It returns an array of marks.

```ts
// packages/engine/src/charts/<type>/compute.ts

import type { Rect } from "@opendata-ai/openchart-core";
import type { LayoutStrategy } from "@opendata-ai/openchart-core";
import type { NormalizedChartSpec } from "../../compiler/types";
import type { ResolvedScales } from "../../layout/scales";

export function computeMyTypeMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
): MyMark[] {
  // Map data rows to positioned marks using the scales
  // Return an array of marks with all positions and colors computed
}
```

Look at `charts/bar/compute.ts` for a concrete example.

### Step 3: Write the label function

`labels.ts` exports a function that computes value labels for the marks.

```ts
// packages/engine/src/charts/<type>/labels.ts

import type { Rect, ResolvedLabel } from "@opendata-ai/openchart-core";

export function computeMyTypeLabels(
  marks: MyMark[],
  chartArea: Rect,
): ResolvedLabel[] {
  // Compute label positions relative to marks
}
```

### Step 4: Register the renderer

`index.ts` composes compute + labels into a `ChartRenderer` and registers it:

```ts
// packages/engine/src/charts/<type>/index.ts

import type { Mark } from "@opendata-ai/openchart-core";
import { registerChartRenderer } from "../registry";
import type { ChartRenderer } from "../registry";
import { computeMyTypeMarks } from "./compute";
import { computeMyTypeLabels } from "./labels";

const myTypeRenderer: ChartRenderer = (spec, scales, chartArea, strategy) => {
  const marks = computeMyTypeMarks(spec, scales, chartArea, strategy);
  const labels = computeMyTypeLabels(marks, chartArea);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }
  return marks as Mark[];
};

registerChartRenderer("<type>", myTypeRenderer);

export { computeMyTypeMarks } from "./compute";
export { computeMyTypeLabels } from "./labels";
```

### Step 5: Wire it up

1. Add the import to `packages/engine/src/index.ts`:

   ```ts
   import "./charts/<type>/index";
   ```

   This import triggers self-registration at module load time.

2. Add the type string to the `ChartType` union in `packages/core/src/types/spec.ts`:

   ```ts
   export type ChartType = 'line' | 'area' | 'bar' | ... | '<type>';
   ```

3. Add encoding rules in `packages/core/src/types/encoding.ts` (which channels are required/optional for this type).

### Step 6: Write tests

```ts
// packages/engine/src/charts/<type>/__tests__/compute.test.ts

import { describe, it, expect } from "vitest";
import { computeMyTypeMarks } from "../compute";

// Create fixture factory functions at the top
function createTestSpec() {
  /* ... */
}
function createTestScales() {
  /* ... */
}

describe("computeMyTypeMarks", () => {
  it("returns marks for each data point", () => {
    const marks = computeMyTypeMarks(spec, scales, chartArea, strategy);
    expect(marks).toHaveLength(4);
  });
});
```

### Step 7: Add a story

Create `examples/src/charts/<type>.stories.tsx` with at least one basic example.

## Adding a table cell type

Table cells use a discriminated union on the `cellType` field. Each cell type has a type definition in core, a computation step in engine, and a renderer in vanilla.

### Step 1: Define the type

Add the interface to `packages/core/src/types/layout.ts`:

```ts
export interface MyFeatureTableCell extends TableCellBase {
  cellType: "myFeature";
  // Type-specific fields
  computedWidth: number;
}
```

Add the new type to the `TableCell` union in the same file.

### Step 2: Add user-facing config

If there's a user-facing config option, add it to `packages/core/src/types/table.ts`:

```ts
export interface MyFeatureColumnConfig {
  someOption?: string;
  maxValue?: number;
}
```

Then add it as an optional field on `ColumnConfig`:

```ts
export interface ColumnConfig {
  // ...existing fields
  myFeature?: MyFeatureColumnConfig;
}
```

### Step 3: Write computation

Create `packages/engine/src/tables/my-feature.ts` that computes the type-specific data:

```ts
export function computeMyFeature(
  values: unknown[],
  config: MyFeatureColumnConfig,
): Map<number, MyFeatureData> {
  // Compute per-row data for this visual feature
}
```

Wire it into `packages/engine/src/tables/compile-table.ts`, following the existing precedence chain (sparkline > bar > heatmap > image > flag > categoryColors).

### Step 4: Write the renderer

Add a render function to `packages/vanilla/src/renderers/table-cells.ts`:

```ts
export function renderMyFeatureCell(
  cell: MyFeatureTableCell,
  td: HTMLTableCellElement,
): void {
  // Create DOM elements for the visual feature
}
```

### Step 5: Add CSS

Add CSS classes (prefixed `oc-table-myFeature`) to the appropriate CSS partial in `packages/core/src/styles/`. Include both light and dark mode variants (dark mode goes in the `.oc-dark` class in `dark.css`).

## Writing tests

- **Framework**: Vitest with workspace projects
- **Location**: Co-located `__tests__/` directories next to the source file
- **File naming**: `<source-file>.test.ts`
- **Environment**: `node` for core and engine, `happy-dom` for vanilla and react

```ts
import { describe, it, expect } from "vitest";

// Fixture factories at the top of the file
function createTestSpec(): ChartSpec {
  return {
    type: "line",
    data: [{ x: 1, y: 2 }],
    encoding: {
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
    },
  };
}

describe("myFunction", () => {
  it("does the thing", () => {
    const result = myFunction(createTestSpec());
    expect(result).toBeDefined();
  });
});
```

Run tests from the repo root:

```bash
bun run test                    # All tests
bun run test -- --watch         # Watch mode
bun run test -- path/to/file    # Single file
```

## Code style

- **TypeScript strict mode**: All packages use strict configuration. No `any` types.
- **Named exports only**: No default exports. Every export goes through the barrel `index.ts`.
- **JSDoc**: Required on all public types and exported functions. Brief description, then `@param` / `@returns` where useful. Skip JSDoc on internal helpers unless the intent isn't obvious.
- **CSS class naming**: Prefix with `oc-`. Use BEM-ish nesting: `oc-table-sort-btn`, `oc-tooltip-value`.
- **CSS custom properties**: Prefix with `--oc-`. Dark mode overrides go in `.oc-dark`.

See [CONVENTIONS.md](CONVENTIONS.md) for the full set of architectural decisions and patterns.

## Releases

Releases are automated via GitHub Actions. The process:

1. **Update versions** in all four `packages/*/package.json` files to the new version number.
2. **Update `CHANGELOG.md`** with the new version and date. Move items from `[Unreleased]` to the new version section.
3. **Commit**: `git commit -m "release: v0.x.0"`
4. **Tag**: `git tag v0.x.0`
5. **Push**: `git push origin main --tags`

The publish workflow runs automatically on version tags. It builds, tests, rewrites `workspace:*` dependencies to the real version, and publishes all four packages to npm in dependency order.

The `NPM_TOKEN` secret is a granular npm token scoped to the `@opendata-ai` org. Granular tokens expire every 90 days, so the token needs periodic rotation in the repo's GitHub Actions secrets.

## PR guidelines

1. **One concern per PR**. A new chart type, a bug fix, or a refactor. Not all three at once.
2. **Tests are required** for new features and bug fixes. The engine is particularly well-suited for unit testing since it's pure computation.
3. **Type-check passes**: Run `bun run typecheck` before opening a PR.
4. **Stories help**: If your change has a visual component, add or update a story in `examples/src/`.
5. **Keep the dependency direction**: Core imports nothing. Engine imports core. Vanilla imports engine and core. React imports vanilla, engine, and core. Never the other way.
