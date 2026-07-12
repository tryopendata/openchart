# Migrating to OpenChart v8

v8 is a spec-correctness release. It brings OpenChart's defaults and encoding
surface into line with Vega-Lite, so a spec that reads correctly in one reads
correctly in the other. Seven spec-grammar breaking changes plus three
visual behavior changes — all in the spec and rendering defaults, nothing
in how you mount or render a chart.

Most of these are backward-compatible on purpose: your old spec still
compiles and still renders, and for most of them the console tells you
exactly what to change. Two exceptions have no runtime warning to lean on —
the stack default (because it's a silent behavior change, not a deprecated
API) and the removed `ChartType`/`CHART_TYPES` exports (because a
TypeScript build fails immediately if you still import them). The stack
default is also the one most likely to change how an existing chart looks,
so check it first.

## Wrapper packages unchanged

`react`, `vue`, `svelte`, and `vanilla` all move to v8 together (all six
packages release at the same version), but their APIs do not change.
`<Chart>`, `<DataTable>`, `<Graph>`, `createChart()`, `createTable()`,
`createGraph()`, and the theme providers keep the same props and signatures.
Every change below is in the spec you pass to them, not in how you call them.

## Quick checklist

- [ ] Multi-series bar/area charts: decide if you want the new stacked
      default, or add `stack: null` to keep grouped/overlap.
- [ ] Arc (pie/donut) specs: rename `encoding.y` to `encoding.theta`.
- [ ] Remove any `shape`, `radius`, `href`, `order` encoding channels.
- [ ] Rename `{ type: 'rule' }` annotations to `{ type: 'refline' }`.
- [ ] Move `valueFormat` on sankey/tilemap/barlist specs to
      `encoding.value.format`.
- [ ] Replace `ChartType`/`CHART_TYPES` imports with `MarkType`/`MARK_TYPES`.
- [ ] Drop `labels.offsets` and let the collision system position labels.
- [ ] Compile with `{ dev: true }` (or just watch the console) and fix every
      `[openchart]` warning it prints — that's the full list, spec by spec.
- [ ] If your container background isn't white, set
      `theme.colors.background` explicitly (default changed to transparent).
- [ ] Multi-series line/area: endpoint labels now replace the legend. Add
      `legend: { show: true }` if you need the legend back.
- [ ] Update visual regression baselines (legend swatch shape changed).

---

## 1. Multi-series bar/area charts default to stacked

Before v8, a bar or area chart with a `color` encoding and no explicit `stack`
rendered grouped (bars) or overlapping (areas). v8 aligns with Vega-Lite:
the default is now `stack: 'zero'` for both bar/column and area.

This is the change most likely to alter a chart you already ship, because
it's silent — the same spec renders differently with no error and no
deprecation warning. Any spec that already sets `stack` explicitly (either
value) is unaffected.

**Before (v7): implicit default was grouped/overlap**

```jsonc
"mark": "bar",
"encoding": {
  "x": { "field": "quarter", "type": "nominal" },
  "y": { "field": "revenue", "type": "quantitative" },
  "color": { "field": "product", "type": "nominal" }
}
// v7: renders grouped bars, one cluster per quarter
```

**After (v8): implicit default is stacked**

```jsonc
"mark": "bar",
"encoding": {
  "x": { "field": "quarter", "type": "nominal" },
  "y": { "field": "revenue", "type": "quantitative" },
  "color": { "field": "product", "type": "nominal" }
}
// v8: renders stacked bars, same spec, different chart
```

**To keep the old (grouped/overlap) behavior**, set `stack: null` explicitly
on the value channel:

```jsonc
"encoding": {
  "x": { "field": "quarter", "type": "nominal" },
  "y": { "field": "revenue", "type": "quantitative", "stack": null },
  "color": { "field": "product", "type": "nominal" }
}
```

This applies to both bar/column and area charts. Area's gradient fill also
changes with it: stacked areas use a higher-opacity per-layer gradient (each
layer sits on solid ground), while `stack: null` areas keep the translucent
per-series overlap gradient designed for comparison over a shared baseline.

**Migration action:** grep your stored specs for multi-series bar/area charts
(`mark: 'bar'` or `'area'` plus a `color` encoding) that don't set `stack`.
Decide per-chart whether stacked or grouped/overlap is the right read, and set
`stack` explicitly either way — this also makes the spec self-documenting.

```bash
# Keep the v7 grouped/overlap look on every multi-series bar/area spec that
# doesn't already set stack:
jq '(.encoding.y // .encoding.x) |= (if has("stack") then . else . + { stack: null } end)' spec.json
```

## 2. `theta` is the canonical arc value channel

