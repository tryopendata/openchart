# openchart conventions

Architectural decisions and patterns for contributors. Not a tutorial. If you're getting started, see the README first.

## Package structure

Four packages, strict dependency direction: `core <- engine <- vanilla <- react`. No lateral imports.

| Package | Purpose | DOM? |
|---------|---------|------|
| `core` | Types, theme, colors, a11y, locale, text measurement | No |
| `engine` | Headless computation: spec in, layout out. Pure math. | No |
| `vanilla` | Imperative DOM rendering (SVG charts, HTML tables) | Yes |
| `react` | React components wrapping vanilla with lifecycle management | Yes |

**Where does new code go?** If it touches the DOM, it belongs in `vanilla` or `react`. If it does math or data transformation, it belongs in `engine`. If it's a type definition, color utility, or theme primitive, it belongs in `core`.

Each package re-exports core types for convenience so consumers don't need to import from multiple packages. The canonical type definitions always live in `core/src/types/`.

## Dependency flow

```
core  <--  engine  <--  vanilla  <--  react
```

- `engine` imports from `core` (types, theme, colors, layout utilities)
- `vanilla` imports from `engine` and `core`
- `react` imports from `vanilla`, `engine`, and `core`
- `core` imports from nothing (zero internal dependencies)

Never import upstream. If `core` needs something from `engine`, the design is wrong.

## Public API (barrel exports)

Each package has an `src/index.ts` barrel that defines its public API. Named exports only, no default exports.

- **Public**: Exported from `index.ts`. Consumers can depend on these.
- **Internal**: Not in `index.ts`. Available via deep imports but considered unstable.

When adding to the public API, use explicit named exports (not `export *` from implementation files). Group exports by domain with comment headers. Re-export core types at the bottom for consumer convenience.

## Adding a chart type

Chart types follow a registry pattern. Each chart registers itself via side effects when its module is imported.

**File structure** (use `packages/engine/src/charts/bar/` as a template):

```
charts/
  <type>/
    index.ts       # Registry hook + public exports
    compute.ts     # Mark computation (the core algorithm)
    labels.ts      # Label positioning for this chart type
    __tests__/
      compute.test.ts
```

Some chart types have additional files for variants (e.g., `line/area.ts`, `scatter/trendline.ts`).

**Steps:**

1. Create the directory under `packages/engine/src/charts/<type>/`
2. Write `compute.ts` with a function that takes `(spec, scales, chartArea, strategy)` and returns `Mark[]`
3. Write `labels.ts` with a function that computes `ResolvedLabel[]` for the marks
4. Write `index.ts` that:
   - Defines a `ChartRenderer` function composing compute + labels
   - Calls `registerChartRenderer('<type>', renderer)`
   - Exports the compute/label functions
5. Add `import './charts/<type>/index'` to `packages/engine/src/index.ts` (the import triggers registration)
6. Export the compute functions from `packages/engine/src/index.ts`
7. Add the type string to `ChartType` union in `core/src/types/spec.ts`
8. Add encoding rules in `core/src/types/encoding.ts`
9. Write tests in `__tests__/compute.test.ts`

**Reference**: `charts/bar/` is the simplest. `charts/line/` shows multi-renderer registration (line + area).

## Adding a table cell type

Table cells use a discriminated union on the `cellType` field. Each cell type has a type definition, a computation function, and a renderer.

**Steps:**

1. Add the interface to `core/src/types/layout.ts`:
   - Extend `TableCellBase`
   - Set `cellType: '<name>'` as a literal discriminant
   - Add any type-specific fields (e.g., `barWidth`, `sparklineData`)
2. Add the new type to the `TableCell` union in `core/src/types/layout.ts`
3. Add the cell type string to the `cellType` union in `ResolvedColumn`
4. Write computation in `engine/src/tables/<name>.ts` (returns a `Map<number, CellStyle>` or type-specific data)
5. Wire it into `engine/src/tables/compile-table.ts` (follows the existing precedence chain)
6. Write the renderer in `vanilla/src/renderers/table-cells.ts`
7. Add CSS classes (prefixed `viz-table-<name>`) to `core/src/styles/viz.css`
8. If there's a user-facing config, add it to `core/src/types/table.ts` as a `ColumnConfig` field

