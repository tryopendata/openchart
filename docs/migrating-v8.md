# Migrating to v8

v8 is a spec-correctness release. Its headline feature is faceting (small
multiples), and alongside it a small set of breaking changes bring OpenChart's
defaults and encoding surface into line with Vega-Lite, so a spec that reads
correctly in one reads correctly in the other.

This page is the checklist. Every breaking item below already emits a
deprecation warning in v7, so you can find the specs that need attention before
v8 ships: compile your charts, watch the console, and fix what it names. Once
the warnings are gone, the v8 upgrade is a no-op for your specs.

> The v8 version numbers here are the target. Until v8 is published, treat this
> as the list of deprecations the v7 warnings point at. Nothing described under
> "Breaking in v8" has changed yet; the warnings run during the deprecation
> window so you can migrate ahead of the flip.

## Wrapper package APIs are unchanged

All six packages release together at the same version, so `react`, `vue`,
`svelte`, and `vanilla` also move to v8. Their component and function APIs do
not change. `<Chart>`, `<DataTable>`, `<Graph>`, `createChart()`,
`createTable()`, `createGraph()`, and the theme providers keep the same props
and signatures. Every change below is in the spec you pass to them, not in how
you mount it.

## Headline: faceting

v8 leads with faceting: partition a chart into a grid of small-multiple panels
with a `facet` channel. It shipped additively during the v7 cycle, so it is not
a breaking change; v8 release notes lead with it as the cycle's marquee
capability. See the spec reference for the `facet` channel and `resolve`.

## Breaking in v8

| Change | Before (v7) | After (v8) | Why |
| --- | --- | --- | --- |
| Multi-series bar/area stack default | grouped bars / overlapping areas | stacked | Vega-Lite defaults to stacked; the same spec now renders the same chart |
| Arc value channel | `theta` accepted as an alias for `y` | `theta` is canonical; `y` accepted with a warning | Matches the Vega-Lite pie idiom |
| `radius` encoding | declared, silently ignored | removed | Never implemented; use `mark.innerRadius` / `mark.outerRadius` |
| `shape` encoding | declared, silently ignored | removed | Never implemented; differentiate series with `color` or `strokeDash` |
| `href` encoding | declared, silently ignored | removed | Never implemented; handle links in the host app |
| `order` encoding | declared, silently ignored | removed | Never implemented; use `sort` or pre-sorted data |
| `ChartType` / `CHART_TYPES` exports | deprecated aliases | removed | Use `MarkType` / `MARK_TYPES` |
| Default number formatting | raw `formatNumber` (comma-grouped, 2 decimals) | compact notation on charts (1k, 2.5M); full precision in tables | Readable axis/tooltip labels without manual format strings |
| `K` abbreviation casing | uppercase `K` (1K, 500K) | lowercase `k` (1k, 500k) | SI convention; uppercase K is kelvin |
| Percent formatting | `((v/total)*100).toFixed(1) + '%'` | `formatPercent(fraction)` (trailing-zero-trimmed) | `60.0%` becomes `60%`; `33.3%` stays `33.3%` |

Two more deprecations are kept accepted through v8 so you have a full window,
then removed in a later major:

| Change | Before | Replacement | Status |
| --- | --- | --- | --- |
| `'rule'` annotation type | `{ type: 'rule', ... }` | `{ type: 'refline', ... }` (identical behavior; `'rule'` collides with the `rule` mark) | Warns now |
| `valueFormat` on sankey / tilemap / barlist | top-level `valueFormat` | `encoding.value.format` (the field every chart encoding already uses) | Deprecated in v8, when the engine starts reading `encoding.value.format` for these types; `valueFormat` keeps working as an alias |

### Stack default (the one to check first)

This is the change most likely to alter a chart you already ship, because it is
silent: a v7 multi-series bar renders grouped, the same spec on v8 renders
stacked, with no error. The v7 warning fires whenever a bar or area chart with a
color field relies on the implicit default:

```
[openchart] The implicit default for multi-series bar/area charts
(grouped/overlap) changes to stacked in v8. Set stack explicitly on the value
channel: null keeps grouped/overlap, 'zero' opts into stacking.
```

Set `stack` explicitly and the warning goes away and v8 is a no-op:

```jsonc
// Keep grouped bars / overlapping areas (the v7 look):
"encoding": {
  "x": { "field": "quarter", "type": "nominal" },
  "y": { "field": "revenue", "type": "quantitative", "stack": null },
  "color": { "field": "product", "type": "nominal" }
}

// Opt into stacking (the v8 default):
"encoding": {
  "y": { "field": "revenue", "type": "quantitative", "stack": "zero" }
}
```

### Arc value channel