`ArcEncoding` (pie/donut marks) now requires `theta` for the slice value,
matching Vega-Lite's pie idiom. `y` still works at runtime — validation
accepts `y` as satisfying the `theta` requirement, and the engine populates
`theta` from `y` internally — but it emits a deprecation warning, and the
TypeScript type no longer includes it.

**Before (v7 idiom, TypeScript now rejects this)**

```jsonc
"mark": "arc",
"encoding": {
  "y": { "field": "count", "type": "quantitative" },
  "color": { "field": "category", "type": "nominal" }
}
```

```
[openchart] encoding.y on arc marks is deprecated in v8; use encoding.theta for the value channel.
```

**After (v8, canonical)**

```jsonc
"mark": "arc",
"encoding": {
  "theta": { "field": "count", "type": "quantitative" },
  "color": { "field": "category", "type": "nominal" }
}
```

This also applies to `waffle` and `parliament` marks, which share the same
part-to-whole value channel.

**Migration action:** rename `encoding.y` to `encoding.theta` on every arc,
waffle, and parliament spec.

```bash
jq 'if (.mark == "arc" or .mark == "waffle" or .mark == "parliament") and .encoding.y and (.encoding.theta | not)
    then .encoding.theta = .encoding.y | del(.encoding.y)
    else . end' spec.json
```

## 3. Dead encoding channels removed

`shape`, `radius`, `href`, and `order` are gone from the `Encoding` interface
and from every mark's `MARK_ENCODING_RULES`. None of these were ever
implemented — they were declared in the types, accepted by validation, and
silently dropped by every chart's compute path. If your specs set them, they
were doing nothing.

At runtime the engine still strips them (rather than erroring) and warns once
per compile:

```
[openchart] encoding.radius was removed in v8. This channel is stripped for backward compatibility. Use mark.innerRadius / mark.outerRadius to control donut radii.
[openchart] encoding.shape was removed in v8. This channel is stripped for backward compatibility. Differentiate series with encoding.color or encoding.strokeDash instead.
[openchart] encoding.href was removed in v8. This channel is stripped for backward compatibility. Handle link navigation in the host application instead.
[openchart] encoding.order was removed in v8. This channel is stripped for backward compatibility. Use encoding.<channel>.sort or pre-sorted data order instead.
```

But TypeScript no longer has these properties on `Encoding`, so authoring
against the v8 types will fail to compile if you reference them.

**Before**

```jsonc
"encoding": {
  "x": { "field": "date", "type": "temporal" },
  "y": { "field": "value", "type": "quantitative" },
  "shape": { "field": "region", "type": "nominal" },
  "order": { "field": "sortKey", "type": "quantitative" }
}
```

**After**

```jsonc
"encoding": {
  "x": { "field": "date", "type": "temporal" },
  "y": { "field": "value", "type": "quantitative" },
  "color": { "field": "region", "type": "nominal" }
}
```

**Migration action:** remove `shape`, `radius`, `href`, and `order` from every
spec. Replacements:

- `radius` -> `mark.innerRadius` / `mark.outerRadius` (donut ring thickness).
- `shape` -> `color` or `strokeDash` to differentiate series.
- `href` -> handle link navigation in the host app, outside the spec.
- `order` -> `sort` on the relevant channel, or pre-sort your data.

```bash
jq 'del(.encoding.radius, .encoding.shape, .encoding.href, .encoding.order)' spec.json
```

## 4. `RefLineAnnotation.type` narrowed to `'refline'`

`{ type: 'rule' }` collided with the `rule` *mark* type, which was confusing
in layered specs. The annotation type is now just `'refline'`. `'rule'` is
still accepted at runtime — a spec-sugar pass rewrites it to `'refline'`
before validation ever sees it, with a deprecation warning — but the
TypeScript type only has `'refline'`.

**Before**

```jsonc
"annotations": [{ "type": "rule", "y": 0, "label": "baseline" }]
```

```
[openchart] annotation type 'rule' is deprecated; use 'refline'.
```

**After**

```jsonc
"annotations": [{ "type": "refline", "y": 0, "label": "baseline" }]
```

Behavior is identical — only the discriminant name changed.

**Migration action:** rename `type: 'rule'` to `type: 'refline'` on every
annotation.

```bash
jq '(.annotations // []) |= map(if .type == "rule" then .type = "refline" else . end)' spec.json
```

## 5. `valueFormat` deprecated on sankey, tilemap, and barlist

These three spec types carry a top-level `valueFormat` string. Their value
encoding already accepts `format`, like every other chart encoding, so v8
reads `encoding.value.format` as the canonical source and treats top-level
`valueFormat` as a deprecated alias. Both still work — `encoding.value.format`
wins if both are set — but `valueFormat` emits a warning.

