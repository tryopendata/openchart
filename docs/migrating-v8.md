# Migrating to OpenChart v8

Instructions for migrating a consumer app from openchart v7 to v8. All changes
are in the spec objects and TypeScript imports you pass to openchart. The mount
APIs (`<Chart>`, `createChart()`, etc.) and their props are unchanged across
all six packages (core, engine, vanilla, react, vue, svelte).

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
logs: `[openchart] encoding.y on arc marks is deprecated in v8; use
encoding.theta for the value channel.`

**TypeScript behavior:** `ArcEncoding` no longer has a `y` property. Build
fails if you reference it.

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

## 5. Move `valueFormat` to `encoding.value.format` on sankey/tilemap/barlist

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

## 6. Replace `ChartType` / `CHART_TYPES` imports

**What changed:** The `ChartType` type alias and `CHART_TYPES` constant were
removed from `@opendata-ai/openchart-core`. They were deprecated aliases for
`MarkType` and `MARK_TYPES`.

**No runtime warning.** These are TypeScript-only exports. If you import them,
the build fails immediately.

**Search for:** These exact import names in your TypeScript/JavaScript files:
- `ChartType` imported from `@opendata-ai/openchart-core`
- `CHART_TYPES` imported from `@opendata-ai/openchart-core`

**Fix:** Rename to `MarkType` and `MARK_TYPES`. The values are identical.

```ts
// Before
import { ChartType, CHART_TYPES } from '@opendata-ai/openchart-core';

// After
import { MarkType, MARK_TYPES } from '@opendata-ai/openchart-core';
```

---

## 7. Delete `labels.offsets`

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

## 8. Chart background changed to transparent

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

## 9. Endpoint labels replace the legend on multi-series line/area

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

## 10. Legend swatch redesign

**What changed:** The categorical legend swatch changed from a plain colored
square to a rounded chip with a colored bar through its midline.

**Who's affected:** Visual regression tests or screenshot comparisons that
include legends. The legend content is the same; only the swatch shape changed.

**No spec change required.** Update your visual regression baselines after
verifying the new swatch looks correct.

---

## 11. Text annotation redesign

**What changed:** Text annotations (`{ type: 'text' }`) were redesigned around
the NYT/Datawrapper callout language: left-aligned blocks, one endpoint marker,
two connector voices, inline bold. Six sub-changes, all visual. The spec surface
is unchanged apart from `**bold**` now being meaningful inside `text` and
`subtitle`.

**Who's affected:** Any spec with a text annotation. There are no runtime
warnings for any of this — the specs are valid in both versions, they just
render differently. Visual regression baselines that include annotations will
all diff.

**Search for:** `"type": "text"` inside an `annotations` array.

### 11a. Multi-line text is left-aligned, not centered

Multi-line annotation text used to force `text-anchor: middle`. Now every text
annotation aligns on the edge that faces the data point: left-aligned
(`'start'`) by default, right-aligned (`'end'`) when `anchor: 'left'` puts the
block to the left of the point.

**Fix:** Re-check any annotation whose `text` contains `\n`. A block that was
centered on its anchor point now grows to the right of it, so it can sit further
right than you expect. Adjust `offset` (or set `anchor`) to reposition.

```jsonc
// Before (v7: centered on x = 300, so the block spanned roughly 240..360)
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Supply chain\nunwinds" }

// After (block starts at the anchor point; pull it left to keep the old center)
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Supply chain\nunwinds",
  "offset": { "dx": -60 } }
```

### 11b. Short connectors are suppressed; non-arrowed connectors get a marker

Two linked changes:

- A connector shorter than 14px is dropped. Most plain `{ type: 'text' }`
  annotations with no `offset` sit only 8px off the data point, so their leader
  was a stub. Those stubs are gone.
- Whenever a connector is enabled and carries no arrowhead (straight,
  drop-line), an open-ring marker now renders on the data point by default. It
  used to require `dot: true`. Drop-lines get one too; they silently ignored
  `dot: true` before.

Net effect on a default annotation: the stub leader disappears and a ring
appears. Arrowed connectors are unaffected (no default marker — the arrowhead
already marks the spot).

**Fix:** To get a bare label with no marker, set `dot: false`. To get the leader
back, push the label further out with `offset` so the line clears 14px.

```jsonc
// Bare label, no marker (v7 look, minus the stub)
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Peak", "dot": false }

// Keep a visible leader
{ "type": "text", "x": "2023-Q2", "y": 120, "text": "Peak",
  "offset": { "dx": 0, "dy": -40 } }
```

### 11c. Dot marker defaults changed

`AnnotationDot` defaults: `radius` 5 → 4, `strokeWidth` 2 → 1.5. The default
`stroke` is now the connector's resolved stroke instead of the theme text color,
so the marker and the leader read as one system.

**Fix (if needed):** Pin the old look explicitly.

```jsonc
{ "dot": { "radius": 5, "strokeWidth": 2, "stroke": "#333333" } }
```

### 11d. Typography: 13px, theme font, bold lede

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

### 11e. Connector and arrowhead redesign

Pure rendering changes, no spec change:

- Curve connectors are a single quadratic arc (was a cubic S-curve).
- Arrowheads are a stroked open V (was a filled triangle). In the DOM they're a
  `<polyline>`, not a `<polygon>` — update any selector that reaches into the
  connector SVG.
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

### 11f. `**bold**` spans now parse in `text` and `subtitle`

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

---

## Verification

After applying the changes above, run a build and check the console output.
Every remaining deprecated usage (sections 2-5) logs a `[openchart]` warning
at compile time with the exact fix. Two items have no runtime warning:

- **Stack default (section 1):** silent behavior change. Audit multi-series
  bar/area specs manually.
- **ChartType/CHART_TYPES (section 6):** TypeScript build fails immediately
  if you still import them.
- **Visual-only changes (sections 8-11):** nothing to compile against. Check
  them by looking at the charts. If you keep screenshot baselines, expect the
  annotation redesign (section 11) to diff every chart that carries a text
  annotation.
