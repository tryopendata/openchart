# Migrating to OpenChart v8

Instructions for migrating a consumer app from openchart v7 to v8. Almost all
changes are in the spec objects and TypeScript imports you pass to openchart.
The exceptions are called out explicitly: the renderer choice moved from the
spec to a mount option (section 22), and graph mount failures now throw
(section 18).

## How to use this guide

Work through each numbered section below. Each one describes a single breaking
change: what to search for, what to change, and a before/after example. The
search patterns are exact strings you can grep for in your codebase.

Old specs still compile at runtime for most of these changes (the engine
rewrites deprecated forms and logs a `[openchart]` console warning), but the
TypeScript types reject the old forms at build time.

---

## 1. Stack default flipped on multi-series bar and area

**What changed:** Bar and area charts with a `color` encoding and no explicit
`stack` value now default to `stack: 'zero'` (stacked). In v7 the default was
grouped bars / overlapping areas.

**Who's affected:** Any spec where `mark` is `'bar'`, `'column'`, or `'area'`,
AND `encoding.color` is set, AND neither `encoding.x.stack` nor
`encoding.y.stack` is set. If `stack` is already set to any value, the spec is
fine.

**No console warning.** This is a silent behavior change. The spec is valid in
both versions; it just renders differently.

**Search for:** Specs matching all three conditions:
1. `mark` is `'bar'` or `{ type: 'bar' }` (same for `'column'` and `'area'`)
2. `encoding.color` exists
3. No `stack` property on either `encoding.x` or `encoding.y`

**Fix:** Add `stack: null` to the quantitative channel (usually `y` on column/
area, `x` on horizontal bar) to keep the v7 grouped/overlap behavior. Or add
`stack: 'zero'` to make the stacked intent explicit.

```jsonc
// Before (v7: rendered as grouped bars)
{
  "mark": "bar",
  "encoding": {
    "x": { "field": "quarter", "type": "nominal" },
    "y": { "field": "revenue", "type": "quantitative" },
    "color": { "field": "product", "type": "nominal" }
  }
}

// After (explicit grouped bars, same rendering as v7)
{
  "mark": "bar",
  "encoding": {
    "x": { "field": "quarter", "type": "nominal" },
    "y": { "field": "revenue", "type": "quantitative", "stack": null },
    "color": { "field": "product", "type": "nominal" }
  }
}
```

---

## 2. Arc/waffle/parliament: rename `encoding.y` to `encoding.theta`

**What changed:** The value channel for pie/donut charts is now `theta`, not
`y`. This matches Vega-Lite's arc encoding.

**Who's affected:** Any spec where `mark` is `'arc'`, `'waffle'`, or
`'parliament'` AND the encoding uses `y` instead of `theta`.

**Runtime behavior:** The engine rewrites `y` to `theta` automatically and
logs a warning naming the mark, e.g.: `[openchart] encoding.y on waffle marks
is deprecated in v8; use encoding.theta for the value channel.` If both `y`
and `theta` are set to different channels, `theta` wins and the engine warns
that `y` was dropped.

**TypeScript behavior:** Differs by mark. `ArcEncoding` now requires `theta`,
so an arc spec that only sets `encoding.y` fails the build until you add
`theta` (`y` itself still type-checks on arc as a deprecated alias).
`WaffleEncoding` and `ParliamentEncoding` keep `theta` optional, so a
`y`-only spec still compiles for those marks; there the rename is enforced
only by the runtime warning.

**Search for:** Specs where `mark` is `'arc'`, `'waffle'`, or `'parliament'`
and `encoding.y` exists.

**Fix:** Rename `encoding.y` to `encoding.theta`. Keep the same field, type,
and all other properties.

```jsonc
// Before
{
  "mark": "arc",
  "encoding": {
    "y": { "field": "count", "type": "quantitative" },
    "color": { "field": "category", "type": "nominal" }
  }
}

// After
{
  "mark": "arc",
  "encoding": {
    "theta": { "field": "count", "type": "quantitative" },
    "color": { "field": "category", "type": "nominal" }
  }
}
```

---

## 3. Remove dead encoding channels: `shape`, `radius`, `href`, `order`

**What changed:** These four encoding channels were removed from the
`Encoding` TypeScript interface. They were never implemented. Setting them
in v7 compiled but had no effect on rendering.

**Runtime behavior:** The engine strips them silently and logs a warning per
channel, e.g.: `[openchart] encoding.shape was removed in v8.`

**TypeScript behavior:** Build fails if your code references
`encoding.shape`, `encoding.radius`, `encoding.href`, or `encoding.order`.

**Search for:** Any of these strings in spec objects:
- `encoding.shape` or `shape:` inside an encoding object
- `encoding.radius` or `radius:` inside an encoding object
- `encoding.href` or `href:` inside an encoding object
- `encoding.order` or `order:` inside an encoding object

**Fix:** Delete the property. These channels never did anything, so removing
them is safe. If you were trying to achieve something with them:
- `radius` -> use `mark.innerRadius` / `mark.outerRadius` for donut sizing
- `shape` -> use `encoding.color` or `encoding.strokeDash` to differentiate
  series