```jsonc
// v7: y is the slice value, theta is an accepted alias
"mark": "arc",
"encoding": {
  "y": { "field": "count", "type": "quantitative" },
  "color": { "field": "category", "type": "nominal" }
}

// v8: theta is canonical (y still accepted, with a warning)
"mark": "arc",
"encoding": {
  "theta": { "field": "count", "type": "quantitative" },
  "color": { "field": "category", "type": "nominal" }
}
```

### Removed encoding channels

`radius`, `shape`, `href`, and `order` were declared in the encoding types but
had no engine implementation, so they were silently dropped. Each warns in v7
and is removed in v8. Drop them from your specs; the replacements:

- `radius`: use `mark.innerRadius` / `mark.outerRadius` for donut radii.
- `shape`: differentiate series with `color`, or `strokeDash` on line marks.
- `href`: handle link navigation in the host application.
- `order`: use `sort` on the relevant channel, or pass pre-sorted data.

### `'rule'` annotation type

```jsonc
// Before: 'rule' collides with the rule mark type
"annotations": [{ "type": "rule", "y": 0, "label": "baseline" }]

// After: 'refline' (same behavior)
"annotations": [{ "type": "refline", "y": 0, "label": "baseline" }]
```

### `valueFormat` on sankey / tilemap / barlist

Sankey, tilemap, and barlist carry a top-level `valueFormat`, while their value
encoding already accepts `format` like every chart encoding. v8 reads the
format from `encoding.value.format` and keeps `valueFormat` as an alias, so
`valueFormat` keeps working. Prefer the encoding form going forward:

```jsonc
// Still valid: top-level valueFormat
{ "type": "barlist", "valueFormat": "$,.0f", "encoding": { "value": { "field": "amount" } } }

// Preferred in v8: format on the value encoding
{ "type": "barlist", "encoding": { "value": { "field": "amount", "format": "$,.0f" } } }
```

Do not migrate this on v7: the engine does not read `encoding.value.format` for
these chart types until v8, so the encoding form is a no-op until then.

### Default number formatting

v8 applies compact notation automatically on chart surfaces: axis ticks,
tooltips, value labels, and endpoint labels show `1k`, `2.5M`, `1.2B` instead
of `1,000`, `2,500,000`, `1,200,000,000`. Tables keep full precision.

**What changes without any spec edits:**

- Axis tick `1,000,000` becomes `1M`; `50,000` becomes `50k`
- Years (integers in 1500-2500) render bare: `2024` not `2,024`
- Percent labels drop trailing zeros: `60%` not `60.0%`
- Abbreviation casing: `k` not `K` (SI convention)

**To keep v7 formatting on a specific axis:**

```jsonc
"encoding": {
  "y": {
    "field": "revenue",
    "type": "quantitative",
    "axis": { "format": ",.0f" }
  }
}
```

Any explicit `format` string (on `axis`, channel, or `valueFormat`) takes
precedence over the new defaults. Specs that already set format strings are
unaffected.

**New semantic keywords:** `'percent'` and `'currency'` can be used as format
strings anywhere a d3-format string is accepted. `'percent'` multiplies by 100
and appends `%`; `'currency'` prepends `$` with comma grouping.

## Codemod recipes

OpenChart specs are plain JSON, so most migrations are a `jq` one-liner over your
stored spec files. Run against a copy first and review the diff.

Set an explicit stack on multi-series bars/areas (keeps the v7 grouped look;
switch `null` to `"zero"` to stack):

```bash
jq '(.encoding.y // empty) |= (. + { stack: null })' spec.json
```

Rename `y` to `theta` on arc marks:

```bash
jq 'if .mark == "arc" then .encoding.theta = .encoding.y | del(.encoding.y) else . end' spec.json
```

Drop a removed encoding channel:

```bash
jq 'del(.encoding.radius, .encoding.shape, .encoding.href, .encoding.order)' spec.json
```

Rename the `'rule'` annotation type to `'refline'`:

```bash
jq '(.annotations // []) |= map(if .type == "rule" then .type = "refline" else . end)' spec.json
```

Move `valueFormat` onto the value encoding (run on v8 or later, not v7):

```bash
jq 'if has("valueFormat") then .encoding.value.format = .valueFormat | del(.valueFormat) else . end' spec.json
```

## New in the v7 cycle

If you are upgrading across the whole v7 line, these landed additively and need
no migration. They are worth knowing about:

- Continuous and binned color legends for quantitative color scales.
- New mark types: beeswarm, dumbbell/range, waffle, calendar heatmap,
  parliament (16 mark types total).
- `seriesSearch` for search-and-highlight, and `youDrawIt` for guess-the-line
  interactions.
- The scrollytelling story API, from the vanilla subpath
  `@opendata-ai/openchart-vanilla/story`.
- Arc `startAngle` / `endAngle`, `fillPattern` for accessible fills, and an
  `a11y` config block.
- A published JSON schema (core `./schema` subpath) and `llms.txt` for
  LLM-driven spec generation.
