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
| Chart-type implementations | `packages/engine/src/charts/{bar,column,line,pie,scatter,dot,range,calendar,rule,tick,text}/` (registered via `charts/builtin.ts`) |
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
| Annotations: geometry (text bounds, anchor offsets, ray-box connector exit, connector rebuild, arrowhead points) | `packages/engine/src/annotations/geometry.ts` (`connectorExit`, `refreshConnector`, `computeArrowheadPoints`). No `computeConnectorOrigin` — that's the pre-v8 name. |
| Annotations: `**bold**` span parsing | `packages/engine/src/annotations/rich-text.ts` → `parseAnnotationSpans()`, `RichSpan`, `BOLD_SPAN_FONT_WEIGHT` |
| Annotations: collision resolution | `packages/engine/src/annotations/collisions.ts` |
| Annotations: auto-thinning (demote callouts → numbered footnotes) | `packages/engine/src/annotations/thinning.ts` → `thinAnnotations()`. Three independent demotion rules: pairwise overlap (padded by `COLLISION_PADDING`), containment (`fitsWithin`, checked against `containerBounds ?? plotArea` — callouts legitimately live in the margin, so only labels escaping the *chart* demote), and a `COVERAGE_BUDGET` cap on the share of *plot* area inline labels may claim. The budget is what thins narrow charts — collision resolution spreads labels apart and clamping tucks them back in, so crowded layouts never trip the first two rules. Pinned (`responsive: false`) labels are exempt from the budget. |
| Annotations: data → pixel resolver | `packages/engine/src/annotations/position.ts` |
| Annotations: shared constants (`ANCHOR_OFFSET=28`, `CONNECTOR_STANDOFF=6`, `MIN_CONNECTOR_LENGTH=8`, dot defaults, `LEDE_FONT_WEIGHT`, connector strokes, default font) | `packages/engine/src/annotations/constants.ts` |
| Legend layout (entries, wrapping, positioning, `entryPositions`) | `packages/engine/src/legend/compute.ts`, `wrap.ts` |
| Top-legend / inline-tick clearance (top legend lifted above the reserved inline y-tick overhang) | `packages/engine/src/legend/compute.ts` → `placeLegend(..., axisGapBelowLegend)`, threaded from `computeDimensions`' `effectiveAxisGap` |
| Legend / endpoint-label suppression truth table (per-series UI hides when series hidden) | `packages/engine/src/legend/suppression.ts` |
| Endpoint labels: compute (placement, leader lines, anti-overlap sweep) | `packages/engine/src/endpoint-labels/compute.ts` |
| Endpoint labels: number formatting (currency / unit / compact) | `packages/engine/src/endpoint-labels/format.ts` |
| Compact temporal tick formats (`GRANULARITY_FORMATS_COMPACT`, `formatDate(..., compact)`) | `packages/core/src/locale/format.ts`; the fitting rung that tries compact-at-same-count before thinning lives in `fitContinuousTicks` (`packages/engine/src/layout/axes.ts`). X-axes only — `resolveExplicitTicks` (planner y path) deliberately never compacts; explicit user `axis.format` always wins. |
| Endpoint labels: text-width prediction for layout reservation | `packages/engine/src/endpoint-labels/predict.ts` |
| Endpoint labels: shared constants (chip padding, swatch geometry, leader gaps) | `packages/engine/src/endpoint-labels/constants.ts` |
| Vanilla mount + lifecycle | `packages/vanilla/src/mount.ts` (~2500 lines) |
| Auto-height growth contract (400px is the viz budget; chrome/legend/metrics overheads grow the figure) | `packages/vanilla/src/mount.ts` → `getContainerDimensions()` + the bounded convergence loop in `compile()` |
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
| Series search combobox (`seriesSearch`) | `packages/vanilla/src/series-search.ts`; CSS `packages/core/src/styles/series-search.css` |
| You-draw-it draw-then-reveal (`youDrawIt`) | Engine resolve: `packages/engine/src/compile/you-draw-it.ts` (`ResolvedYouDrawIt`); vanilla overlay + pointer capture: `packages/vanilla/src/you-draw-it.ts` (`createYouDrawIt`), wired in `mount.ts`; CSS `packages/core/src/styles/you-draw-it.css`. Validation in `compiler/validate.ts`. `onReveal` handler in `core/types/events.ts`; `resetDrawing()`/`revealDrawing()` on `ChartInstance`. |
| React entry (`<Chart>`, `<DataTable>`, `<Graph>`, `<VizThemeProvider>`) | `packages/react/src/` |
| Vue entry | `packages/vue/src/` |
| Svelte entry | `packages/svelte/src/` |
| Ladle stories root | `examples/src/` |
| Gallery pages (the public site IA: one file per sidebar page, `export default { title: '<Folder>' }`) | `examples/src/gallery/*.stories.tsx`. Charts: `charts-bar-column`, `charts-line-area`, `charts-pie-donut`, `charts-scatter-distribution`, `charts-building-blocks`. Then `tables`, `graphs`, `sankey-tilemaps`, `dashboards`. Features: `features-annotations`, `features-edit-mode`, `features-animation`, `features-theming`, `features-responsive`, `features-data-encoding`. Plus `welcome` (defaultStory), `showcase`, `playground`. |
| Gallery shell components (page frame, section, lazy-mount Demo card with copyable spec panel, dark-mode context) | `examples/src/components/` (`GalleryPage.tsx`, `Section.tsx`, `Demo.tsx`, `mode-context.ts`, `gallery.css`, barrel `index.ts`). Dark mode keys off `[data-oc-mode]` stamped on the GalleryPage root (crosses the width-addon iframe), never `:root[data-theme]`. `.oc-bleed` is the full-bleed breakout for Showcase. |
| Shared dataset pool (one module per dataset: `export const x = { source, url?, data } as const`) | `examples/src/data/*.ts`, barrel `examples/src/data/index.ts`. No inline data blobs in story files. |
| Demo index registry (Welcome's findability index; single source of truth) | `examples/src/gallery/registry.ts` assembles per-page `examples/src/gallery/<page>.demos.ts` sidecars. Sidecars live outside `*.stories.*` on purpose: Ladle turns every named export in a story file into a story, so a shared `export const demos` collides (e.g. all five Charts pages → duplicate `charts--demos`) and fails `ladle build`. |
| Legacy-slug redirect map (old published `?story=` deep links → new page+anchor; guarantees no 404s after the flip) | `examples/.ladle/redirects.ts`. Provider reads `?story=` on mount and redirects. |
| Ladle config (defaultStory, storyOrder wildcards, width/theme addons) + head (favicon, OG/twitter meta, Bricolage-only font), shell CSS, 11 named themes | `examples/.ladle/config.mjs`, `head.html`, `shell.css`, `themes.ts`. Social OG image: `examples/public/og-preview.png`. |
| Theming gallery page (presets, 11 named themes, custom ThemeConfig, dark adaptation) | `examples/src/gallery/features-theming.stories.tsx` (slug `features--theming`) |
| Visual regression spec | `e2e/visual/stories.spec.ts` |
| Mobile visual regression spec (390px viewport, `visual-mobile` project) | `e2e/visual/stories-mobile.spec.ts` |
| Visual regression baselines | `e2e/visual/__screenshots__/` |
| Mobile layout invariants (6 geometry rules incl. Rule 6 label presence; 4 Playwright projects, the chromium ones run in CI) | `e2e/invariants/mobile-invariants.spec.ts` |
| Blog-theme mobile repro (bugs on labs.tryopendata.ai need `axisTick: 14`, not the 11px default; production mirror story) | `examples/src/charts/mobile-regression.stories.tsx` → `testing--mobile-regression--one-wide-x-label-large-ticks` (retitled `Testing / Mobile Regression`; file stays put, slugs are now `testing--mobile-regression--*`) |
| Frozen e2e fixture copies (pinned visual/invariant stories, pixel-identical, `Testing / Fixtures`) + frozen stylesheet | `examples/src/testing/fixtures-*.stories.tsx` (+ `testing.css`, the `.tfix-` frozen namespace). Slugs are `testing--fixtures--*`. Includes `rotated-with-source`, moved here from `examples/src/charts/`. |
| TileMap compile (positions, colors, labels, legend) | `packages/engine/src/tilemap/compile-tilemap.ts`. Grid geometry in `tilemap/layout.ts` (`computeTilePositions`, `US_STATE_TILES`, 12×8 grid). |
| TileMap responsive sizing (mobile tile size) | Split across two files: the mount `getContainerDimensions()` in `packages/vanilla/src/tilemap-mount.ts` picks the **height budget** (desktop = square `height=width` cap; below 700px a target-tile-derived budget so tiles don't starve), and `compile-tilemap.ts` reclaims horizontal padding on compact widths (`getBreakpoint` + `HPAD_COMPACT_*`) and scales per-tile font/corner-radius/label-centering in `buildTileMark`. Tile size = `min(width-bound, height-bound)`; on mobile width binds. |
| Parliament (hemicycle) mark compute (seat-packing, majority line) | `packages/engine/src/charts/parliament/compute.ts` (`computeParliamentMarks`). Emits existing `PointMark`/`RuleMarkLayout`/`TextMarkLayout` (no bespoke layout). Axisless mark, rides the chart pipeline like waffle. Tooltips: `tooltips/compute.ts` `computeParliamentTooltips` (one shared tooltip per party). |
| Arc angle range (half-donut / election donut) | `markDef.startAngle`/`endAngle` (radians, d3 convention) handled in `packages/engine/src/charts/pie/compute.ts` (`computeSweepBounds` fits a partial sweep). |
| Release script | `scripts/release.mjs` |
| Published JSON Schema (LLM tool-use) | `packages/core/schema/{vizspec,chart,table}.schema.json` — generated, committed, exported via the core `./schema` subpath (NOT the barrel). Generator: `scripts/generate-schema.mjs` (ts-json-schema-generator over `packages/core/src/types/schema-roots.ts`; hoists a shared `ChartSpecBase` def). |
| `llms.txt` generator | `scripts/generate-llms.mjs` — hand-written narrative + a mark-encoding table generated from the built core's `MARK_ENCODING_RULES`/`MARK_DISPLAY_NAMES`. Build core first. |
| Freshness CI (schema + llms.txt) | `bun run check:generated` (both generators in `--check` mode); wired into `.github/workflows/ci.yml` after typecheck. Editing spec types without regenerating fails CI. |
| Schema/artifact tests | `packages/core/src/schema/__tests__/{schema,generated-artifacts}.test.ts` (ajv-validates all 16 marks, rejects hallucinated fields, asserts artifacts cover every mark). |
| "Did you mean" repair hints | levenshtein `editDistance`/`nearestColumn`/`didYouMean` in `packages/engine/src/compiler/validate.ts` (wired into DATA_FIELD_MISSING suggestions). Test: `validate-did-you-mean.test.ts`. |
| LLM spec-generation eval (manual, per-release) | `scripts/llm-eval/` (`fixtures.json`, `run.mjs`, `README.md`). Hits the Anthropic API; not in CI; `@anthropic-ai/sdk` is not a monorepo dep (dynamic import). |
| Generating-specs guide | `docs/generating-specs.md` (schema usage, tool-use, strict-mode transform, validate-repair loop). |
| v8 migration guide | `docs/migrating-v8.md` (breaking changes, before/after specs, jq codemods). Keep in sync with the deprecation warnings. |
| VL-idiom sugar + deprecation warnings | `packages/engine/src/compile/spec-sugar.ts` (`expandSpecSugar`, `emitSpecWarnings`) — dead channels (`radius`/`shape`/`href`/`order`, removed in v8), stack default, theta<->y (theta is canonical in v8; `y` on arc/waffle/parliament is a deprecated alias, expanded both directions since the engine still reads `y` internally), `'rule'`->`'refline'` annotation alias, `$schema`. All of these run pre-validation so canonical form is all `compiler/normalize.ts`/`validate.ts` ever see. Tests: `engine/src/__tests__/spec-sugar.test.ts`. |

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
  2. `computeAnchorOffset` → label position offset by `ANCHOR_OFFSET=28` from the data point in the requested anchor direction
  3. Bounds: `computeTextBlockBounds` for the primary text and (when present) the subtitle, `unionRects`'d into one block. The connector and the collision system both work against that union, never the label alone.
  4. `connectorExit(bounds, targetX, targetY, standoff = CONNECTOR_STANDOFF)` (`geometry.ts`) → casts a ray from the block center toward the data point, exits the box with a 6px standoff, returns `{ x, y, exit: 'horizontal' | 'vertical' }`, or `null` when the target sits inside the block. There is no `computeConnectorOrigin` any more.
  5. Collision resolution / nudging (`collisions.ts`), then auto-placement Pass 2 (`compute.ts`). Both move the subtitle with its label and rebuild the connector.
- **`refreshConnector(connector, bounds, markerRadius)`** (`geometry.ts`) is the single rebuild path used by `resolve-text.ts`, `compute.ts` Pass 2, and every `collisions.ts` reposition. It re-runs `connectorExit` for `from` and re-derives `to` by pulling back from `connector.endpoint` (never from the already-pulled-back `to`). Returns `undefined` when the connector should be suppressed.
- **Connector suppression:** a connector shorter than `MIN_CONNECTOR_LENGTH` (8) after pullback, or one whose target is inside the text block, is dropped. The dot survives. `MIN_CONNECTOR_LENGTH` must stay well under the standoff + marker-pullback overhead (~18px) that is spent before any line is drawn — set it near or above that and the default annotation becomes structurally unable to draw a connector at any offset, which is exactly the bug `842c1dc` fixed. A plain `{type:'text'}` annotation sits `ANCHOR_OFFSET` (28) off its point and draws a real leader with zero authoring.
- **One marker system.** `annotation.dot` is it — the renderer's old hardcoded bullseye (ring + center dot) is gone. `resolveDot` (`resolve-text.ts`) resolves a default dot whenever a connector is enabled, no arrowhead is set, and `dot` is `undefined`. `dot: false` → bare. Arrow + unset `dot` → no marker. The dot sits on the data point (plus `connectorOffset.to`), not on the pulled-back connector tip. Drop-lines get one too.
- **Connector spec union**: `boolean | ConnectorType | ConnectorConfig` where `ConnectorType = 'straight' | 'curve' | 'drop-line'` and `ConnectorConfig = { type: ConnectorType, arrow?: boolean }`. Defaults: `arrow=true` for curve, `arrow=false` for straight/drop-line. Resolved connector carries `arrow: boolean` and `exit`. Two voices: arrowed connectors take the label's text ink, quiet leaders (non-arrow straight, drop-line) take `LIGHT/DARK_CONNECTOR_STROKE`. Curves render as a single quadratic; arrowheads are a stroked open-V `<polyline>` (`geometry.ts:computeArrowheadPoints`, a public engine export, defaults length 7 / halfWidth 3.5).
- **Rich text** (`annotations/rich-text.ts`): `parseAnnotationSpans(line)` → `RichSpan[]` for `**bold**` markers, in `text` and `subtitle`. Unmatched (and empty) delimiters render literally. `computeTextBlockBounds` measures bold spans at `BOLD_SPAN_FONT_WEIGHT` (700), so bounds, collisions, placement, and connector exits all account for them. Exported from `engine/src/index.ts` for the renderer.
- **Alignment:** the *text* never center-aligns. `textAnchor` is `'end'` when `anchor: 'left'` (block sits left of the point, right edge faces it) and `'start'` otherwise; the auto-placement `DIRECTIONS` table in `placement.ts` assigns start/end by direction.
- **Block centering (distinct from text alignment):** a `top`/`bottom` anchor means the block sits *above/below* the point, so it straddles it horizontally — the lines inside stay left-aligned/ragged-right. Explicit path: `centeringShift` in `resolve-text.ts` backs `labelX` off by half the widest line (primary vs subtitle — a subtitle is often wider). Auto path: `labelPositionFromAttachment` in `placement.ts` honors `attach: 'top-center'`/`'bottom-center'`. Skip either and `anchor: 'top'` renders as "up and to the right", forcing authors to hand-compute a negative `dx` of half the block width.
- **Typography:** 13px / weight 400 by default, in `theme.fonts.family` (threaded via `AnnotationContext.fontFamily` from `compile.ts`; `FALLBACK_FONT_FAMILY` covers SSR paths). The **lede rule** (`resolveLedeFontWeight`): a `subtitle` with no explicit `fontWeight` promotes the primary text to `LEDE_FONT_WEIGHT` (700); the subtitle stays 400.
- **Thinning** (`annotations/thinning.ts`): `thinAnnotations(annotations, specs, measure, plotArea?, containerBounds?)` demotes overlapping/overflowing labels to numbered footnotes. Containment is checked against `containerBounds ?? plotArea` — annotations legitimately sit in the margin (above a peak, below a trough), so only labels escaping the *chart* demote. The coverage budget still measures against the plot.
- **`specIndex` — the resolved array is NOT the spec array.** `computeAnnotations` drops any annotation whose position falls outside the scale domain, so `annotations[i]` is not `spec.annotations[i]`. Every resolved annotation carries `specIndex` for the trip back; thinning's priority/`responsive` lookup and the faceted footnote numbering both key on it. Indexing `specs[i]` by resolved position is the bug this exists to prevent — it silently mis-associates annotations, and it only shows up once one of them fails to resolve.
- **Faceted thinning** (`compile.ts`, in `compileFaceted`): faceted charts do *not* reach the single-chart `thinAnnotations` call — `compileChart` branches to `compileFaceted` first, so before this existed `autoThin` on a facet was a silent no-op and labels sprawled across neighbouring panels. Each panel now thins against its own `gridPanel.area`, passed as **both** `plotArea` and `containerBounds` (a panel is its own little chart). Footnotes pool into one figure-level `chrome.footnotes` list; since a spec annotation resolves into *every* panel, numbering is keyed on `specIndex` so a label demoted in all N panels gets one footnote, not N copies. The bottom-margin reserve loop mirrors the single-chart path, `frozenChartArea` guard included.
- **Shared constants:** `annotations/constants.ts` (`ANCHOR_OFFSET`, `CONNECTOR_STANDOFF`, `MIN_CONNECTOR_LENGTH`, `DEFAULT_DOT_RADIUS`/`_STROKE_WIDTH`, `LEDE_FONT_WEIGHT`, connector strokes, default font sizing, dash pattern, refline/text fills for light/dark).

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

- Registration goes through `engine/src/charts/builtin.ts`: a `builtinRenderers` map lists every renderer key and `registerBuiltinRenderers()` loops over it, calling `registerChartRenderer(key, fn)` as a side effect on first import. Chart-type `index.ts` files only export their renderer; they do not self-register.
- The compile pipeline resolves the renderer key via `resolveRendererKey(markType, encoding, markDef)` (`charts/post-process.ts`; e.g. `'bar'` -> `'bar:vertical'`, `'arc'` -> `'arc:donut'`) and dispatches with `getChartRenderer(key)`.
- Per-chart-type renderers live under `engine/src/charts/{bar,column,line,pie,scatter,dot,range,calendar,rule,tick,text}/`. Each owns its `compute.ts` (mark generation), often with `__tests__/` alongside.
- Adding a new chart type: create the directory, implement and export the renderer from its `index.ts`, and add it to the `builtinRenderers` map in `builtin.ts`. The pipeline doesn't change.

## Mark types

- Marks are a discriminated union (`packages/core/src/types/layout.ts`): `LineMark`, `AreaMark`, `RectMark`, `ArcMark`, `PointMark`, `TextMarkLayout`, `RuleMarkLayout`, `TickMarkLayout`.
- `RectMark.orient` (`'horizontal' | 'vertical'`) — set by the engine from encoding (x: quantitative = horizontal bar, y: quantitative = vertical column). **Don't infer from geometry** in renderers; grouped columns with short bars get misclassified.
- The renderer (`vanilla/src/renderers/marks.ts`) has one function per mark type and a `registerMarkRenderer<T>` extension hook.

### Text marks (`engine/src/charts/text/index.ts`)

Its real job is **direct labeling**: a text layer over a point/bar layer, not a standalone text scatter. Three constraints, each of which was a shipped bug:

- **`text` must stay in the position-encoding list in `layout/scales.ts`** (alongside `point`/`beeswarm`/`range`, which get `scale.zero = false`). Text encodes position, not length. When it was missing, a text layer resolved a zero-anchored domain while the point layer it labeled resolved a tight one, and every label drifted off its dot — up to 160px at the low end.
- **`TextMarkLayout.dominantBaseline` is opt-in and only `computeTextMarks` sets it** (to `'central'`). `charts/calendar/compute.ts` and `charts/parliament/compute.ts` also emit `textMark`s and hand-compute their `y` against the SVG default (alphabetic) baseline — calendar's `+ labelFont * 0.35` is a manual centering fudge. Making `central` a renderer default double-corrects both and breaks their visual baselines.
- **`mark.dx`/`dy` are baked into `mark.x`/`mark.y`**, with the pre-offset anchor kept in `anchorX`/`anchorY`. Don't emit them as SVG `dx`/`dy`: `transition.ts` tweens the `x`/`y` attributes and `marks.ts` rotates about `(mark.x, mark.y)`, so a separate offset attribute leaves both reading the un-offset anchor.

The `size` channel maps a field onto a font-size range with a **linear** scale (`encoding.size.scale.{domain,range}` override it; `mark.fontSize` sets a static size). Linear, not the `scaleSqrt` scatter uses for bubbles — sqrt is right for *area*, but a glyph reads by its height. Note there is **no size legend anywhere in the library** (`engine/src/legend/compute.ts` handles color only), so `size` on text is an unkeyed encoding: use it where it reinforces an axis that's already present.

## Layered scales (`engine/src/compile/layer.ts`)

Shared scales means shared **domains**, not just a shared plot rect. `compileLayer` freezes the primary's chart area for every leaf (`frozenChartArea`), but each leaf otherwise re-fits its own domain from its own rows — so a layer holding fewer or narrower rows than its siblings (a label layer naming only the notable points) lands on a different scale and its marks slide off the ones they annotate. `computeSharedDomains`/`withSharedDomains` union the quantitative x/y extents across all leaves and pin them. The union bails on any channel where a leaf is non-quantitative or has an author-pinned `scale.domain`.

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