- `href` -> handle link navigation in your app, outside the spec
- `order` -> use `sort` on the relevant encoding channel, or pre-sort data

```jsonc
// Before
{
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "value", "type": "quantitative" },
    "shape": { "field": "region", "type": "nominal" },
    "order": { "field": "sortKey", "type": "quantitative" }
  }
}

// After (delete shape and order, use color for series differentiation)
{
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "value", "type": "quantitative" },
    "color": { "field": "region", "type": "nominal" }
  }
}
```

---

## 4. Annotation type `'rule'` renamed to `'refline'`

**What changed:** `RefLineAnnotation.type` only accepts `'refline'` now. The
old `'rule'` value conflicted with the `rule` mark type.

**Runtime behavior:** The engine rewrites `'rule'` to `'refline'` and logs:
`[openchart] annotation type 'rule' is deprecated; use 'refline'.`

**TypeScript behavior:** The type union no longer includes `'rule'`. Build
fails if you use it.

**Search for:** `type: 'rule'` or `type: "rule"` inside an `annotations`
array. Be careful not to match `mark: { type: 'rule' }`, which is a different
thing (a rule mark, not an annotation) and is still valid.

**Fix:** Change `type: 'rule'` to `type: 'refline'` on the annotation object.

```jsonc
// Before
{ "annotations": [{ "type": "rule", "y": 0, "label": "baseline" }] }

// After
{ "annotations": [{ "type": "refline", "y": 0, "label": "baseline" }] }
```

---

## 5. Default number formatting

**What changed:** Charts now render compact notation automatically on all
surfaces: axis ticks, tooltips, value labels, endpoint labels, and legends
show `1k`, `2.5M`, `1.2B` instead of `1,000`, `2,500,000`, `1,200,000,000`.
Tables keep full precision.

**No console warning.** This is a silent behavior change. Axis tick
`1,000,000` becomes `1M`; `50,000` becomes `50k`. Years (integers in
1500-2500) render bare: `2024` not `2,024`. Percent labels drop trailing
zeros: `60%` not `60.0%`. Abbreviation casing changes from uppercase `K` to
lowercase `k` (SI convention).

**Search for:** Specs that rely on the old comma-grouped formatting without an
explicit `axis.format`, `encoding.*.format`, or `valueFormat` override.

**Fix:** Any explicit `format` string takes precedence over the new defaults.
Specs that already set format strings are unaffected. To keep v7 formatting on
a specific axis:

```jsonc
// Before (implicit formatting)
{ "encoding": { "y": { "field": "revenue", "type": "quantitative" } } }

// After (explicit override keeps old look)
{ "encoding": { "y": { "field": "revenue", "type": "quantitative", "axis": { "format": ",.0f" } } } }
```

**New semantic keywords:** `'percent'` and `'currency'` can now be used as
format strings anywhere a d3-format string is accepted. `'percent'`
auto-detects whether values are fractions (0-1 range) or already percentages
and formats accordingly; `'currency'` prepends `$` with comma grouping.

---

## 6. Move `valueFormat` to `encoding.value.format` on sankey/tilemap/barlist

**What changed:** Sankey, tilemap, and barlist specs had a top-level
`valueFormat` string for number formatting. The canonical location is now
`encoding.value.format`, consistent with how every other chart type handles
format strings.

**Runtime behavior:** Both work. `encoding.value.format` takes precedence if
both are set. The engine logs: `[openchart] valueFormat is deprecated; set
format on the encoding value channel instead (e.g. encoding.value.format).`

**TypeScript behavior:** The `valueFormat` property is marked `@deprecated`.
Build still works but linters may flag it.

**Search for:** `valueFormat` on any spec where `type` is `'sankey'`,
`'tilemap'`, or `'barlist'`.

**Fix:** Move the format string value from `valueFormat` to
`encoding.value.format`. Delete the top-level `valueFormat`.

```jsonc
// Before
{
  "type": "barlist",
  "valueFormat": "$,.0f",
  "encoding": { "value": { "field": "amount" } }
}

// After
{
  "type": "barlist",
  "encoding": { "value": { "field": "amount", "format": "$,.0f" } }
}
```

---

## 7. Replace `ChartType` / `CHART_TYPES` / `CHART_ENCODING_RULES` imports

**What changed:** The `ChartType` type alias and the `CHART_TYPES` and
`CHART_ENCODING_RULES` constants were removed from the public exports of
`@opendata-ai/openchart-core`. They were deprecated aliases for `MarkType`,
`MARK_TYPES`, and `MARK_ENCODING_RULES`.

**No runtime warning.** These are import-time removals. If you import them,
the build fails immediately.

**Search for:** These exact import names in your TypeScript/JavaScript files:
- `ChartType` imported from `@opendata-ai/openchart-core`
- `CHART_TYPES` imported from `@opendata-ai/openchart-core`
- `CHART_ENCODING_RULES` imported from `@opendata-ai/openchart-core`

**Fix:** Rename to `MarkType`, `MARK_TYPES`, and `MARK_ENCODING_RULES`. The
values are identical.

