---
title: "Encoding"
description: "Encoding channels, field types, aggregates, axis and scale settings, and faceting into small multiples."
section: spec
order: 4
---

# Encoding

`encoding` maps data fields to visual channels: which field goes on x, which on y, which sets color or size. Each channel also carries the field's type and its axis, scale and format settings. The facet channels split one chart into small multiples.

See it: [Encoding channels](https://openchart.steamfield.io/docs/the-spec/encoding/), [Field types and scales](https://openchart.steamfield.io/docs/the-spec/scales/), [Axes](https://openchart.steamfield.io/docs/the-spec/axes/) and [Facets](https://openchart.steamfield.io/docs/composition/facets/).

## Encoding

Maps data fields to visual channels. Source: `core/src/types/spec.ts`.

```ts
interface Encoding {
  x?: EncodingChannel;
  y?: EncodingChannel;
  color?: EncodingChannel;
  size?: EncodingChannel;
  theta?: EncodingChannel; // arc/waffle/parliament quantitative value
  detail?: EncodingChannel;
  description?: DescriptionEncoding;
  facet?: FacetChannel;   // small multiples -- see Faceting
  row?: FacetChannel;     // vertical facet stack -- see Faceting
  column?: FacetChannel;  // horizontal facet row -- see Faceting
}
```

Which channels are required depends on the chart type. See [Encoding by chart type](./marks.md#encoding-by-chart-type).

### EncodingChannel

| Field       | Type          | Default     | Description                                                                                    |
| ----------- | ------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `field`     | `string`      | (required)  | Data field name. Must match a key in the data rows.                                            |
| `type`      | `FieldType`   | (required)  | How to interpret values: `'quantitative'`, `'temporal'`, `'nominal'`, `'ordinal'`.             |
| `interval` | `'day' \| 'week' \| 'month' \| 'quarter' \| 'year' \| number` | inferred | Temporal position interval; see below. |
| `aggregate` | `AggregateOp` | `undefined` | Aggregate applied before encoding: `'count'`, `'sum'`, `'mean'`, `'median'`, `'min'`, `'max'`. |
| `axis`      | `AxisConfig`  | `undefined` | Axis configuration. Only relevant for `x` and `y` channels.                                    |
| `scale`     | `ScaleConfig` | `undefined` | Scale configuration (domain, type, nice, zero).                                                |
| `stack`     | `boolean \| 'zero' \| 'normalize' \| 'center' \| null` | `'zero'` for bar/column/area (Vega-Lite aligned) | Stacking behavior for quantitative channels. `null`/`false` disables stacking (grouped/dodged bars, or overlap gradients for area). `'normalize'` for 100% stacked. `'center'` for streamgraph. |

`interval` is accepted only on temporal position channels (`x`, `y`, `x2` or `y2`) of `bar` marks; rect, errorbar and other channel/mark combinations are rejected. A numeric interval must be finite, positive milliseconds. Temporal bars use the interval to size bands around timestamps on a continuous time scale.

Omission first looks for a calendar cadence (year, quarter, month, week, then day) whose smallest observed gap is one unit and whose other gaps are whole units. This preserves weekly cadence across daylight-saving changes and month-end runs. Otherwise it uses the smallest positive millisecond difference. With fewer than two distinct dates, it falls back to one day and warns. Dates whose spacing is not aligned with the chosen interval produce a warning. Calendar intervals follow the scale's local-time or UTC interpretation; month-based offsets clamp to the target month's last day. Numeric intervals are fixed durations.

### DescriptionEncoding

`encoding.description` is optional (default `undefined`) and does not create a scale, axis or legend:

```ts
type DescriptionEncoding =
  | { field: string; type?: FieldType; format?: string }
  | { value: string };
```

Field `type` and `format` default to omission. String fields are retained verbatim, numeric fields use the field formatter (with optional `format`), and temporal fields/Dates use date formatting. A null or missing field value emits no authored description. `{ value }` supplies constant text. Individual data shapes receive their row text; a line/area path requires the same field value throughout its series. Mixed series values warn and omit that path's description. Add a point layer to expose per-observation text.

Static output writes a direct `<title>` on the data shape; live keyboard marks use the authored description. This channel is distinct from the figure's top-level `description` / `a11y.description` and from generated series metadata; it does not rename the series or replace its computed summary.

### FieldType

| Value          | Meaning              | Scale created   |
| -------------- | -------------------- | --------------- |
| `quantitative` | Continuous numbers   | Linear (or log) |
| `temporal`     | Dates and times      | Time            |
| `nominal`      | Unordered categories | Band/ordinal    |
| `ordinal`      | Ordered categories   | Band/ordinal    |

### AggregateOp

`'count'` | `'sum'` | `'mean'` | `'median'` | `'min'` | `'max'`

Applied to the field values before encoding. Useful when your data has multiple rows per category and you want a single value per mark.

### AxisConfig

| Field       | Type      | Default           | Description                                                                   |
| ----------- | --------- | ----------------- | ----------------------------------------------------------------------------- |
| `label`     | `string`  | field name        | Axis label text displayed along the axis.                                     |
| `format`    | `string`  | auto              | d3-format string for tick labels, e.g. `",.0f"` for comma-separated integers. Also accepts `"ordinal"` for rank ticks (`1st, 2nd, 3rd`). |
| `tickCount` | `number`  | auto              | Override the number of ticks. Engine picks a sensible default if omitted.     |
| `grid`      | `boolean` | `true` for y-axis | Whether to show gridlines for this axis.                                      |

### ScaleConfig

| Field    | Type                                                                      | Default                 | Description                             |
| -------- | ------------------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| `domain` | `[number, number]` or `string[]`                                          | auto from data          | Explicit domain override.               |
| `type`   | `'linear'` \| `'log'` \| `'time'` \| `'band'` \| `'point'` \| `'ordinal'` | inferred from FieldType | Scale type override.                    |
| `nice`   | `boolean`                                                                 | `true`                  | Round domain to clean tick values.      |
| `zero`   | `boolean`                                                                 | `true` (quantitative)   | Whether the domain should include zero. |
| `range`  | `string[]` (color channels)                                               | palette-derived         | Explicit output values, e.g. exact colors. Wins over `scheme`. |
| `scheme` | `string`                                                                  | palette default         | Named color ramp (Vega-Lite aligned): sequential `blue`/`green`/`orange`/`purple`/`teal`, diverging `redBlue`/`brownTeal`; common VL aliases (`blues`, `category10`, ...) accepted. |

`scheme` is only meaningful where the compile path reads it: chart color
channels and quantitative map color (maps accept the sequential names only).
Sankey, tilemap, bar list, graph, and categorical map channels never read it,
and validation rejects it there with the mechanism that family actually uses
(`theme.colors.categorical` for sankey, top-level `palette` for tilemap,
`scale.range` for graph and categorical maps). See the
[v8 migration guide](../migrating-v8.md#16-scalescheme-is-validated-on-every-spec-family).

---

## Faceting

Small multiples: partition data into a grid of panels, one panel per unique value of a categorical field. Each panel compiles as a regular chart with a header showing its facet value. Source: `core/src/types/spec.ts` (`FacetChannel`), `engine/src/compile.ts` (`compileFaceted`).

Three encoding channels drive faceting. They are mutually exclusive: `row` and `column` together fail validation (cross-product faceting is not yet supported), as does combining either with `facet`.

| Channel           | Layout                             | Default scale sharing                       |
| ----------------- | ---------------------------------- | ------------------------------------------- |
| `encoding.facet`  | Wrap grid (`columns` wide)         | x and y both shared                         |
| `encoding.row`    | Vertical stack, one column         | x shared, y independent per panel           |
| `encoding.column` | Single row of side-by-side panels  | y shared, x independent per panel           |

### FacetChannel

Unlike positional channels, a facet channel carries no scale or axis config -- it produces a grid, not a visual encoding.

| Field     | Type                                    | Default       | Description                                                                                        |
| --------- | --------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `field`   | `string`                                | (required)    | Data field to partition by. Each unique value produces one panel. Must exist in the data.          |
| `type`    | `'nominal' \| 'ordinal'`                | (required)    | Must be categorical. Other field types fail validation.                                            |
| `columns` | `number`                                | auto          | Wrap grid width (`facet` channel only; `row` forces 1 column, `column` uses one panel per value). Must be a positive integer. Auto picks `min(ceil(sqrt(n)), what fits at the 200px panel minimum)`. |
| `sort`    | `'ascending' \| 'descending' \| null`   | `'ascending'` | Panel order. `null` keeps data order (first appearance).                                           |

### resolve

The top-level `resolve` field on the chart spec overrides the per-direction scale defaults. Only meaningful on faceted specs.

```ts
interface ResolveConfig {
  scale?: Partial<Record<'x' | 'y' | 'color' | 'size', 'shared' | 'independent'>>;
  axis?: Partial<Record<'x' | 'y', 'shared' | 'independent'>>;
  legend?: Partial<Record<'color' | 'size', 'shared' | 'independent'>>;
}
```

The facet compile path currently honors `resolve.scale.x` and `resolve.scale.y`; the other keys exist on the type (Vega-Lite aligned) but are not yet consumed.

Shared scales compute one domain from the full dataset so panels are directly comparable. Independent scales fit each panel's own domain so each panel fills its frame. When a scale is shared, redundant tick labels are stripped: y-axis labels render only on the leftmost column, and row-faceted panels show x-axis labels only on the bottom panel.

### Layout behavior

- Panels have a 200px minimum width. The grid drops columns responsively until panels fit, down to a single column.
- Panels have a 100px minimum height. If the grid would fall below it, the figure grows taller (once) to fit.
- Chrome, legend, and annotations are figure-level. Annotations resolve into every panel and thin per panel; demoted labels pool into one figure-level footnote list.

### Facet example

```ts
const spec: ChartSpec = {
  mark: "line",
  data: gdpGrowthRows, // rows carry a country field
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "gdp", type: "quantitative" },
    facet: { field: "country", type: "nominal", columns: 3 },
  },
  resolve: { scale: { y: "independent" } },
  chrome: { title: "GDP growth by country" },
};
```

Note: Vega-Lite's top-level `facet` operator (`{ facet, spec }`) is not supported. Faceting is always expressed through the encoding channels above.
