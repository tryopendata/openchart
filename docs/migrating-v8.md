# Migrating to v8

v8 is a spec-correctness release. Its headline feature is faceting (small
multiples), and alongside it a set of breaking changes bring OpenChart's
defaults and encoding surface into line with Vega-Lite, so a spec that reads
correctly in one reads correctly in the other.

This page is the checklist. The v7 line emitted deprecation warnings for every
breaking change below, so if you fixed the warnings before upgrading, v8 is a
no-op.

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
a breaking change. See the spec reference for the `facet` channel and `resolve`.

## Breaking changes

| Change | Before (v7) | After (v8) | Why |
| --- | --- | --- | --- |
| Multi-series bar/area stack default | grouped bars / overlapping areas | stacked | Vega-Lite defaults to stacked; the same spec now renders the same chart |
| Arc value channel | `y` is the slice value, `theta` is an alias | `theta` is canonical; `y` accepted with a deprecation warning | Matches the Vega-Lite pie idiom |
| `radius` encoding | declared, silently ignored | removed from types; warns if present in spec | Never implemented; use `mark.innerRadius` / `mark.outerRadius` |
| `shape` encoding | declared, silently ignored | removed from types; warns if present in spec | Never implemented; differentiate series with `color` or `strokeDash` |
| `href` encoding | declared, silently ignored | removed from types; warns if present in spec | Never implemented; handle links in the host app |
| `order` encoding | declared, silently ignored | removed from types; warns if present in spec | Never implemented; use `sort` or pre-sorted data |
| `ChartType` / `CHART_TYPES` exports | deprecated aliases | removed | Use `MarkType` / `MARK_TYPES` |

Two more deprecations are kept accepted through v8 so you have a full window,
then removed in a later major:

| Change | Before | Replacement | Status |
| --- | --- | --- | --- |
| `'rule'` annotation type | `{ type: 'rule', ... }` | `{ type: 'refline', ... }` (identical behavior; `'rule'` collides with the `rule` mark) | Warns; accepted |
| `valueFormat` on sankey / tilemap / barlist | top-level `valueFormat` | `encoding.value.format` | Deprecated alias; still works |

### Stack default (the one to check first)

This is the change most likely to alter a chart you already ship. A v7
multi-series bar renders grouped; the same spec on v8 renders stacked. The
engine emits a warning when no explicit `stack` value is set.

**Search:** find bar/area specs with a `color` encoding but no explicit `stack`:

```bash
grep -rn '"color"' specs/ | xargs grep -L '"stack"'
```

**Fix:** set `stack` explicitly on the value channel:

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

### Arc value channel (theta is canonical)

**Search:** find arc/waffle/parliament specs using `y` instead of `theta`:

```bash
grep -rn '"arc"\|"waffle"\|"parliament"' specs/ | xargs grep '"y"'
```

**Fix:** rename `encoding.y` to `encoding.theta`:

```jsonc
// Before (v7):
{ "mark": "arc", "encoding": { "y": { "field": "count", "type": "quantitative" }, ... } }

// After (v8):
{ "mark": "arc", "encoding": { "theta": { "field": "count", "type": "quantitative" }, ... } }
```

Using `y` still works in v8 (it is rewritten to `theta` internally), but
produces a deprecation warning. Migrate to `theta` to silence it.

### Removed encoding channels

`radius`, `shape`, `href`, and `order` were declared in the encoding types but
had no engine implementation. They are removed from TypeScript types in v8.
The engine still accepts them gracefully (strips and warns) so existing stored
JSON specs don't break at runtime.

**Search:**

```bash
grep -rn '"radius"\|"shape"\|"href"\|"order"' specs/
```

**Fix:** drop the channel from the encoding. Replacements:

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

// Preferred: format on the value encoding
{ "type": "barlist", "encoding": { "value": { "field": "amount", "format": "$,.0f" } } }
```

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
jq 'if .mark == "arc" or .mark == "waffle" or .mark == "parliament" then .encoding.theta = .encoding.y | del(.encoding.y) else . end' spec.json
```

Drop a removed encoding channel:

```bash
jq 'del(.encoding.radius, .encoding.shape, .encoding.href, .encoding.order)' spec.json
```

Rename the `'rule'` annotation type to `'refline'`:

```bash
jq '(.annotations // []) |= map(if .type == "rule" then .type = "refline" else . end)' spec.json
```

Move `valueFormat` onto the value encoding:

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