```ts
// Before
import { ChartType, CHART_TYPES, CHART_ENCODING_RULES } from '@opendata-ai/openchart-core';

// After
import { MarkType, MARK_TYPES, MARK_ENCODING_RULES } from '@opendata-ai/openchart-core';
```

---

## 8. Delete `labels.offsets`

**What changed:** `LabelConfig.offsets` is deprecated. It let you manually
nudge per-series value labels by pixel offset. The collision system now
handles label positioning automatically.

**Runtime behavior:** The property still works. No console warning. It's
`@deprecated` in the type only and will be removed in a future major.

**TypeScript behavior:** Linters that flag `@deprecated` usage will warn.
Build still passes.

**Search for:** `offsets` inside a `labels` config object on any chart spec.

**Fix:** Delete the `offsets` property.

```jsonc
// Before
{ "labels": { "density": "all", "offsets": { "Product A": { "dy": -4 } } } }

// After
{ "labels": { "density": "all" } }
```

---

## 9. Chart background changed to transparent

**What changed:** `theme.colors.background` defaults to `'transparent'`
instead of `'#ffffff'`. Charts no longer paint an opaque white rectangle
behind the SVG.

**Who's affected:** Apps that embed charts in containers with dark or colored
backgrounds and relied on the chart painting its own white background. If your
container background is white or you already set `theme.colors.background`,
no change needed.

**No spec change required.** This is a theme default change.

**Fix (if needed):** Pass an explicit background color in the theme config or
compile options:

```ts
// In the theme config
{ theme: { colors: { background: '#ffffff' } } }

// Or in compile options
createChart(container, spec, { theme: { colors: { background: '#ffffff' } } })
```

---

## 10. Endpoint labels replace the legend on multi-series line/area

**What changed:** Line and area charts with 2+ series now render a right-side
endpoint-label column (series name + formatted value at the right edge of each
line) instead of a bottom legend. The legend is auto-suppressed to avoid
showing the same information twice.

**Who's affected:** Any multi-series line or area chart. The legend disappears
and endpoint labels appear. If you have layout tests or screenshots that check
for legend presence, they'll fail.

**No spec change required.** This is a rendering default change.

**Fix (if needed):** Force the legend back on:

```jsonc
{ "legend": { "show": true } }
```

---

## 11. Legend swatch redesign

**What changed:** The categorical legend swatch changed from a plain colored
square to a rounded chip with a colored bar through its midline.

**Who's affected:** Visual regression tests or screenshot comparisons that
include legends. The legend content is the same; only the swatch shape changed.

**No spec change required.** Update your visual regression baselines after
verifying the new swatch looks correct.

---

## 12. Text annotation redesign

**What changed:** Text annotations (`{ type: 'text' }`) were redesigned around
the NYT/Datawrapper callout language: left-aligned blocks, one endpoint marker,
two connector voices, inline bold. Seven sub-changes, all visual. The spec surface
is unchanged apart from `**bold**` now being meaningful inside `text` and
`subtitle`.

**Who's affected:** Any spec with a text annotation. There are no runtime
warnings for any of this — the specs are valid in both versions, they just
render differently. Visual regression baselines that include annotations will
all diff.

**Search for:** `"type": "text"` inside an `annotations` array.

### 12a. Multi-line text is left-aligned, not centered

Multi-line annotation *text* used to force `text-anchor: middle`, so every line
was centered against its neighbours. Now the lines are left-aligned and ragged
right (`'start'`), or right-aligned (`'end'`) when `anchor: 'left'` puts the
block to the left of the point so its right edge faces the data.

Note that this is about how the lines align *against each other*, not where the
block sits. A `top`/`bottom` anchored block still straddles its data point
horizontally — "above" still means above, not "up and to the right". You do not
need to hand-compute a negative `dx` to re-center it.

**Fix:** Usually nothing. Re-check any annotation whose `text` contains `\n` and
which relies on the old centered *ragging* for its look; the block position is
unchanged for `top`/`bottom`, and shifts by half a block width only for
`left`/`right` anchors (where the block now hangs off the facing edge).

```jsonc
// Lines were centered against each other; they're now flush left.
// The block still sits centered above the point — no dx needed.
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Supply chain\nunwinds",
  "anchor": "top" }
```

### 12b. A default annotation now draws a leader and a marker

Three linked changes:

- The default label setback (`anchor` with no `offset`) moved from 8px to 28px,
  so a label clears its own marker instead of sitting on top of it.
- Whenever a connector is enabled and carries no arrowhead (straight,
  drop-line), an open-ring marker now renders on the data point by default. It
  used to require `dot: true`. Drop-lines get one too; they silently ignored
  `dot: true` before.
- Connectors shorter than 8px are still dropped — a nub between a label and the
  marker it's already touching reads as noise, not as a leader.

Net effect on a plain `{ type: 'text' }` annotation with no `offset`: it now
renders a ring on the data point **and** a leader line back to the label. In v7
it rendered bare text. Arrowed connectors get no default marker — the arrowhead
already marks the spot.

This is the "minimal spec, publication-ready output" rule: you should not have
to author an `offset` to get a drawn leader.

