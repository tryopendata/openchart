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

## Verification

After applying the changes above, run a build and check the console output.
Every remaining deprecated usage (sections 2-5) logs a `[openchart]` warning
at compile time with the exact fix. Two items have no runtime warning:

- **Stack default (section 1):** silent behavior change. Audit multi-series
  bar/area specs manually.
- **ChartType/CHART_TYPES (section 6):** TypeScript build fails immediately
  if you still import them.
