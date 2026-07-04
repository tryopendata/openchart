# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Breaking Changes

- **area!:** multi-series area charts default to `overlap` mode (gradient-filled, partially translucent) instead of stacked. Pass `mark: { type: 'area', stack: true }` (or `stack: 'zero'`) to opt into the previous stacked behavior. The default change makes per-series comparison the dominant idiom; stacked totals remain a one-flag opt-in.

### Bug Fixes

- **legend:** rows missing the color field no longer manufacture a phantom `undefined` legend entry. In a layered spec every layer's rows flatten into the color-legend source, so a sibling layer (e.g. a diagonal reference-line) that doesn't carry the color field was seeding `String(undefined)` as a category — and with an explicit `scale.domain` it appended past the authored entries, breaking domain authority.
- **layout:** restore bottom margin base padding dropped in v7.1.0 — bottom-aligned legends were rendering outside the SVG viewport because `padding + bottomHeight + xAxisHeight` was incorrectly simplified to `bottomHeight + xAxisHeight`.

### Features

- **endpoint-labels:** right-side per-series label column for multi-series line/area charts. Renders a chip+bar swatch (matching the redesigned legend), the colored series name, and a muted formatted value below. Auto-takes over from the traditional legend on ≥2-series line/area charts unless the user forces `legend: { show: true }`. Bidirectional collision sweep keeps labels stacked without overlap. Optional open-ring marker terminates the line at the chart's right edge; decorative point marks at the same coordinate are auto-suppressed to avoid double-circles.
- **legend:** redesigned categorical swatch as a rounded chip with a colored bar through its midline. Shared between the traditional legend and the endpoint-labels column so a chart never shows two swatch idioms.
- **annotations:** add `dot` and `subtitle` fields to `TextAnnotation` for editorial pull-quote callouts (open-ring marker at the data point + muted second-tone supporting text).
- **chrome:** editorial chrome system — eyebrow (with leading accent dot), brand watermark with accent dot positioned via real text width, and a metric bar that renders below the chrome row.
- **theme:** generalized light-mode line stroke darkening — hue/saturation-aware so achromatic palettes (grays) pass through unchanged while saturated colors get a perceptual lightness reduction for AA contrast on white backgrounds.
- **palette:** new OKLCH-based cyan-led categorical palette tuned for adjacency contrast (cyan and teal no longer neighbor each other).
- **vanilla:** snap-to-data-point crosshair on multi-series line/area charts with merged tooltip and per-series snap dots.

### Bug Fixes