**Fix:** To get a bare label with no marker and no leader, set `dot: false` and
`connector: false`. To pull the label back in toward the point, set a negative
`offset` — but note that a label close enough to touch its marker will have its
leader suppressed by the 8px minimum.

```jsonc
// v7 look: bare text, no marker, no leader
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Peak",
  "dot": false, "connector": false }

// Default (v8): ring + leader, no authoring required
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Peak" }
```

### 12c. Dot marker defaults changed

`AnnotationDot` defaults: `radius` 5 → 4, `strokeWidth` 2 → 1.5. The default
`stroke` is now the connector's resolved stroke instead of the theme text color,
so the marker and the leader read as one system.

**Fix (if needed):** Pin the old look explicitly.

```jsonc
{ "dot": { "radius": 5, "strokeWidth": 2, "stroke": "#333333" } }
```

### 12d. Typography: 13px, theme font, bold lede

- Default annotation font size is 13px (was 12px).
- Annotation text uses `theme.fonts.family` instead of a hardcoded
  `Inter, system-ui, sans-serif`. This also closes a measure/render font
  mismatch, so bounds and collision nudging are more accurate.
- **Lede rule:** when an annotation has a `subtitle` and you set no
  `fontWeight`, the primary `text` resolves to weight 700 and the subtitle stays
  400.

**Fix (if needed):** Pin `fontSize: 12` to keep the old size. Set `fontWeight`
explicitly to opt out of the bold lede.

```jsonc
{ "type": "text", "x": 4, "y": 90, "text": "Feb. 25", "subtitle": "2015 maximum",
  "fontWeight": 400 }
```

### 12e. Connector and arrowhead redesign

Pure rendering changes, no spec change:

- Curve connectors are a single quadratic arc (was a cubic S-curve).
- Arrowheads are a stroked open V (was a filled triangle). In the DOM they're a
  `<polyline>`, not a `<polygon>` — update any selector that reaches into the
  connector SVG. The endpoint marker classes were also renamed: v7's
  `oc-annotation-endpoint-dot` and `oc-annotation-endpoint-ring` no longer
  exist; the marker element now carries the single class `oc-annotation-dot`.
- Connectors leave the text block via a ray cast from the block center toward
  the data point, with a 6px standoff. Curves no longer always exit the right
  edge.
- Arrowed connectors take the label's text ink; quiet leaders (non-arrowed
  straight, drop-line) take a gray hairline.

**If you call `computeArrowheadPoints` from `@opendata-ai/openchart-engine`
directly:** its defaults changed (`length` 8 → 7, `halfWidth` 4 → 3.5). Pass
explicit values to keep the old geometry.

```ts
computeArrowheadPoints(tipX, tipY, tangentX, tangentY, 8, 4);
```

### 12f. `**bold**` spans now parse in `text` and `subtitle`

`**bold**` marks an inline bold span. It parses in both `text` and `subtitle`.
Matched pairs previously rendered verbatim as literal asterisks.

**Who's affected:** Only specs whose annotation text contains a *matched pair*
of `**`. Unmatched `**` (and empty `****`) still render literally.

**Search for:** `**` inside an annotation `text` or `subtitle` string.

**Fix:** Nothing to do unless you were relying on literal `**` pairs showing up
in the output. If so, break the pair (a single `*` renders as-is) or drop the
asterisks.

```jsonc
// New capability: emphasis on the key phrase, not the whole block
{ "type": "text", "x": "2022-06", "y": 8.5, "text": "Inflation peaked at **8.5%**" }
```

### 12g. A non-zero `offset` now pins a callout: collision avoidance leaves it alone

A text annotation with a non-zero `offset` is treated as hand-placed. It lands exactly
where you put it, and the automatic passes (obstacle avoidance, annotation-vs-annotation
nudging) route *around* it instead of moving it. It is still clamped to the canvas —
pinning exempts a callout from avoidance, not from staying on the page.

Previously the obstacle pass could override an authored offset. Because a line mark is
one long obstacle, the control was not aimable: on a line chart `offset: { dy: -10 }`
moved the block by **zero** pixels, while `dy: -15` teleported it 56px. Same knob, no
monotonicity. Offsets now translate the block by exactly the number you wrote.

Note this is consistent with how an offset was *already* treated everywhere else: any
`offset` has always disqualified an annotation from the automatic placement search. The
offset has always meant "I am placing this myself"; the nudge pass just wasn't listening.

**Who's affected:** Specs that set a non-zero `offset` on a text annotation and were
(knowingly or not) relying on the engine to shove the result somewhere else.

**Search for:** text annotations carrying an `offset`.

**Fix:** Check those callouts render where you want. Since the offset is now obeyed
literally, values tuned by trial-and-error against the old behavior may need retuning —
but they will now behave predictably. If a callout was leaning on the nudge to keep it
off the data, say what you actually meant with `anchor` instead of a magic offset:

```jsonc
// Before: -20 was fighting the default (below-right) anchor, and the obstacle
// nudge was rescuing the result. Honored literally, this lands ON the line.
{ "type": "text", "x": "2021", "y": 33.9, "text": "Obesity flattens here",
  "offset": { "dy": -20 } }

// After: say "above the point" and let the anchor do it.
{ "type": "text", "x": "2021", "y": 33.9, "text": "Obesity flattens here",
  "anchor": "top" }

// Deliberate hand-placement: goes exactly here, nothing moves it.
{ "type": "text", "x": "1910", "y": -0.42, "text": "Coldest decade on record",
  "anchor": "top", "offset": { "dx": 200, "dy": -6 } }
```

---

## 13. Removed CSS custom properties

**What changed:** The following `--oc-*` CSS custom properties were removed from
the stylesheet:

- `--oc-space-1` (was `4px`)
- `--oc-space-3` (was `12px`)
- `--oc-space-6` (was `24px`)
- `--oc-space-8` (was `32px`)
- `--oc-text-subtle` (was `#a1a1aa` light, `#71717a` dark)

These were defined in the stylesheet but never consumed by any `var()` in
openchart's own CSS. `--oc-space-2` and `--oc-space-4` are kept (they are
stamped at mount time from the theme spacing config). If your app reads these
removed properties via `getComputedStyle()` or `var()`, replace with the literal
values shown above.

**New tokens added:**

- `--oc-focus-ring: rgba(59, 130, 246, 0.1)` — focus ring shadow color
- `--oc-focus-ring-strong: rgba(59, 130, 246, 0.25)` — stronger focus ring
  (e.g. graph search input)
- `--oc-editable-hover: rgba(79, 70, 229, 0.35)` — edit-mode hover outline

These are intentionally static (no dark-mode override) to match v7 rendering.

---

## 14. Stylesheet uses cascade layers (`oc.*`)

**What changed:** All openchart CSS rules are now wrapped in
[cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer),
organized as sub-layers of a single `oc` parent:

```
oc.tokens → oc.base → oc.components → oc.animation → oc.reduced-motion
```

**Why this matters:** Un-layered CSS always beats layered CSS regardless of
specificity. If your app has un-layered global resets or normalizers, they will
now override openchart styles where they previously lost on specificity.

**Most common breakage:** Tailwind v3 preflight (or any un-layered global reset)
includes rules like:

```css
button { background-color: transparent; border: 0; }
svg { display: block; }
```

These previously lost to openchart selectors like `.oc-table-pagination button`
(specificity `0,1,1` vs `0,0,1`). With layers, the un-layered preflight now
wins and strips table pagination button styling.

**Fix:** Wrap your reset/normalize in a layer declared before `oc`:

```css
@layer reset, oc;
@layer reset { /* your global reset rules here */ }
```

Tailwind v4+ already layers preflight and needs no change.

**Reduced-motion broadened:** All stylesheet-driven animations and transitions
inside openchart roots are now disabled under `prefers-reduced-motion: reduce`.
Previously only a curated list was covered. Inline-style transitions (e.g. data
update crossfades) are unaffected. This is an intentional accessibility
improvement.

---

## 15. Line charts default to `scale.zero: false`

**What changed:** Line charts now default to `scale.zero: false` on the
quantitative y-axis, so the domain fits the data range instead of anchoring
at zero. This produces tighter, more readable line charts with less dead
space, matching standard editorial practice.

**Who's affected:** Any line chart spec that does not explicitly set
`encoding.y.scale.zero`. The chart will render the same data but the y-axis
range will be tighter, which changes the visual shape of the line.

**No console warning.** This is a silent behavior change.

**Search for:** Specs where `mark` is `'line'` and `encoding.y` has no
`scale.zero` set.

**Fix:** Add `scale: { zero: true }` to the y encoding to restore the v7
behavior:

```jsonc
// Before (v7: y-axis anchored at zero)
{
  "mark": "line",
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "price", "type": "quantitative" }
  }
}

// After (explicit zero-anchored y-axis, same as v7)
{
  "mark": "line",
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "price", "type": "quantitative", "scale": { "zero": true } }
  }
}
```

---

## 16. `scale.scheme` is validated on every spec family

**What changed:** Spec validation now rejects `scale.scheme` where it never
had an effect. Sankey, tilemap, bar list, and graph specs error on any
`scale.scheme` value (those families never read it: sankey cycles
`theme.colors.categorical`, tilemap uses the top-level `palette` property,
bar list cycles its built-in palette, graph reads only `scale.range` and
`scale.domain`). Map specs error on scheme names the map compile path does
not support (maps accept the sequential palettes `blue`, `green`, `orange`,
`purple`, `teal`; a typo used to silently fall back to blue).

**Who's affected:** Specs that set `scale.scheme` on a sankey, tilemap, bar
list, or graph encoding channel (it was dead config — colors were never
affected), or a map spec with a misspelled scheme name (it was silently
rendering the default palette).

**Fix:** Remove the dead `scale.scheme`, or move the intent to the mechanism
that family actually uses (`theme.colors.categorical` for sankey, `palette`
for tilemap, `scale.range` for graph, a supported sequential name for map).
The validation error names the right mechanism for each family.

---

## 17. New chrome layout controls (additive, opt-in)

