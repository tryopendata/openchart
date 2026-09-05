# Design System

This page documents the visual and interaction language that ships as the
default for every chart, table, map, graph, and sankey diagram: the palette,
type scale, spacing and radius ladders, per-mark defaults, the hover/legend/
tooltip/keyboard language, motion timings, the five named presets, and
dark-mode adaptation rules. It describes what the "design refresh" release
(8.x) actually ships, not the plan that proposed it — every value below was
read from source in `packages/core` and `packages/engine`.

For chart-type selection, editorial writing, and annotation guidance, see
`docs/design-philosophy.md` (via the `openchart` skill). This page is the
reference for the numbers.

## Principles

Precision and trust (the Stripe/Mercury register) applied to editorial
charts. The same quality bar applies everywhere, but execution is
context-driven: a standalone chart breathes (20px padding, a title roughly
twice the subtitle's size), while tables and dashboard tiles run dense.

Pure neutrals on light backgrounds (`#09090b` ink on white). Every secondary
gray is derived by mixing the theme's text color toward its background,
rather than a fixed zinc ladder — a custom warm or cool theme gets matching
grays for free. One accent color (cyan, slot 1 of the categorical palette)
means "the series the headline is about." Data hues are built in OKLCH at
alternating lightness; dark mode raises lightness and trims chroma rather
than reusing light hexes. Structure is drawn with hairlines (14% alpha ink)
and gridlines lighter than the hairline (8% alpha); nothing casts a shadow
except the tooltip.

## Color

### Categorical palette

Six hues, cyan in slot 1. The hue order is cyan (215°) → ochre (70°) → blue
(262°) → rose (350°) → green (155°) → violet (300°), chosen so every
adjacent pair — including the wrap from violet back to cyan — is at least
80° apart. Lightness alternates (high/low/high/low/high/high) rather than
matching across slots: color-vision deficiency collapses hue and only
lightness survives, and a matched-lightness draft of this ramp failed the
repo's own Brettel CVD simulator on the ochre/rose and blue/violet pairs.
Strokes carry more chroma than fills — a fill is the same hue, roughly 0.03
lighter and 0.03 lower chroma — so a bar or slice never shouts as loud as a
line drawn beside it. Dark-mode variants raise lightness by roughly 0.08–0.10
and trim chroma instead of reusing the light hexes.

| Slot | Hue | Stroke (light) | OKLCH | Fill (light) | OKLCH | Stroke (dark) | Fill (dark) |
|---|---|---|---|---|---|---|---|
| 1 | cyan | `#06b6d4` | 0.715 / 0.126 / 215 | `#51bccc` | 0.739 / 0.100 / 209 | `#22d3ee` | `#72cedc` |
| 2 | ochre | `#e29e47` | 0.750 / 0.130 / 70 | `#dda96b` | 0.770 / 0.100 / 70 | `#f9be78` | `#f3c898` |
| 3 | blue | `#4170cb` | 0.559 / 0.150 / 262 | `#587fc8` | 0.601 / 0.120 / 262 | `#6591e1` | `#7698d6` |
| 4 | rose | `#b2417f` | 0.550 / 0.161 / 350 | `#bf6291` | 0.619 / 0.131 / 350 | `#d771a4` | `#d281a8` |
| 5 | green | `#3ca368` | 0.640 / 0.130 / 155 | `#62ab7d` | 0.681 / 0.101 / 155 | `#6ebf8c` | `#82ba95` |
| 6 | violet | `#a584dc` | 0.679 / 0.130 / 300 | `#ae96da` | 0.719 / 0.100 / 300 | `#bca1ed` | `#c2afe7` |

Source: `packages/core/src/colors/palettes.ts` — `CATEGORICAL_PALETTE`,
`CATEGORICAL_FILL_PALETTE`, `CATEGORICAL_PALETTE_DARK`,
`CATEGORICAL_FILL_PALETTE_DARK`. Hexes are precomputed sRGB (an Ottosson
OKLab → linear sRGB → sRGB pipeline run once and committed); raw `oklch()`
strings parse unreliably through d3-color and the dark-mode adapter's
HSL-based binary search, so the OKLCH triple in the table above and in the
source comments is documentation of how each hex was derived, not something
resolved at runtime.

Cyan as a line stroke is drawn through `adaptForLightLineStroke`
(`packages/core/src/theme/dark-mode.ts`), which drops HSL lightness by
roughly 12% absolute on light backgrounds — the accent as a bar fill stays
the light hue above; the same accent as a line stroke on white needs more
contrast than the fill does, so `computeLineMarks` calls the adapter
explicitly rather than drawing the palette literal.

### Extended palette (series 7+)

A domain with more than six categorical series extends from a second
six-slot ramp and emits a warning — six is already the point past which a
chart should bucket the tail (see `other` under Sankey and Waffle below),
facet, or direct-label instead of adding a seventh hue.

```
'#8e8f19' olive      — oklch(0.629 0.130 110)
'#b086eb' periwinkle — oklch(0.701 0.149 302)
'#ac3225' brick      — oklch(0.501 0.161 30)
'#00bfc0' teal       — oklch(0.729 0.124 195)
'#a5538c' mulberry   — oklch(0.560 0.129 340)
'#65b1f6' sky        — oklch(0.740 0.126 248)
```

Source: `packages/core/src/colors/palettes.ts` — `CATEGORICAL_EXTENDED_PALETTE`.
Built by interleaving hue (+40° from each base slot) with lightness
alternating ±0.12, then rotated so slot 7 sits 105° from cyan and never
neighbors it on a seven-slice pie wrap. Every array — the four base arrays
plus this extended ramp — clears `checkPaletteDistinguishability` at
`minDistance` 30 for deuteranopia and protanopia; this is guarded by
`packages/core/src/colors/__tests__/palette-a11y.test.ts`, which also asserts
stroke contrast ≥ 2.2:1 on white and ≥ 3:1 on `#09090b`, fill contrast ≥
2.0:1 light / 3:1 dark, and adjacent-slot hue delta ≥ 80° including the wrap.

### Neutral ramp

Every secondary gray — `--oc-gray-100` through `-800`, `--oc-text-secondary`,
`--oc-text-faint`, `--oc-border` — is computed by mixing the theme's `text`
color toward its `background` in sRGB, not read from a fixed zinc ladder. The
mix weight (share of text in the result) per step: 100 → 0.06, 200 → 0.12,
300 → 0.22, 400 → 0.40, 600 → 0.55, 800 → 0.75. `secondary` equals `800`,
`faint` equals `300`, `border` equals `100`.

Source: `packages/core/src/colors/neutral.ts` — `deriveNeutralRamp(text, bg,
isDark)`. Computed once in `resolveTheme`/`adaptTheme` and carried on
`ResolvedTheme.colors.neutral`; mounts stamp the CSS tokens from it. The
direction is one-way (theme → CSS): engine code reads `theme.colors.neutral.*`
directly and never calls `cssTokenDefault`. When the background is
transparent (the default theme's is) the ramp falls back to the static CSS
token defaults, which is why the default theme and the generated
`tokens.css` never disagree — this fallback is the common path, not an edge
case.

### Semantic colors

| Token | Light | Dark |
|---|---|---|
| `colors.positive` | `#15803d` | `#4ade80` |
| `colors.negative` | `#dc2626` | `#f87171` |
| `colors.gridline` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.06)` |
| `colors.hairline` | `rgba(0,0,0,0.14)` | `rgba(255,255,255,0.14)` |
| `colors.axis` | `#71717a` | `#a1a1aa` |

`axis` is both the axis-line color and the tick-label ink, and must clear
WCAG AA (4.5:1) on its background — zinc-500 hits roughly 5.7:1 on white,
zinc-400 roughly 6:1 on `#09090b`. `--oc-positive`/`--oc-negative` are kept
equal to these theme values by the token-theme-parity test, and each has a
10%-color-mix `-tint` variant (`--oc-positive-tint` / `--oc-negative-tint`)
used for delta chip backgrounds.

Source: `packages/core/src/theme/defaults.ts` (`DEFAULT_THEME`),
`packages/core/src/theme/dark-mode.ts` (`adaptTheme`).

## Typography

One weight ladder everywhere: 400 regular (body), 500 medium (eyebrow,
labels, UI chrome, values), 600 semibold (title, series names, tooltip
title, annotation lede), 700 bold (`**bold**` spans only). Tabular numerals
apply to every number, including static SVG chrome.

| Element | Size | Weight | Color |
|---|---|---|---|
| Title | 26px | 600, -0.022em tracking | `#09090b` |
| Subtitle | 14px | 400 | `#71717a` (muted) |
| Eyebrow | 11px | 500 | `#06b6d4` (accent) |
| Source / byline / footer | 11px | 400 | `#71717a` |
| Body | 13px | 400 | — |
| Axis tick / small | 11px | 400 | — |
| Metric label | 11px | 500 | muted |
| Metric value | 22px | 600 | — |

Source: `packages/core/src/theme/defaults.ts` (`fonts.sizes`, `fonts.weights`,
`chrome.*`). Font family is Inter Variable with the standard system-font
fallback stack; nothing is bundled. Monospace is JetBrains Mono, used by the
`terminal` preset and any mono-family theme.

## Spacing, lines, and radius

| Token | Default |
|---|---|
| `spacing.padding` | 20px |
| `spacing.chromeGap` | 6px |
| `spacing.chromeToChart` | 8px |
| `spacing.chartToFooter` | 8px |
| `spacing.axisMargin` | 6px |

Hairline vs. gridline is a deliberate two-tier system: the hairline (14%
alpha ink) is structural — axis lines, separators, container borders — and
is heavier than the gridline (8% alpha), which is decoration. A gridline
lighter than the line it's drawn relative to reads as texture, not as a
second line competing with the axis.

Radius ladder:

| Token | Default | Used for |
|---|---|---|
| `--oc-radius-sm` | 2px | mark corners (bar/column value-end, calendar and waffle cells), legend swatches, focus rings |
| `--oc-radius-md` | 6px | inputs, buttons, delta chips |
| `--oc-radius-lg` | `var(--oc-border-radius)` (8px) | tooltip, listbox, panels, graph legend/search |
| `--oc-radius-full` | 999px | pill-shaped chips |

`borderRadius` (the `ThemeConfig` field, default 8px) governs containers and
tooltips only; mark geometry always uses the fixed `--oc-radius-sm` (2px)
regardless of what a theme sets, so `essay` (radius 0) and `wire` (radius 2)
still draw a 2px bar-end radius even though their container corners are
square or nearly square.

## Per-mark defaults

**Bars and columns.** `BAR_CORNER_RADIUS` is 2px, applied only to the value
end (`valueEndCorners(orient, negative)` in `packages/engine/src/charts/utils.ts`)
— the baseline end stays square so bars sit flush on the zero line, and a
negative value rounds the opposite pair of corners. Stacked segments stay
square (unrounded) and draw a 1px seam stroke in the resolved background
color so adjacent fills meet WCAG 1.4.11 by separator rather than by hue
contrast alone. Band padding (`DEFAULT_BAND_PADDING`, `packages/engine/src/layout/scales.ts`)
is 0.25, which as a d3 `paddingInner` fraction of the step yields roughly a
one-third gap-to-bar-width ratio.

**Lines.** Stroke width (`LINE_STROKE_WIDTH`) is 2px. Endpoint dot radius is
4px. `stroke-linejoin: round` / `stroke-linecap: round` are set on the path.
A slot-1 (cyan) line stroke on a light canvas is darkened through
`adaptForLightLineStroke` (see Color above).

**Areas.** Solo-series gradient stops fade 20% → 0% opacity top to bottom;
overlapping multi-series areas use a lighter 14% → 0% (a heavier wash
competes with the lines drawn over it). Stacked areas render flat at 92%
fill opacity with no gradient — a vertical gradient inside a stacked band
reads as a value change within the band, so every editorial reference
stacks flat. (Stacked areas do not get the 1px background seam bars use:
`AreaMark` has only one stroke slot, already spoken for by the top edge.)
Sparkline area fill uses the same 20%→0% gradient. Top-edge stroke width
matches `LINE_STROKE_WIDTH`.

**Scatter.** Point stroke width is 1.5px (a knockout stroke that separates
touching dots). Fill opacity is 0.85 for layers under 200 points, 0.6 above
that count (dense layers need the extra transparency to keep overplotting
readable). Trendline color is `colors.axis` (not `colors.text`), dashed
`4 4`.

**Pie / donut.** Slice stroke is background-aware (falls back to `#ffffff`
when the background isn't opaque) at 1.5px. Labels read `"<name> <percent>"`
by default, or the `labels.format` value when set. An opt-in donut center
stat (`markDef.centerLabel: string | { text; subtitle? }`, arc marks only)
renders two stacked decorative text marks on the hole's midpoint: the value
at `metricValue`/600, an optional caption under it at `small`/400 — the
number is already represented by the slices, so these marks are decorative
and excluded from the a11y label.

**Calendar.** Cell corner radius 2px, `shape-rendering: crispEdges`. A
recorded zero takes the lightest step of the (default five-class, quantize)
color ramp; a genuinely missing day keeps `annotationFill` — zero and
missing are visually distinct, the way GitHub's contribution graph
distinguishes them. Gap ladder floors at 2px (not 1px, which antialiases
into the cells). Legend has a compact `Less ▢▢▢▢▢ More` variant, placed
bottom-right.

**Waffle.** Cell corner radius 2px, `crispEdges`. Opt-in `mark.other:
number | { threshold; label? }` merges sub-threshold categories into one
trailing bucket — off by default; every category renders individually
unless you opt in.

**Dumbbell / range.** Dot radius (`DOT_RADIUS`) 5.5px, knockout-stroked in
the background. Default (undirected) coloring: a neutral start dot
(`theme.colors.neutral[400]`) and an accent end dot, connector drawn in
`neutral[400]` at 0.6 opacity — direction reads from which end carries the
accent, without assigning a valence. `markDef.colorByDirection` (opt-in)
colors the connector and end dot by sign instead; it stays opt-in because
red/green is the worst CVD pair and many ranges carry no positive/negative
meaning at all. There's no auto-sort by gap — data order is authorial
intent everywhere in the library; sort explicitly if you want a gap ranking.

**Parliament.** Seat knockout stroke 0.75px in the background. Majority
line label uses `colors.axis`.

Sources: `packages/engine/src/charts/{utils,line/compute,line/area,scatter/compute,
scatter/trendline,pie/compute,pie/labels,pie/index,calendar/compute,
waffle/compute,range/compute,parliament/compute}.ts`.

## Hover, legend, tooltip, keyboard

One hover language, applied everywhere as a CSS class (never inline style,
so it beats the renderer's `opacity` attributes and loses to the transition
driver's per-frame inline `style.opacity` — the precedence a mid-transition
hover needs). Two registers, picked from the layout's distinct `seriesKey`
count (`createHoverEmphasis`, `packages/vanilla/src/interactions/hover-emphasis.ts`):

- Multi-series charts: hovering a mark or a legend entry raises that series
  (`oc-mark--hover` / `oc-legend-entry--hover`) and drops the rest to
  `--oc-hover-dim` (0.3) over `--oc-hover-duration` (140ms)
  (`oc-mark--dim` / `oc-legend-entry--dim`).
- Single-series charts: dim-the-rest on a twelve-column chart is a wave of
  fades on every pointer move, so the hovered mark gets an outline
  (`oc-mark--hover`, full ink plus a 1px stroke) instead, and nothing else
  dims.
- Legend hover always uses the full dim-the-rest register regardless of
  series count — picking a name off the legend is a deliberate gesture, not
  the incidental sweep mark hover is. Hidden legend entries (carrying
  `opacity="0.3"` as an attribute) are skipped by both the hover and dim
  classes so a toggled-off series stays visibly off rather than brightening.

Maps override the dim amount locally (`--oc-map-hover-dim`, 0.75): dimming
3000 county paths at 0.3 reads as a blackout, so map feature hover uses
outline-and-raise only (no sibling dim), and dim-the-rest applies only on
legend-bin hover.

**Crosshair** (`packages/vanilla/src/interactions/crosshair.ts`, line/area
charts). The nearest series at a snapped x position is raised only when the
pointer is within 18px (`EMPHASIS_PROXIMITY_PX`) of that series' point —
beyond it the crosshair and tooltip still track, but nothing dims, so
crossing the chart doesn't re-dim it on every pass. Snap dot radius is
4.5px. Stacked bar and (non-normalized) stacked area tooltips get a `Total`
row equal to the formatted stack sum.

**Legend** (`packages/vanilla/src/renderers/legend.ts`,
`interactions/legend-interaction.ts`). Entries are `role="button"` with
`aria-pressed` mirroring visibility, inside a `role="group"` parent. Each
entry carries a transparent hit rectangle at least 24px tall
(`LEGEND_HIT_HEIGHT`, WCAG 2.2 SC 2.5.8) as the click/hover/focus target.
Click or Enter/Space toggles series visibility; hover and keyboard focus
hover-link the series in the chart.

**Tooltip** (`packages/core/src/styles/tooltip.css`,
`packages/engine/src/tooltips/compute.ts`). Radius `--oc-radius-lg` (8px),
minimum width 140px. Header padding `8px 10px 6px`, body rows `6px 10px 8px`
(`2px 0` per row). Title weight 600, value weight 400/500 (500 for the
nearest/emphasized row). A `role: 'total'` row gets a top hairline border and
600-weight value. The channel consumed by the tooltip title (temporal/nominal
x for lines and columns, nominal y for bars, color when it is the title) is
skipped from the field list so it isn't repeated as a row; explicit
`encoding.tooltip` channels always render verbatim regardless.

**Keyboard.** Gated on `tooltipDescriptors.size === 0 && crosshairController`
(`packages/vanilla/src/interactions/keyboard-nav.ts`) — not on the absence of
`[data-mark-id]`, since line/area groups do carry mark ids. Bar/column/pie/
scatter charts (which have per-mark tooltip descriptors) tab between mark
elements. Line/area charts (whose values live on the snap overlay, not
per-mark descriptors) drive the crosshair instead: ←/→ step snapped x
positions, ↑/↓ cycle the raised series at the current x, Enter/Space
re-shows the current slice, Escape hides everything and clears emphasis.
Legend focus rings draw as a stroke on the 24px hit rect
(`:focus-visible { outline: 2px solid var(--oc-focus) }`).

## Chrome economy

Small containers drop chrome automatically
(`resolveChromeEconomy(width, height)`, `packages/core/src/responsive/breakpoints.ts`):
height under 150px (`HEIGHT_NO_GRID_MAX`) drops gridlines; height under the
existing cramped threshold drops axes entirely; width at the compact
breakpoint caps x-axis tick labels at 3 (`COMPACT_MAX_X_TICKS`). Every drop
is a default — an explicit `axis` config or `axis.grid` on the encoding
channel always wins, at any size. See `docs/dashboards.md` for the full
ladder and the watermark interaction.

## Motion

Entrance animation stays opt-in; when enabled, the defaults are 450ms
duration, 30ms per-mark stagger capped at 300ms total sweep time
(`MAX_TOTAL_STAGGER_MS`), 150ms delay before annotations begin, and no
overshoot (easing stays `smooth`). Update transitions default to 450ms, exit
to 250ms.

| Phase | Duration | Stagger / delay |
|---|---|---|
| Enter | 450ms | 30ms per mark, 300ms total cap |
| Update | 450ms | — |
| Exit | 250ms | — |
| Annotation delay | — | 150ms after marks finish |

Source: `packages/engine/src/compiler/animation.ts` (`ENTER_DEFAULTS`,
`UPDATE_DEFAULTS`, `EXIT_DEFAULTS`, `MAX_TOTAL_STAGGER_MS`,
`DEFAULT_ANNOTATION_DELAY`), mirrored in `packages/core/src/styles/token-definitions.ts`
(`--oc-animation-duration`, `--oc-animation-stagger`, `--oc-annotation-delay`)
and in `packages/vanilla/src/scatter-canvas/entrance.ts` for the canvas point
layer (which cannot import the engine at runtime, so its `MAX_TOTAL_STAGGER_MS`
is a mirrored literal, not an import). `prefers-reduced-motion` already
suppresses all of this.

These motion values were being finalized concurrently with this documentation
pass (a second agent's working tree changes, uncommitted at the time this
page was written) — the numbers above match the design-refresh plan's target
and the on-disk state at write time, but re-verify against
`packages/engine/src/compiler/animation.ts` after that work lands, in case
the committed values diverge from the in-progress edit.

## Presets

Five named presets, exported from `@opendata-ai/openchart-core`:

| Preset | Palette | Background | Title | Radius | Notable |
|---|---|---|---|---|---|
| `editorial` | default six-hue | white / `#09090b` | 26/600 | 8px | The default; empty `ThemeConfig` |
| `essay` | default | warm paper `#faf8f5` / `#1a1816` | 28/600 | 0px | Serif feel via larger sizes, generous spacing |
| `wire` | default | `#ffffff` / `#0a0a0a` | 16/600 | 2px | Dense, tight chrome, dashboard feel |
| `broadsheet` | `#1d5f8a #e3120b #7fb0d3 #e0a63b #3a8a6e #8c8680` | warm paper `#fffdf9` / `#171513` | 24/700 | 0px | Red masthead `rule` (40×3px) and eyebrow; hairline 0.28 alpha |
| `terminal` | dark-mode categorical variants | `#0b0f14` (both modes) | 15/600 | 4px | `seriesStrategy: 'accent-neutral'`, JetBrains Mono available, dense spacing |

`editorial` is `{}` — every other theme value in this document is its
default. `broadsheet`'s slot-2 red (`#e3120b`, OKLCH chroma 0.232) is a
deliberate deviation from the palette's usual chroma ceiling: it's the one
loud hue in an otherwise quiet ramp (the other five broadsheet slots run
0.011–0.137 chroma), kept because it still clears both CVD checks at a
48.7-unit distance against a 30-unit threshold. `terminal` sets no explicit
dark colors of its own beyond its single background/text pair — it resolves
`isDark: true` even when applied in light mode, because its background is
already dark.

`ThemeConfig.rule` — the short colored bar above the chrome block, the
Economist/FT masthead device — is `null` on every preset except
`broadsheet`. See `docs/theming-tokens.md` for the full field shape and how
it composes with dark mode.

Source: `packages/core/src/theme/presets.ts`. Six full gallery house styles
(`Default`, `Ink`, `Midnight`, `Terminal`, `Field`, `Signal`) built on top of
these presets live in `examples/.ladle/themes.ts` and are a separate,
example-only concept from the five presets above — see the `features--theming`
gallery page.

## Dark mode

`adaptTheme` (`packages/core/src/theme/dark-mode.ts`) swaps in dark
defaults only for colors a spec left at their light default — an explicit
override survives dark-mode adaptation untouched. The categorical and fill
palettes swap to their purpose-built dark variants (see the Color section
above) rather than running the light hexes through contrast-equivalence,
which would dull cyan into teal. Gridline goes to `rgba(255,255,255,0.06)`,
hairline to `rgba(255,255,255,0.14)`, axis/tick ink to `#a1a1aa` (roughly
6:1 against `#09090b`), positive/negative to `#4ade80`/`#f87171`. The
neutral ramp is re-derived from the dark text/background pair, not
inverted from the light ramp. A non-opaque (e.g. `transparent`) background
keeps its token but still adopts dark text/axis/gridline colors, since the
container hosting it is dark even when the chart canvas itself has no fill
of its own.