- **legend toggle:** y-axis now rebalances to the visible series when a legend item is clicked (previously the dimmed series's domain stayed reserved). Recompiles on toggle so per-series UI (endpoint markers, labels, series-bound chrome) hides and restores cleanly.
- **legend toggle:** color scale stays locked to the unfiltered series list when items are toggled off — visible lines no longer shift palette indices and mismatch their legend swatches.
- **legend toggle:** annotations are suppressed while any series is runtime-hidden. They were authored against the full dataset; the rebalanced scale would otherwise drift their anchors. Restoring all series restores the authored state.
- **legend toggle:** clicking the last visible series is a no-op rather than producing an empty chart with a fully dimmed legend.
- **endpoint-labels:** track lines instead of uniform stacking — labels stay anchored near their series's actual y-position when there's room, and only stack when collisions force it.
- **endpoint-labels:** open-ring marker cx is now offset by its own radius so the line terminates at the circle edge rather than piercing through the center.
- **endpoint-labels:** bidirectional sweep caps each pass so the tail clamp propagates back through the stack instead of stranding mid-stack overlaps.
- **layout:** clamp `margins.top` rollback when metrics rolls back so the chart area never shifts up on retry.
- **layout:** push bottom chrome (source/byline/footer/brand) below bottom legends so they don't overlap.
- **column-labels:** value labels now render in a separate overlay group above all bars (fixes z-order on grouped charts where tall bars obscured labels from shorter neighbors); label y-position corrected to `mark.y - offset - textHeight` with `dominant-baseline: hanging` so the AABB collision box matches the visible glyph top.
- **axes:** y-axis title position is now computed dynamically from the widest tick label width rather than a fixed 45px offset, preventing title/label overlap on charts with wide currency or large-number tick formatting.
- **axes:** x-axis tick thinning threshold reduced so charts with 3–5 categories no longer drop labels on typical container widths.
- **layout:** bottom margin formula no longer double-counts chrome height, eliminating dead space between the x-axis and the footer/watermark row.
- **theme:** chart background defaults to `transparent` so charts inherit the host container's surface color instead of painting an opaque white rect (breaking change — update visual regression baselines if pinning screenshots).
- **areas:** stacked area gradient in light mode fades cleanly to transparent at the base instead of bottoming out at 35% opacity, which was creating a visible colored wash where bands overlapped.
- **renderer:** font smoothing (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`) applied to all chart text for crisper rendering on macOS and iOS.

### Internal

- **engine:** unified suppression truth table (`legend/suppression.ts`) consulted by the legend, endpoint-labels, and end-of-line label compute paths so the three stay in sync.
- **engine:** factored `formatEndpointValue` so width prediction (before scales) uses the same formatter the renderer eventually applies.
- **engine:** added bidirectional-sweep fuzz test (200 deterministic trials) asserting stack invariants.

### Features (carryover from prior unreleased work)

- **barlist:** add `BarList` chart type — ranked horizontal bar list with proportional fill bars, color encoding, subtitle fields, value formatting, dark mode, animation, and tooltip support across all framework packages (React, Vue, Svelte, vanilla)
- **tilemap:** add entrance animations with deterministic shuffled stagger for organic tile pop-in
- **tilemap:** expand grid to 12 columns, move ME to its own row for more accurate geography
- **tilemap:** add `oc-tilemap-root` CSS class for token and tooltip scoping
- **tilemap:** add `teal` sequential palette
- **engine:** add window transform for year-over-year, period-over-period, and delta calculations
- **engine:** add relative-time filter ("last N units from max date") for timeseries range toggles
- **vanilla:** add crosshair snap-to-nearest tooltip for timeseries charts
- **engine:** add compound axis labels for multi-level temporal formatting
- **marks:** add `size` prop to `MarkDef` for fixed bar/column thickness in pixels
- **marks:** add `'pill'` value for `cornerRadius` to fully round bar/column ends
- **marks:** add `'endpoints'` value for `point` to show only first/last point per series (hollow circles)
- **marks:** add `color` prop to `LabelConfig` for a fixed label color override
- **encoding:** allow `axis: false` on x/y channels to suppress axis entirely (no space reserved)
- **scales:** tighten `nice()` domain when `scale.zero: false` to avoid over-rounding below data range
- **areas:** auto-generate top-to-bottom fade gradient when no explicit fill is set on area marks
- **renderer:** expand SVG clip-path vertically to accommodate point mark radius so endpoints aren't clipped

### Bug Fixes

- **tilemap:** remove tile stroke (cleaner look at small sizes)
- **tilemap:** fix dark mode class management on mount/destroy lifecycle
- **barlist:** fix resize feedback loop by adding `width: 100%; height: 100%` to `oc-barlist-root` and rendering SVG with `viewBox` + CSS width instead of absolute pixel attributes

## [6.25.4] - 2026-04-24

### Features

- **labels:** add boolean shorthand for labels spec

## [6.25.3] - 2026-04-23

### Bug Fixes

- **axes:** restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning

## [6.25.2] - 2026-04-23

### Features

- **layer:** add zIndex to ChartSpec for controlling layer render order

## [6.25.1] - 2026-04-23

### Features

- centralize responsive layout metrics and fix mobile chart alignment

## [6.25.0] - 2026-04-22

### Features

- dual-axis combo charts with independent y-scales

## [6.24.2] - 2026-04-22

### Features

- **annotations:** add halo prop to text annotations

## [6.24.1] - 2026-04-22

### Features

- area y2 bands, annotation responsiveness, bar label improvements

## [6.24.0] - 2026-04-19

### Features

- responsive layout improvements for narrow viewports

### Bug Fixes

- **sankey:** thread measureText through sankey pipeline for accurate text wrapping

## [6.23.1] - 2026-04-14

### Bug Fixes

- **engine:** declare builtin.ts as side-effectful to prevent tree-shaking

## [6.23.0] - 2026-04-14

_No user-facing changes (release pipeline fix)._

## [6.22.0] - 2026-04-14

_No user-facing changes (release pipeline fix)._

## [6.21.0] - 2026-04-14

### Refactor

- **engine:** split axes.ts into ticks and thinning modules
- **engine:** extract pure helpers from compile.ts into compile/ subfolder
- **engine:** extract density filter from bar/column/dot/pie labels
- **vanilla:** extract renderMarks, renderAxes, renderAnnotations, renderLegend, renderChrome, renderBrand into dedicated renderer modules
- **vanilla:** extract svg-dom helpers from svg-renderer

### Bug Fixes

- **engine:** fix continuous axis tick collapse using step-down re-request
- **engine:** strip temporal axes from snapshot to fix macOS/Linux divergence

### Tests

- **engine:** add compile-snapshot integration test as Step 7 oracle

## [6.20.0] - 2026-04-13

### Refactor

- **engine:** extract `formatLabelValue` shared helper for bar/column/dot, remove four duplicate copies
- **core:** extract `wrapText` helper from vanilla renderers (now a public export); sankey keeps heuristic-only wrapping
- **engine:** extract `measureLegendWrap` helper so legend and sankey share one row-wrap implementation
- **vanilla:** remove vestigial 100ms resize delay; chart and sankey mount timing now match
- **vanilla:** unify gradient and clip-path ID generation via `nextSvgId` (gradient IDs stay `oc-grad-N`; clip-path IDs move from random hex to `oc-clip-N`)
- **engine:** de-duplicate legend geometry constants (`SWATCH_SIZE`, `SWATCH_GAP`, `ENTRY_GAP`) into a single export

### Tests

- Add characterization tests pinning v6.14-v6.19 shipped behaviors: horizontal bar gradient orientation, multi-chart gradient ID uniqueness, sankey node-label wrap at narrow widths, sankey `nodeSort`, text-measure 0.57 ratio, top-legend 4px spacing
- Add Playwright visual regression harness with 8 baseline scenarios (bar, gradient bar, multi-series line, stacked column, sankey, pie with legend, annotations, watermark)

## [6.19.3] - 2026-04-11

### Bug Fixes

- **engine:** use vertical overlap detection for y-axis tick thinning
- chrome maxWidth 5px safety buffer to prevent title overflow on mobile

## [6.19.2] - 2026-04-10

### Bug Fixes

- text width ratio, brand reserve, top legend spacing, and breakpoint annotations

## [6.19.1] - 2026-04-10

### Bug Fixes

- auto-orient gradients for horizontal bars and improve validation suggestion
- explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors

## [6.19.0] - 2026-04-10

### Features

- **sankey:** add `nodeSort` prop for explicit node ordering
- **sankey:** add maxWidth-based text wrapping for node labels
- selective `categoryColors`, legend auto-suppression, tick defaults, and docs

## [6.18.0] - 2026-04-10

### Features

- **engine:** refactor annotations and compile into focused modules

## [6.17.0] - 2026-04-10

### Bug Fixes

- create release tags via GitHub API for verified signatures

## [6.16.0] - 2026-04-09

### Bug Fixes

- replace release-please with manual release script
- graph viewport improvements and annotation text halos

## [6.15.1] - 2026-04-08

### Bug Fixes

- negative value bar handling

## [6.15.0] - 2026-04-08

### Features

- consolidate table stories, add gradient fills, and fix temporal scale defaults

## [6.14.0] - 2026-04-07

### Features

- **engine:** refactor annotations and compile into focused modules
- **spec:** Vega-Lite spec alignment and release readiness (#64)
- **core:** add configurable watermark opt-out
- **chart:** add gradient fill support for chart marks (#60)
- **chart:** add grouped/dodged bar and column charts via stack encoding
- **sankey:** sankey label positions spec

### Bug Fixes

- consolidate table stories, add gradient fills, and fix temporal scale defaults
- scale domain, sort defaults, stacked area lines, and tooltip series fields
- several issues found in the core engine (title calculation, formatting, etc)
- negative value bar handling
- add ${version} to group PR title pattern

## [6.13.1] - 2026-04-06

### Bug Fixes

- several issues found in the core engine (title calculation, formatting, etc)

## [6.13.0] - 2026-04-05

### Features

- Vega-Lite spec alignment and release readiness (#64)

## [6.12.0] - 2026-04-05

### Features

- add configurable watermark opt-out

## [6.11.0] - 2026-04-02

### Features

- add gradient fill support for chart marks (#60)

## [6.10.0] - 2026-04-01

### Features

- add grouped/dodged bar and column charts via stack encoding

## [6.9.0] - 2026-04-01

### Features

- sankey label positions spec

## [6.8.0] - 2026-03-31

### Features

- **sankey:** add linkOpacity spec option for user control
- **sankey:** add valueFormat for tooltip and ARIA label formatting

### Bug Fixes

- address 6 editorial feedback issues
- **sankey:** address code review findings

## [6.7.1] - 2026-03-30

### Documentation

- add gentle OpenData references as a data source

## [6.7.0] - 2026-03-30

### Features

- add label prefix option and update brand watermark to tryOpenData.ai

## [6.6.0] - 2026-03-29

### Features

- add sankey diagram visualization type (#52)

### Bug Fixes

- sankey link rendering, animation, watermark, and legend layout

## [6.5.2] - 2026-03-26

### Bug Fixes

- skip annotation margin at compact breakpoints, remove caret connector, improve animation resize handling

## [6.5.1] - 2026-03-26

### Bug Fixes

- correct AnimationStagger.delay default in JSDoc (30 -> 80)

## [6.5.0] - 2026-03-26

### Features

- add CSS entrance animations and modularize styles

## [6.4.1] - 2026-03-26

### Bug Fixes

- move ignoreDeprecations to package tsconfigs

## [6.4.0] - 2026-03-26

### Features

- add rich chart editing with selection, deletion, and inline text editing

## [6.3.0] - 2026-03-26

### Features

- address all FEATURE-REQUESTS.md bugs and feature requests

## [6.2.1] - 2026-03-23

### Bug Fixes

- match temporal tick formatting to scale timezone

## [6.2.0] - 2026-03-23

### Features

- **graph:** add scale config to graph encoding channels and fix color precedence

## [6.1.5] - 2026-03-23

### Bug Fixes

- use UTC methods for temporal granularity and support custom axis/tooltip date formats

## [6.1.2] - 2026-03-23

### Bug Fixes

- improve chart margin computation for labels and annotations
- reserve bottom space for brand watermark in chrome layout
- y-axis title margin and default padding

## [6.0.0] - 2026-03-21

### Breaking Changes

- `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error, this makes it a compile error.

### Features

- add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config
- add label format support to column charts and extract shared formatter
- add responsive overrides, legend hiding, and chrome text wrapping
- add SeriesStyle type for per-series visual overrides
- **core:** add areaChart, donutChart, and dotChart builder functions
- implement seriesStyles in line chart compute pipeline
- **layout:** prevent annotation/label/brand overlap with improved obstacle detection
- narrow createChart types, fix remount bugs, add Visualization component
- rename packages from @opendata-ai/* to @opendata-ai/openchart-*
- **responsive:** height-aware layout, chrome compression, and legend overflow
- space-aware axis tick density and rotated label support
- unified chart element editing system

### Bug Fixes

- **css:** remove height:100% from chart container to fix iOS clipping
- dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle
- **graph:** support viz-dark class on wrapper element in CSS selectors
- move bun-symlink-resolver to scripts/ so it's not gitignored
- **svg:** prevent chart title clipping on iOS Safari

## [2.11.0] - 2026-03-14

### Features

- **layout:** prevent annotation/label/brand overlap with improved obstacle detection
- **axes:** text-aware tick density prevents label overlap

## [2.10.0] - 2026-03-12

### Features

- **responsive:** height-aware layout, chrome compression, and legend overflow
- **graph:** use fit-content to collapse container after canvas shrink

## [2.9.1] - 2026-03-12

### Bug Fixes

- **graph:** top-align fitBounds to eliminate dead space on mobile

## [2.9.0] - 2026-03-12

### Features

- **annotations:** interpolate positions for out-of-domain values on categorical scales

## [2.8.1] - 2026-03-12

### Bug Fixes

- **graph:** support viz-dark class on wrapper element in CSS selectors
- **graph:** apply theme colors and dark mode class to graph wrapper

## [2.8.0] - 2026-03-09

### Features

- Add responsive overrides, legend hiding, and chrome text wrapping

### Bug Fixes

- Move bun-symlink-resolver to scripts/ so it's not gitignored

## [2.7.0] - 2026-03-09

### Features

- Add label format support to column charts and extract shared formatter

## [2.6.0] - 2026-03-09

### Features

- Add format strings, label anchors, series styles, and dark mode docs

### Bug Fixes

- Resolve lint warnings in bar labels formatter

## [2.5.0] - 2026-03-09

### Features

- Add SeriesStyle type for per-series visual overrides
- Implement seriesStyles in line chart compute pipeline
- Export styles.css from all framework packages

### Bug Fixes

- Consolidate brand watermark into single tspan-based text element

## [2.4.0] - 2026-03-08

### Features

- Space-aware axis tick density and rotated label support

## [2.3.5] - 2026-03-06

### Bug Fixes

- Extract brand constants in table renderer

## [2.3.4] - 2026-03-06

### Bug Fixes

- Align canvas brand watermark opacity with SVG and table renderers

## [2.3.3] - 2026-03-06

### Bug Fixes

- Extract brand min-width constant in canvas renderer

## [2.3.2] - 2026-03-06

### Bug Fixes

- Add missing font-weight to table brand watermark

## [2.3.1] - 2026-03-06

### Bug Fixes

- Increase bottom padding on graph watermark to match right padding

## [2.3.0] - 2026-03-06

### Features

- Export core and engine dependencies from client libs so consumers only need a single dependency

## [2.2.1] - 2026-03-06

### Bug Fixes

- Preserve user-provided colors when theme is already dark
- Support transparent backgrounds in dark-mode adapter
- Add tooltip and legend toggle props to Graph components
- Reduce max node radius, label font sizes, and glow intensity

## [2.1.0] - 2026-03-04

### Features

- Visual QA audit fixes and documentation improvements
- Auto-sort line and area chart data by x-axis

### Bug Fixes

- Make publish workflow idempotent for re-runs

## [2.0.0] - 2026-03-03

### Breaking Changes

- `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

- Add areaChart, donutChart, and dotChart builder functions
- Narrow createChart types, fix remount bugs, add Visualization component
- Rename packages from @opendata-ai/* to @opendata-ai/openchart-*

## [1.1.0] - 2026-03-02

### Features

- CodeRabbit and npm publish
- Unified chart element editing system
- New visualize-data skill marketplace plugin

### Bug Fixes

- Replace as any with proper types in engine tests, tone down Claude hook

## [1.0.0] - 2026-02-28

### Added

- Initial release of `@opendata-ai/openchart-core`, `@opendata-ai/openchart-engine`, `@opendata-ai/openchart-vanilla`, `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`
- Chart types: line, area, bar, column, scatter, dot, pie, donut
- Data tables with sort, search, pagination, heatmap, sparklines, inline bars, category colors
- Force-directed graph visualization with canvas rendering
- Declarative annotation system (reference lines, ranges, text callouts)
- Dark mode support (auto, force, off)
- Deep-mergeable theme system
- Auto-generated accessibility (alt text, ARIA labels, keyboard navigation)
- Responsive breakpoint-aware layout
- Export to SVG, PNG, CSV