**What changed:** Two additive chrome features landed in v8: the top-level
`chromeLayout` property and the `maxLines` chrome text style field. Both are
opt-in and default to the historical behavior.

**No migration action required.** Existing specs render exactly as before. Reach
for these only when you want the new behavior.

- `chromeLayout: 'grow'` on a chart spec keeps the plot at its full height
  budget and grows the rendered SVG taller by the measured chrome height, so a
  wrapping title never compresses the plot. Use it for fixed-height article or
  blog charts on narrow viewports. The default `'subtract'` shrinks the plot to
  fit chrome inside a fixed container height. Also honored by bar list, sankey,
  map, and tilemap specs.
- `maxLines` on a chrome text style (`chrome.title.style.maxLines`, etc.) caps
  how many lines the text wraps to, dropping extra lines and truncating the last
  kept line with an ellipsis. Use it to bound a runaway title wrap.

**v1 limitations:**

- `chromeLayout: 'grow'` is a no-op for faceted (small-multiples) specs and
  falls back to `'subtract'`.
- `maxLines` bounds chrome height, not horizontal overflow. A single unbreakable
  word wider than the available width still overflows visually.
- In `'grow'` mode the responsive strategy (whether chrome goes compact or
  labels get suppressed) is still derived from the plot budget height, not the
  final grown SVG height, so a very small budget can still trigger compact
  behavior.
- In `'subtract'` mode, chrome that exceeds ~40% of a fixed container height is
  demoted automatically. This demotion follows the same full -> compact -> hidden
  progression as the min-dimension guardrail, so the outcome depends on the
  incoming chrome mode: a title over the cap on an already-compact layout drops
  chrome to hidden rather than compacting it further. Use `chromeLayout: 'grow'`
  or `maxLines` to keep chrome visible on narrow, title-heavy charts.

---

## 18. Graph animation, interaction, and API changes

v8 gives the graph a motion system (entrance choreography, camera flight, focus
crossfade, update transitions, physics feel) plus a larger imperative API. Most
of it is additive, but a handful of defaults changed. Each item below is a
before/after with the opt-out.

**Animation is default-ON for graphs.** Charts stay opt-IN; graphs are opt-OUT.
This is a deliberate divergence: a graph already moves on load (the force sim
settles), so choreography is the natural default rather than something you switch
on. Charts render static until you add `animation`.

```js
// v8: a graph animates its entrance with no config.
{ type: 'graph', nodes, edges }

// Opt out — instant fit, no reveal/flight (warmup still runs):
{ type: 'graph', nodes, edges, animation: false }
```

Under `prefers-reduced-motion` the entrance is already an instant fit regardless
of this flag.

**Graphs warm up off-screen before first paint.** The simulation now runs up to
100 ticks (capped at a 250ms budget) before the first rendered frame, so the
graph appears mostly settled instead of exploding outward from its initial
placement. Warmup is layout behavior, not animation: it runs even with
`animation: false` and under `prefers-reduced-motion` (it reduces motion — the
opt-outs skip the reveal/flight, not the settle). At thousands of nodes the ms
budget truncates warmup, so some visible settling remains at scale.

```js
// v7 behavior — first paint shows the raw initial ticks:
layout: { warmup: false }

// Or a custom tick count (still capped by the 250ms budget):
layout: { warmup: 40 }
```

**Graph channel `sort` defaults to `'ascending'`.** This affects graph encoding
channels ONLY (`nodeColor.sort`, `edgeColor.sort`, etc.), not charts. Category
domains (legend order, highlight grouping) are now sorted lexically by default so
the output is deterministic across runs. Charts are unchanged.

```js
// v8: nodeColor categories come out sorted ascending.
encoding: { nodeColor: { field: 'group' } }

// Restore prior/insertion order:
encoding: { nodeColor: { field: 'group', sort: null } }
```

An explicit `scale.domain` still wins over `sort`.

**The legend is interactive by default.** Legend rows are now buttons that toggle
category emphasis (dimming the rest through the focus model). If you render your
own legend, or you don't want click-to-toggle:

```js
// Non-interactive swatches (still shows counts):
legend: { interactive: false }

// If you render your own legend UI, turn the built-in off entirely:
legend: false
```

When you do render your own, `getLegend()` returns the resolved legend data
(field, per-category label/color/count/active state, plus edge-legend entries),
and `highlight({ category: { field, value } })` drives the same emphasis the
built-in rows use — no recompilation, no `nodeOverrides` rewriting.

**`zoomToFit` and `zoomToNode` now animate.** They used to snap. They fly by
default (eased camera flight). To snap, pass a zero duration:

```js
graph.zoomToFit();               // v8: animated fit
graph.zoomToFit({ duration: 0 }); // snap, like before
graph.zoomToNode('id', { duration: 0 });
```

**`update()` is unified and its behavior changed.** One `update(spec)` call now
diffs prev vs next internally and picks the right path (position-preserving for a
visual-only change, local reheat for a structural one). The behavior deltas to
know about:

- **The camera no longer resets on update.** Prior versions re-fit on every
  update; now the camera holds where the user left it. Call `zoomToFit()`
  yourself if you want a re-fit after a structural change.