**Reference**: `BarTableCell` for a cell with extra computed fields. `HeatmapTableCell` for a cell that only needs styling.

## File naming

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for a module. Also registration for chart types. |
| `compute.ts` | Core computation logic (marks, cells, layout) |
| `labels.ts` | Label positioning and collision resolution |
| `types.ts` | Types internal to that module (not public) |
| `utils.ts` | Shared helpers within a package |
| `__tests__/*.test.ts` | Co-located tests matching the source file name |

## Type conventions

**Discriminated unions**: Mark types (`LineMark`, `RectMark`, etc.) and table cell types (`TextTableCell`, `BarTableCell`, etc.) use a `type` or `cellType` string literal discriminant. Always narrow with the discriminant before accessing type-specific fields.

**Spec vs layout types**: `core/src/types/spec.ts` defines user input (lots of optionals, permissive). `core/src/types/layout.ts` defines engine output (fully resolved, all required fields, computed positions). Don't mix them up.

**JSDoc**: Required on all public types and exported functions. Brief description, then `@param` / `@returns` where useful. Skip JSDoc on internal helpers unless the intent isn't obvious.

**All layout type fields are required** unless there's a clear reason for optionality (e.g., a connector line that only exists when labels are displaced).

## Test conventions

- **Framework**: Vitest with workspace projects (root `vitest.config.ts` references per-package configs)
- **Location**: Co-located `__tests__/` directories next to the source
- **File naming**: `<source-file>.test.ts` (e.g., `compute.ts` -> `__tests__/compute.test.ts`)
- **Environment**: `node` for core and engine (no DOM needed), `happy-dom` for vanilla and react
- **Pattern**: Create fixture factory functions at the top of the file, then `describe` blocks per function under test
- **Imports**: Import from vitest (`describe`, `it`, `expect`), then from the module under test using relative paths

Run all tests: `bun run test` from the repo root.

## Theme conventions

The theme system has two layers:

1. **CSS custom properties** in `core/src/styles/viz.css` for visual styling
2. **TypeScript theme objects** in `core/src/theme/` for computed values the engine needs

**CSS custom property naming**: Always prefix with `--viz-`. Use descriptive names: `--viz-tooltip-bg`, `--viz-text-secondary`. Dark mode overrides go in the `.viz-dark` class.

**CSS class naming**: Always prefix with `viz-`. Use `viz-[block]-[element]` for children (e.g. `viz-table-sort-btn`) and `viz-[block]--[modifier]` for modifiers (e.g. `viz-table--compact`).

**Adding a theme property**:

1. Add the CSS custom property to `.viz-root, .viz-table-wrapper` (light default) and `.viz-dark` in `viz.css`
2. If the engine needs the value for computation, add it to the `Theme`/`ResolvedTheme` types in `core/src/types/theme.ts`
3. Set the default in `core/src/theme/defaults.ts`
4. Handle dark mode adaptation in `core/src/theme/dark-mode.ts`

**Font stack**: Inter as the primary font, system-ui fallback. Monospace uses JetBrains Mono with fallbacks. Defined in `--viz-font-family` and `--viz-font-mono`.

## Build and tooling

- **Package manager**: Bun (workspace root and all packages)
- **Bundler**: tsup (configured per-package)
- **Test runner**: Vitest
- **Linter**: ESLint 9
- **Formatter**: Prettier
- **TypeScript**: Strict mode, each package has its own `tsconfig.json`

Key commands from the repo root:

```bash
bun run build       # Build all packages in dependency order
bun run test        # Run all tests
bun run typecheck   # Type-check all packages
bun run lint        # Lint all packages
bun run dev         # Start examples dev server (Ladle)
```
