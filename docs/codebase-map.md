# Codebase Map

> A persistent reference for agents (and humans) so you don't have to re-investigate the repo from scratch every session. If you find yourself grepping for the same file twice, add it here.
>
> Companion to [architecture.md](./architecture.md). Architecture explains the *why* and the high-level pipeline. This file is the "where does X live" lookup table.
>
> **Keep entries terse.** This file should stay scannable. Add absolute paths, function names, and one-line descriptions. Don't paste code blocks here — link to the source.

## Quick "where is X" table

| Looking for... | File |
|---|---|
| Top-level chart spec types (`ChartSpec`, `Encoding`, `Mark`, `Annotation`, `Chrome`) | `packages/core/src/types/spec.ts` (~1670 lines) |
| Resolved layout types (`ChartLayout`, `ResolvedChrome`, `AxisLayout`, `ResolvedLabel`) | `packages/core/src/types/layout.ts` (~1290 lines) |
| Theme types (`Theme`, `ResolvedTheme`, `ThemeColors`, `ThemeFonts`, `ThemeChromeDefaults`) | `packages/core/src/types/theme.ts` |
| `DEFAULT_THEME` literal | `packages/core/src/theme/defaults.ts` |
| Theme deep-merge | `packages/core/src/theme/resolve.ts` → `resolveTheme()` |
| Dark-mode adapter (binary-search lightness) | `packages/core/src/theme/dark-mode.ts` → `adaptTheme()`, `adaptColorForDarkMode()` |
| Categorical palette (`CATEGORICAL_PALETTE`) and sequential/diverging | `packages/core/src/colors/palettes.ts` |
| Color contrast / accessibility helpers | `packages/core/src/colors/contrast.ts`, `colorblind.ts` |
| CSS tokens (light defaults) | `packages/core/src/styles/tokens.css` |
| CSS dark overrides (`.oc-dark`) | `packages/core/src/styles/dark.css` |
| CSS chrome classes (`.oc-title`, `.oc-subtitle`, etc.) | `packages/core/src/styles/chrome.css` |
| Entrance animation keyframes / CSS rules | `packages/core/src/styles/keyframes.css`, `animation.css`. Update/exit transitions use rAF, not CSS; see `packages/vanilla/src/transition.ts`. |
| Text width estimation | `packages/core/src/layout/text-measure.ts` (`estimateTextWidth`, `estimateCharWidth`) |
| X-axis extent helper + constants | `packages/core/src/responsive/metrics.ts` (`computeXAxisExtentFromLabels`, `X_AXIS_BAND_HEIGHT`, `X_AXIS_TITLE_BAND`, `X_AXIS_TITLE_BAND_ROTATED`) |
| Text wrapping | `packages/core/src/layout/text-wrap.ts` (`wrapText`) |
| Chrome layout computation (title/subtitle/source/byline/footer geometry) | `packages/core/src/layout/chrome.ts` → `computeChrome()` |
| Spec normalization (defaults, shorthand expansion) | `packages/engine/src/compiler/normalize.ts` → `normalizeSpec()` |
| Spec validation | `packages/engine/src/compiler/validate.ts` → `validateSpec()` |
| Top-level compile entry | `packages/engine/src/compiler/index.ts` → `compile()` |
| Chart compile orchestration | `packages/engine/src/compile.ts` → `compileChart()`, `compileFaceted()` |
| Chart-type registry | `packages/engine/src/charts/registry.ts` |
| Chart-type implementations | `packages/engine/src/charts/{bar,column,line,pie,scatter,dot,rule,tick,text}/` |
| Layout: axes (tick generation, density, label fitting) | `packages/engine/src/layout/axes.ts` (`computeAxes`) |
| Inline vs gutter y-tick placement (shared predicate) | `packages/engine/src/layout/axes.ts` (`yTickPositionIsInline`) — single source of truth for `computeAxes`, `plan.ts`, and `dimensions.ts`; keyed on resolved scale type, not field type |
| Band x-label rotation + thinning policy | `packages/engine/src/layout/axes/rotation.ts` (`resolveBandTickAngle`, `bandLabelStride`) — parallel-ribbon collision model, angle ladder flat → -45° → -90°, last-anchored stride safety net; shared by `computeAxes` and `plan.ts` so reserved margin matches rendered angle |
| Layout: dimensions (chrome reservation, chartArea computation) | `packages/engine/src/layout/dimensions.ts` (`computeDimensions`) |
| Layout: facet grid geometry (panel rects, responsive column degradation) | `packages/engine/src/layout/facet.ts` (`computeFacetGrid`, `autoColumns`) |
| Layout: gridlines | `packages/engine/src/layout/gridlines.ts` |
| Layout: scales (d3-scale construction) | `packages/engine/src/layout/scales.ts` |
| Annotations: top-level compile | `packages/engine/src/annotations/compute.ts` → `computeAnnotations()` |
| Annotations: text resolution (anchor → offset → connector) | `packages/engine/src/annotations/resolve-text.ts` |
| Annotations: refline / range | `packages/engine/src/annotations/resolve-refline.ts`, `resolve-range.ts` |
| Annotations: geometry (text bounds, anchor offsets, connector edges) | `packages/engine/src/annotations/geometry.ts` |
| Annotations: collision resolution | `packages/engine/src/annotations/collisions.ts` |
| Annotations: data → pixel resolver | `packages/engine/src/annotations/position.ts` |
| Annotations: shared constants (`ANCHOR_OFFSET=8`, default font, dash patterns) | `packages/engine/src/annotations/constants.ts` |
| Legend layout (entries, wrapping, positioning, `entryPositions`) | `packages/engine/src/legend/compute.ts`, `wrap.ts` |
| Legend / endpoint-label suppression truth table (per-series UI hides when series hidden) | `packages/engine/src/legend/suppression.ts` |
| Endpoint labels: compute (placement, leader lines, anti-overlap sweep) | `packages/engine/src/endpoint-labels/compute.ts` |
| Endpoint labels: number formatting (currency / unit / compact) | `packages/engine/src/endpoint-labels/format.ts` |
| Endpoint labels: text-width prediction for layout reservation | `packages/engine/src/endpoint-labels/predict.ts` |
| Endpoint labels: shared constants (chip padding, swatch geometry, leader gaps) | `packages/engine/src/endpoint-labels/constants.ts` |
| Vanilla mount + lifecycle | `packages/vanilla/src/mount.ts` (~2500 lines) |
| Vanilla SVG renderer entry | `packages/vanilla/src/svg-renderer.ts` → `renderChartSVG()`, `renderFacetedPanels()` |
| Static SVG renderer (SSR) | `packages/vanilla/src/static.ts` → `renderStaticSVG()`. Subpath: `@opendata-ai/openchart-vanilla/static`. Requires `happy-dom` peer dep. |
| Renderer: chrome (title/subtitle/source/byline/footer) | `packages/vanilla/src/renderers/chrome.ts` → `renderChrome()` |
| Renderer: marks (line, area, rect, arc, point, text, rule, tick) | `packages/vanilla/src/renderers/marks.ts` → `renderMarks()`. Returns an optional `<g class="oc-mark-labels">` overlay that `svg-renderer.ts` appends outside the clip path so value labels on tall columns aren't clipped. |
| Renderer: axes | `packages/vanilla/src/renderers/axes.ts` → `renderAxes()` |
| Renderer: annotations | `packages/vanilla/src/renderers/annotations.ts` → `renderAnnotations()` |
| Renderer: legend | `packages/vanilla/src/renderers/legend.ts` |
| Renderer: brand block | `packages/vanilla/src/renderers/brand.ts` |
| Renderer: endpoint labels (line/area series labels at the trailing edge) | `packages/vanilla/src/renderers/endpoint-labels.ts` |
| Renderer: metric bar (chrome metric pills) | `packages/vanilla/src/renderers/metrics.ts` |
| SVG DOM helpers (`createSVGElement`, `setAttrs`, `applyTextStyle`) | `packages/vanilla/src/renderers/svg-dom.ts` (note: `computeXAxisExtent` was removed; use `layout.chrome.bottomAnchorY` instead) |
| Gradient utilities (`LinearGradient` resolution) | `packages/vanilla/src/gradient-utils.ts` |
| Resize observer wiring | `packages/vanilla/src/resize-observer.ts` |
| Animation lifecycle / cleanup | `packages/vanilla/src/animation.ts` |
| Data-update transition driver (rAF-based mark/axis tweening) | `packages/vanilla/src/transition.ts` |
| Mark key serialization / dedup | `packages/engine/src/compiler/keys.ts` |
| Tooltip rendering | `packages/vanilla/src/tooltip.ts` |
| React entry (`<Chart>`, `<DataTable>`, `<Graph>`, `<VizThemeProvider>`) | `packages/react/src/` |
| Vue entry | `packages/vue/src/` |
| Svelte entry | `packages/svelte/src/` |
| Ladle stories root | `examples/src/` |
| Line chart stories (SingleLine, MultiSeries, FiveSeries, AreaChart…) | `examples/src/charts/line.stories.tsx` |
| Theme demo story | `examples/src/theme.stories.tsx` |
| Visual regression spec | `e2e/visual/stories.spec.ts` |
| Visual regression baselines | `e2e/visual/__screenshots__/` |
| TileMap compile (positions, colors, labels, legend) | `packages/engine/src/tilemap/compile-tilemap.ts`. Grid geometry in `tilemap/layout.ts` (`computeTilePositions`, `US_STATE_TILES`, 12×8 grid). |
| TileMap responsive sizing (mobile tile size) | Split across two files: the mount `getContainerDimensions()` in `packages/vanilla/src/tilemap-mount.ts` picks the **height budget** (desktop = square `height=width` cap; below 700px a target-tile-derived budget so tiles don't starve), and `compile-tilemap.ts` reclaims horizontal padding on compact widths (`getBreakpoint` + `HPAD_COMPACT_*`) and scales per-tile font/corner-radius/label-centering in `buildTileMark`. Tile size = `min(width-bound, height-bound)`; on mobile width binds. |
| Release script | `scripts/release.mjs` |

## Package responsibilities (one-liner each)

- **core** — Pure types, theme system, palettes, color/contrast utilities, text measurement/wrapping, CSS tokens. No DOM. Also owns `layout/chrome.ts` because chrome geometry is shared between renderers.
- **engine** — Headless compiler. Spec → normalize → validate → resolve theme → layout (dimensions, scales, axes, gridlines) → marks (per chart type) → annotations → tooltips → a11y → `ChartLayout`. No DOM.
- **vanilla** — Imperative SVG/HTML/canvas rendering. Owns `mount.ts` lifecycle, individual renderers under `renderers/`, resize observer, animation cleanup, tooltips. The vanilla adapter is the only place DOM is touched.
- **react / vue / svelte** — Thin component wrappers around `vanilla`. Lifecycle + reactivity, no rendering logic.

Build order: `core` → `engine` → `vanilla` → (react, vue, svelte in parallel). Workspace deps use `workspace:*`.

## Compile pipeline (anchor file: `packages/engine/src/compile.ts` for charts)

```
VizSpec
  → validateSpec       (compiler/validate.ts)
  → normalizeSpec      (compiler/normalize.ts) — fills defaults, expands shorthand
  → resolveTheme       (core/theme/resolve.ts)
  → adaptTheme         (core/theme/dark-mode.ts) — only when darkMode active
  → computeLegend      (engine/legend/)
  → computeDimensions  (engine/layout/dimensions.ts) — reserves chrome top/bottom, produces chartArea Rect
  → computeScales      (engine/layout/scales.ts)
  → computeAxes        (engine/layout/axes.ts)
  → computeGridlines   (engine/layout/gridlines.ts)
  → chart renderer     (engine/charts/<type>/) — produces Mark[]
  → computeAnnotations (engine/annotations/compute.ts)
  → computeTooltips    (engine/tooltips/)
  → computeA11y        (core/accessibility/)
  → ChartLayout
```

The vanilla adapter (`mount.ts`) takes the resulting `ChartLayout` and calls `renderChartSVG(layout, container, options)`, which dispatches to the per-area renderers (`renderChrome`, `renderAxes`, `renderMarks`, `renderAnnotations`, `renderLegend`).

## Mount lifecycle (`packages/vanilla/src/mount.ts`)

- The user's container gets `.oc-root` and (when dark) `.oc-dark` classes added directly. **No internal wrapper div.**
- The SVG is created and appended to the container by `renderChartSVG`.
- All chrome (title, subtitle, source, byline, footer, legend) renders as SVG `<text>` *inside* the same SVG. There is no DOM/SVG split.
- A `ResizeObserver` triggers recompilation on container size changes; it fires once on first layout, so animation cleanup intentionally suppresses the immediate re-render during the animation window (see `.claude/rules/svg-animation.md`).
- React StrictMode double-mounts. Each `createChart()` call gets a fresh closure with its own `isFirstRender` flag.

## Annotation system (key for editorial features)

- **Position** is data-coordinate, resolved to pixels via the same scales used by marks (`annotations/position.ts`), so annotations stay stable across responsive resizes.
- **Text annotation pipeline** (`resolve-text.ts`):
  1. `resolvePosition` → pixel `(px, py)`
  2. `computeAnchorOffset` → label position offset by `ANCHOR_OFFSET=8` from the data point in the requested anchor direction
  3. `computeConnectorOrigin` → picks the nearest text-box edge for connector start (used for `'straight'` and `'curve'` connectors)
  4. Collision resolution / nudging (`collisions.ts`)
- **Connector union** today: `boolean | 'straight' | 'curve'`. Renderer hardcodes `text-anchor=middle` for multi-line text — anything that wants per-side anchoring on multi-line text needs to override this in the renderer (`packages/vanilla/src/renderers/annotations.ts`).
- **Shared constants:** `annotations/constants.ts` (`ANCHOR_OFFSET`, default font sizing, dash pattern, refline/text fills for light/dark).

## Chrome system

- `Chrome` shape is in `packages/core/src/types/spec.ts`. Fields are `string | ChromeText` (the `ChromeText` form lets users pass `{ text, fontSize, fontWeight, color }` overrides).
- `NormalizedChrome` is in `packages/engine/src/compiler/types.ts`.
- `ResolvedChrome` (with computed `topHeight`, `bottomHeight`, per-element x/y) is in `packages/core/src/types/layout.ts`.
- `computeChrome()` in `packages/core/src/layout/chrome.ts` reserves vertical space and computes element positions.
- `dimensions.ts` (engine) calls `computeChrome` and subtracts top/bottom reservations from the available area to get `chartArea`.
- The renderer (`vanilla/src/renderers/chrome.ts`) is small (~96 lines) — it just maps `ResolvedChrome` to SVG `<text>` elements with the right CSS classes.

## Theme system

- **Default theme:** `DEFAULT_THEME` literal in `packages/core/src/theme/defaults.ts`. Single source of truth.
- **User overrides:** `ThemeConfig` (partial) → `resolveTheme()` deep-merges onto `DEFAULT_THEME` → `ResolvedTheme` (every field set).
- **Dark mode:** `adaptTheme(resolved)` in `dark-mode.ts` swaps surface tokens, adapts categorical palette via binary-search on lightness to preserve contrast against the dark background.
- **CSS tokens** (`tokens.css`, `dark.css`) are *parallel* to the JS theme — both have to stay in sync. Tokens used by chrome/axes/legend; the JS theme is consulted by mark renderers, scale colorings, etc. When you add a token to one, add it to the other.

## Chart-type registry (`engine/src/charts/registry.ts`)

- Side-effect registration: importing `engine/src/charts/<type>/index.ts` calls `registerChartRenderer('<type>', fn)`.
- The compile pipeline calls `getChartRenderer(spec.type)` to dispatch.
- Per-chart-type renderers live under `engine/src/charts/{bar,column,line,pie,scatter,dot,rule,tick,text}/`. Each owns its `compute.ts` (mark generation), often with `__tests__/` alongside.
- Adding a new chart type: create the directory, implement the renderer, import it from `engine/src/index.ts`. The pipeline doesn't change.

## Mark types

- Marks are a discriminated union (`packages/core/src/types/layout.ts`): `LineMark`, `AreaMark`, `RectMark`, `ArcMark`, `PointMark`, `TextMarkLayout`, `RuleMarkLayout`, `TickMarkLayout`.
- `RectMark.orient` (`'horizontal' | 'vertical'`) — set by the engine from encoding (x: quantitative = horizontal bar, y: quantitative = vertical column). **Don't infer from geometry** in renderers; grouped columns with short bars get misclassified.
- The renderer (`vanilla/src/renderers/marks.ts`) has one function per mark type and a `registerMarkRenderer<T>` extension hook.

## Animation system

- **Entrance animations** are pure CSS. Keyframes in `packages/core/src/styles/keyframes.css`, rules in `animation.css`. The renderer stamps CSS custom properties + `data-` attributes on the SVG; `oc-animate` class on the SVG root scopes everything.
- **Update/exit transitions** use a rAF loop in `packages/vanilla/src/transition.ts`, not CSS. The driver matches marks by `data-key`, tweens geometry (rect position/size, line/area path morphs, point cx/cy/r, rule/tick endpoints, text x/y), and also transitions axis ticks and gridlines. Supports interruption retargeting via `snapshot()`.
- The engine resolves `AnimationSpec` → `ResolvedAnimation` (`engine/src/compiler/animation.ts`).
- Mark keys for matching are serialized in `packages/engine/src/compiler/keys.ts`.
- Detailed gotchas (SVG ≠ HTML, mount lifecycle, stacked bar segment chaining, orientation): `.claude/rules/svg-animation.md` — **read before touching animation code.**

## Visual regression

- Playwright spec at `e2e/visual/stories.spec.ts`, baselines under `e2e/visual/__screenshots__/`.
- Baselines are platform-locked (`-chromium-darwin.png`, `-chromium-linux.png`).
- Run: `bun run test:visual` (compare), `bun run test:visual:update` (regenerate).
- Setup on a fresh machine: `bun run test:visual:setup` (installs Chromium ~150MB).

## Conventions worth knowing before coding

- **ESM-only.** Every package is `"type": "module"`.
- **Builds:** `tsup` for everything except `svelte` (uses `svelte-package`).
- **Tests:** vitest + happy-dom. React/Vue/Svelte tests use their respective testing libraries.
- **Linting:** Biome (`bun run lint`).
- **Typechecking:** `bun run typecheck` from root, or per-package `bun run typecheck`. Svelte uses `svelte-check` (not `tsc`).
- **Releases:** `node scripts/release.mjs <patch|minor|major>` — bumps all 6 packages together. Don't edit `package.json` versions by hand. See `.claude/rules/releasing.md`.
- **Vega-Lite alignment:** New spec fields should follow Vega-Lite naming/shape conventions (encoding-centric, not mark-centric). See `.claude/rules/spec-grammar.md`.

## Files agents commonly *think* exist but don't

These are easy mistakes — written down so the next agent doesn't search for them.

- ~~`packages/core/src/labels/chrome.ts`~~ → it's `packages/core/src/layout/chrome.ts`. The `labels/` dir only has `collision.ts`.
- ~~`packages/core/src/theme/light-mode.ts`~~ → does not exist. `adaptForLightLineStroke` lives in `packages/core/src/theme/dark-mode.ts` alongside `adaptColorForDarkMode` and `adaptTheme` (the file owns both directions of palette adaptation).
- ~~`packages/core/src/styles/axis.css`~~ → axis classes live inside `chrome.css`.
- The vanilla package does **not** have a `Chart.tsx` or any framework-specific entry — that's `packages/react/src/Chart.tsx` etc.

## When in doubt

- Run `grep -rn "<symbol>" packages/ --include="*.ts" --include="*.tsx"` from the repo root.
- Use `Skill(openchart:openchart)` for design-philosophy / visual-QA references.
- The skill's `references/visual-qa.md` has a defect catalog with fix patterns for chart rendering issues.