- **Selection persists for surviving ids.** A node that exists in both prev and
  next keeps its selected state across the update; removed ids drop out.
- **Event ordering is guaranteed.** Within an update, structural reconciliation
  completes before any hover/selection/highlight callback fires, so a
  consumer-side tooltip or panel never reads a half-updated node set. This
  removes the race guard hosts used to write by hand.
- **Theme/darkMode-only changes remount, not update.** In the framework wrappers,
  changing `theme` or `darkMode` recreates the instance (the theme is baked at
  mount). The wrappers pass `suppressEntrance: true` on that remount so the
  entrance does NOT replay for an unchanged spec. Real spec changes still go
  through `update()`, which has its own entrance handling. If you drive the
  vanilla `createGraph` directly and recreate for a theme change, pass
  `suppressEntrance: true` yourself.

### What this actually deletes for a custom graph UI

If you shipped your own graph interaction layer on an older version, here is what
this release genuinely lets you remove — stated honestly, no overselling:

- **The dimming-recompile loop.** Emphasizing a neighborhood used to mean
  recompiling the spec with per-node opacity overrides on every hover. Replace it
  with `highlight(target)` (eased crossfade, no recompile) and `clearHighlight()`.
- **Manual text color.** Node/edge label color was often hand-set to survive dark
  mode. The theme now resolves label color against a transparent background
  correctly, so drop the override.
- **The tooltip race guard.** The event-ordering guarantee above removes the
  hand-written "is this node still current?" check around tooltip rendering.
- **The "no smooth camera" gap.** `flyTo`, `centerAt`, `getCamera`, and animated
  `zoomToFit`/`zoomToNode` cover programmatic camera moves. You no longer need to
  tween the transform yourself.
- **The radius override.** Custom radius scaling can move onto the encoding:
  `nodeSize: { scale: { type: 'linear' }, range: [minR, maxR] }` instead of a
  post-compile mutation.

What legitimately REMAINS on `nodeOverrides` (this is fine, not a gap):

- **Seed-node styling** — the styling applied to the seed/root node of a graph.
- **The `alwaysShowLabel` importance threshold** — there is no label-visibility
  encoding channel, so pinning "always label this node" stays an override.

One escape hatch to know: `highlight({ category })` dims everything outside the
category, and it can't exempt the seed node. If you need the seed (or any fixed
node) to stay lit alongside a category, use the `{ nodeIds }` form and include
the seed id yourself.

---

## 19. Update-transition cap counts the larger of the two frames

`animation.update` skips the tween and swaps instantly once a chart has more
marks than the cap allows. That cap used to be tested against the *incoming*
frame only. It now tests the larger of the outgoing and incoming frames:

```
before:  nextLayout.marks.length          > cap
after:   max(prev.marks.length, next.marks.length) > cap
```

**Why:** marks that leave are animated out as ghost elements, and ghosts are
drawn on the destination surface. A chart going from 600 marks down to 300
reports 300 by the old rule and tweens, but it actually renders ~600 elements
for the duration of the transition -- exactly the per-frame cost the cap exists
to bound.

**What changes:** a shrinking update that straddles the cap now swaps instantly
instead of tweening. With the default cap of 500, that is an update whose larger
frame exceeds 500 marks while its incoming frame does not. Growing updates and
updates entirely under the cap are unaffected.

**If you want the tween back**, raise the cap for that chart:

```js
{ animation: { update: { maxMarks: 2000 } } }
```

`maxMarks` is new in v8 (it was a hardcoded 500 before), and it is also the
escape hatch here. Charts rendering points on canvas get a much higher default
(20,000), since canvas does not pay the per-element cost this cap is about.

---

## 20. Scatter point stroke follows the theme background

Scatter and bubble points used to draw a white separator stroke unconditionally.
The white halo is what gives overlapping dots separation on a light ground, but
on a dark canvas it reads as a bright grid of rings. The default stroke now
matches the resolved theme background when that background is an opaque color:

```
before:  stroke = mark.stroke ?? '#ffffff'
after:   stroke = mark.stroke ?? (opaque theme background ? background : '#ffffff')
```

**What changes:** scatter charts on themes with an opaque dark background get
dark separator strokes instead of white ones. The default theme background is
`'transparent'`, so charts without a custom theme are unaffected, as is any
theme whose background does not parse to an opaque color (`'none'`, alpha
`rgba()`).

**If you want the white halo back** on a dark theme, set it explicitly:

```js
{ mark: { type: 'point', stroke: '#ffffff' } }
```

---

## 22. `mark.render` moved to the `renderer` mount option

**What changed:** The rendering surface for point marks (SVG vs canvas) is no
longer declared in the spec. `mark.render` is removed from `MarkDef`; the same
three values now live on a `renderer` option at mount and compile time:

- `createChart(el, spec, { renderer: 'canvas' })` (vanilla)
- `<Chart spec={spec} renderer="canvas" />` (react, vue, svelte)
- `compileChart(spec, { renderer: 'canvas' })` (engine)
- `renderStaticSVG(spec, { renderer })` and `exportSpecSequence({ renderer })`
  accept it too