**Before**

```jsonc
{
  "type": "barlist",
  "valueFormat": "$,.0f",
  "encoding": { "value": { "field": "amount" } }
}
```

```
[openchart] valueFormat is deprecated; set format on the encoding value channel instead (e.g. encoding.value.format).
```

**After**

```jsonc
{
  "type": "barlist",
  "encoding": { "value": { "field": "amount", "format": "$,.0f" } }
}
```

Same for `sankey` and `tilemap`.

**Migration action:** move `valueFormat` onto `encoding.value.format` for
every sankey, tilemap, and barlist spec.

```bash
jq 'if has("valueFormat") then .encoding.value.format = .valueFormat | del(.valueFormat) else . end' spec.json
```

## 6. `ChartType` and `CHART_TYPES` removed

These were deprecated aliases for `MarkType` and `MARK_TYPES`. They're gone
in v8 — not warned, not shimmed, just removed. If you import them, switch to
the current names:

```ts
// Before
import { ChartType, CHART_TYPES } from '@opendata-ai/openchart-core';

// After
import { MarkType, MARK_TYPES } from '@opendata-ai/openchart-core';
```

**Migration action:** grep your codebase for `ChartType` and `CHART_TYPES`
and rename to `MarkType` / `MARK_TYPES`. This is a straight rename — the
underlying values didn't change.

## 7. `labels.offsets` deprecated

`LabelConfig.offsets` let you nudge individual series' value labels by pixel
offset, keyed by series name — a workaround for label collisions the layout
engine didn't resolve on its own. The collision system now handles label
positioning automatically, so the manual escape hatch is deprecated. Unlike
the other six changes, this one doesn't emit a runtime console warning; it's
marked `@deprecated` in the type only, and will be removed in a future major.

**Before**

```jsonc
"labels": {
  "density": "all",
  "offsets": { "Product A": { "dy": -4 }, "Product B": { "dy": 6 } }
}
```

**After**

```jsonc
"labels": {
  "density": "all"
}
```

**Migration action:** delete `labels.offsets` from your specs and let the
collision system place labels. If you find a case where the automatic
placement is worse than your manual offsets were, that's worth reporting —
it means the collision system has a gap.

---

## Visual breaking changes (no spec edits needed)

These don't require spec changes, but they change how existing charts render.
If you pin visual regression baselines or screenshot-test your charts, update
them after upgrading.

### 8. Chart background defaults to `transparent`

Previously the SVG painted an opaque white `<rect>` behind the chart. v8
defaults `theme.colors.background` to `'transparent'` so charts inherit the
host container's surface color. If your container has a dark or colored
background and you relied on the chart painting its own white, set the
background explicitly:

```ts
{ theme: { colors: { background: '#ffffff' } } }
```

### 9. Endpoint labels replace the legend on multi-series line/area

Charts with 2+ line or area series now render a right-side endpoint-label
column (series name + value at the right edge) instead of a traditional
bottom legend. The legend is auto-suppressed to avoid redundancy. To keep
the legend, set `legend: { show: true }` on the spec.

### 10. Legend swatch redesign

The categorical legend swatch changed from a plain square to a rounded chip
with a colored bar through its midline. This is a visual-only change and
matches the endpoint-label column's swatch style.

---

## New in the v7 cycle (not breaking, worth knowing)

These landed additively before v8 and need no migration:

- Continuous and binned color legends for quantitative color scales.
- New mark types: beeswarm, dumbbell/range, waffle, calendar heatmap,
  parliament.
- `seriesSearch` for search-and-highlight, and `youDrawIt` for
  guess-the-line interactions.
- The scrollytelling story API, from the vanilla subpath
  `@opendata-ai/openchart-vanilla/story`.
- Arc `startAngle` / `endAngle`, `fillPattern` for accessible fills, and an
  `a11y` config block.
- A published JSON schema (core `./schema` subpath) and `llms.txt` for
  LLM-driven spec generation.

## Finding what needs to change

Every breaking item above except the stack default and `ChartType`/
`CHART_TYPES` emits a `[openchart]` console warning naming the exact fix.
Compile your specs, watch the console, and fix what it names — that covers
items 2 through 5. For the stack default (item 1) and the removed exports
(item 6), there's no runtime warning to lean on:

- Stack default: audit multi-series bar/area specs by hand (or with the `jq`
  recipe above) since the behavior change is silent.
- `ChartType`/`CHART_TYPES`: a TypeScript build will fail immediately if you
  still import them, since they no longer exist.