This mirrors vega-embed's `{ renderer }` embed option: in the Vega ecosystem
the spec describes *what to show* and never carries a renderer field, because
the rendering backend is the host's concern, not the data's.

**Who's affected:** Any spec setting `mark.render`. This only ever applied to
point marks.

**Console warning:** yes. A spec carrying `mark.render` still compiles; the
field is stripped with a `[openchart]` warning naming the replacement. The
chart falls back to `'auto'` until you pass the option at mount.

**Search for:** `render:` inside `mark` objects, or grep for `"render"` in
stored JSON specs.

**Fix:** delete the field from the spec and pass the value where you mount:

```ts
// Before (v7 / v8 RC)
createChart(el, {
  mark: { type: 'point', render: 'canvas' },
  data,
  encoding,
});

// After (v8)
createChart(el, {
  mark: 'point',
  data,
  encoding,
}, { renderer: 'canvas' });
```

For stored JSON specs, a jq codemod:

```bash
jq 'if (.mark | type) == "object" then .mark |= del(.render) else . end' spec.json
```

**Behavior note:** the renderer is now fixed per chart instance. Calling
`.update(spec)` can no longer flip a mounted chart between SVG and canvas by
changing `mark.render`; the only per-update flip left is `'auto'` crossing the
1,000-point threshold as data grows or shrinks. If you were flipping renderers
per update deliberately, remount with a different `renderer` instead.

---

## 23. Geo map API renamed to GeoMap

**Who's affected:** only adopters of the v8 release candidates. The geo map
API never shipped in a stable v7 release, so if you are coming from v7.x this
section does not apply.

**What changed:** every geo-map symbol now carries the `GeoMap` prefix,
matching the `<GeoMap>` component the react/vue/svelte packages already
exported. There are no deprecated aliases. The wire format is unchanged:
specs still use `type: 'map'`.

| RC name | v8 name |
| ------- | ------- |
| `createMap` | `createGeoMap` |
| `MapInstance`, `MapMountOptions`, `MapMarkEvent`, `MapFeatureEvent`, `MapCameraOptions` | `GeoMapInstance`, `GeoMapMountOptions`, `GeoMapMarkEvent`, `GeoMapFeatureEvent`, `GeoMapCameraOptions` |
| `MapSpec`, `MapSpecWithoutData`, `isMapSpec` | `GeoMapSpec`, `GeoMapSpecWithoutData`, `isGeoMapSpec` |
| `MapGeo`, `MapEncoding`, `MapPointsLayer`, `MapProjection`, `MapFocus`, `MapPointsFocus` | `GeoMapGeo`, `GeoMapEncoding`, `GeoMapPointsLayer`, `GeoMapProjection`, `GeoMapFocus`, `GeoMapPointsFocus` |
| `MapLayout`, `MapFeatureMark`, `MapPointMark`, `MapBorders`, `MapFocusLayout` | `GeoMapLayout`, `GeoMapFeatureMark`, `GeoMapPointMark`, `GeoMapBorders`, `GeoMapFocusLayout` |
| `MapProps`, `MapHandle` (react/vue/svelte) | `GeoMapProps`, `GeoMapHandle` |
| `compileMap` (engine) | `compileGeoMap` |

**No console warning.** The old names fail at build time: TypeScript imports
of the RC names no longer resolve.

**Fix:** rename the imports. The names are unambiguous enough for a global
find-and-replace; every occurrence of the RC name is the geo map API (the
tile map API is a separate `TileMap*` family and is untouched).

```ts
// Before (v8 RC)
import { createMap, type MapInstance } from '@opendata-ai/openchart-vanilla';
import type { MapSpec } from '@opendata-ai/openchart-core';

// After (v8)
import { createGeoMap, type GeoMapInstance } from '@opendata-ai/openchart-vanilla';
import type { GeoMapSpec } from '@opendata-ai/openchart-core';
```

---

## Verification

After applying the changes above, run a build and check the console output.
Every remaining deprecated usage (sections 2-4, 6 and 22) logs a `[openchart]`
warning at compile time with the exact fix. Items with no runtime warning:

- **Stack default (section 1):** silent behavior change. Audit multi-series
  bar/area specs manually.
- **Update-transition cap (section 19):** silent behavior change, and only on
  updates that shrink across the cap. If a chart stopped animating between two
  data states, raise `animation.update.maxMarks`.
- **ChartType/CHART_TYPES/CHART_ENCODING_RULES (section 7):** TypeScript
  build fails immediately if you still import them.
- **Visual-only changes (sections 11-12):** nothing to compile against. Check
  them by looking at the charts. If you keep screenshot baselines, expect the
  annotation redesign (section 12) to diff every chart that carries a text
  annotation.
- **CSS layers (section 14):** if you use Tailwind v3 or any un-layered
  global reset, test table pagination buttons and search inputs first.
- **Line chart zero (section 15):** silent behavior change. Audit line chart
  specs manually; y-axis domains will be tighter.
- **Scatter stroke default (section 20):** silent visual change, and only on
  themes with an opaque dark background. Set `mark.stroke` explicitly to opt
  out.
