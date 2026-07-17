# Chart types

Quick-reference gallery for every chart type OpenChart supports. Each section has a minimal working spec you can copy-paste and a link to the live example. For the full field-by-field reference, see [spec-reference.md](spec-reference.md).

All specs work with any framework. Swap the import to match yours:

```tsx
// React
import { Chart } from "@opendata-ai/openchart-react";
<Chart spec={spec} />

// Vue
import { Chart } from "@opendata-ai/openchart-vue";
<Chart :spec="spec" />

// Svelte
import { Chart } from "@opendata-ai/openchart-svelte";
<Chart {spec} />

// Vanilla JS
import { createChart } from "@opendata-ai/openchart-vanilla";
createChart(container, spec);
```

---

## Line

Trends over time. Best for continuous temporal data where the shape of change matters.

```ts
const spec = {
  mark: "line",
  data: [
    { date: "2023-01-01", value: 12 },
    { date: "2023-04-01", value: 28 },
    { date: "2023-07-01", value: 35 },
    { date: "2023-10-01", value: 42 },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "value", type: "quantitative" },
  },
};
```

Add a `color` encoding to split into multi-series lines. Use `mark: { type: "line", interpolate: "monotone" }` for smooth curves, or `"step"` for stepped lines.

**Live examples**: [Single line](https://tryopendata.github.io/openchart/?story=charts--line-and-area#single-line) | [Multi-series](https://tryopendata.github.io/openchart/?story=charts--line-and-area#multi-series-labels) | [Five series](https://tryopendata.github.io/openchart/?story=charts--line-and-area#five-series-legend) | [Interpolation modes](https://tryopendata.github.io/openchart/?story=charts--line-and-area#interpolation)

---

## Area

Volume over time, cumulative totals, or part-to-whole composition over time. Same encoding as line, but the region below the line is filled.

```ts
const spec = {
  mark: "area",
  data: [
    { date: "2023-01-01", value: 120 },
    { date: "2023-04-01", value: 280 },
    { date: "2023-07-01", value: 350 },
    { date: "2023-10-01", value: 420 },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "value", type: "quantitative" },
  },
};
```

Add a `color` encoding to split into series. Multi-series area charts default to **stacked** composition (`stack: 'zero'`), Vega-Lite aligned. Pass `encoding.y.stack: null` (or `false`) to opt into overlap mode instead — translucent gradient fills layered on a shared baseline, so each series's curve stays readable, comparison-first rather than composition-first.

**Live examples**: [Area chart](https://tryopendata.github.io/openchart/?story=charts--line-and-area#area) | [Multi-series overlap](https://tryopendata.github.io/openchart/?story=charts--line-and-area#area) | [Stacked area](https://tryopendata.github.io/openchart/?story=charts--line-and-area#stacked-area) | [Step area](https://tryopendata.github.io/openchart/?story=charts--line-and-area#interpolation)

---

## Bar (horizontal)

Comparing categories or ranking items. Horizontal orientation makes long category labels easy to read.

```ts
const spec = {
  mark: "bar",
  data: [
    { cause: "Heart disease", deaths: 9.0 },
    { cause: "Stroke", deaths: 6.8 },
    { cause: "COPD", deaths: 3.4 },
    { cause: "Lung cancers", deaths: 1.9 },
    { cause: "Diabetes", deaths: 1.6 },
  ],
  encoding: {
    x: { field: "deaths", type: "quantitative" },
    y: { field: "cause", type: "nominal" },
  },
};
```

The engine renders horizontal bars when x is quantitative and y is nominal. Add a `color` encoding for grouped bars.

**Live examples**: [Simple bars](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#simple-bars) | [Grouped bars](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#grouped-columns) | [Negative values](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#negative-values)

---

## Column (vertical bars)

Time-period comparisons or sequential categories. Vertical orientation works well with shorter category labels and temporal x-axes.

```ts
const spec = {
  mark: "bar",
  data: [
    { month: "Jan", jobs: 353 },
    { month: "Feb", jobs: 275 },
    { month: "Mar", jobs: 303 },
    { month: "Apr", jobs: 175 },
    { month: "May", jobs: 272 },
    { month: "Jun", jobs: 206 },
  ],
  encoding: {
    x: { field: "month", type: "nominal" },
    y: { field: "jobs", type: "quantitative" },
  },
};
```

The mark is still `"bar"`, but the engine flips to vertical columns when x is nominal/ordinal and y is quantitative.

**Live examples**: [Simple columns](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#columns) | [Grouped columns](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#grouped-columns) | [Negative values](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#diverging-columns)

---

## Stacking

When a bar or column chart has a `color` encoding, values are **stacked by default** (one segment per series, stacked from zero). Control this with the `stack` property on the quantitative encoding channel.

> **Area charts follow the same default.** Multi-series area also stacks by default (`stack: 'zero'`). Set `stack: null` to opt into overlap mode instead — translucent gradients per series on a shared zero baseline, comparison-first rather than composition-first. The `stack` property and its values otherwise behave the same way for area charts.

### Grouped (side-by-side) bars

Set `stack: null` on the quantitative channel to disable stacking and place bars side-by-side:

```ts
const spec = {
  mark: "bar",
  data: energyData,
  encoding: {
    x: { field: "year", type: "nominal" },
    y: {
      field: "capacity",
      type: "quantitative",
      stack: null, // grouped, not stacked
    },
    color: { field: "source", type: "nominal" },
  },
};
```

### Normalized (100%) stacked

Use `stack: 'normalize'` to scale each category to 100%:

```ts
encoding: {
  y: {
    field: "count",
    type: "quantitative",
    stack: "normalize",
  },
}
```

### All stack values

| Value                       | Behavior                              |
| --------------------------- | ------------------------------------- |
| `undefined` / `true` / `'zero'` | Stack from zero baseline (default) |
| `null` / `false`            | No stacking (grouped/dodged)          |
| `'normalize'`               | Normalize to fraction of total (0-1)  |
| `'center'`                  | Center around zero (streamgraph)      |

---

## Pie

Part-to-whole composition. Best with 5 or fewer categories. If you need more, consider a bar chart or donut.

```ts
const spec = {
  mark: "arc",
  data: [
    { os: "Android", share: 71 },
    { os: "iOS", share: 28 },
    { os: "Other", share: 1 },
  ],
  encoding: {
    y: { field: "share", type: "quantitative" },
    color: { field: "os", type: "nominal" },
  },
};
```

The `y` channel maps to slice values, `color` maps to slice categories. No `x` encoding is needed.

**Live examples**: [Basic pie](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#pie-inline-labels) | [Small slice grouping](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#small-slice-grouping) | [Seven categories](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#many-categories)

---

## Donut

Same as pie with an inner radius, giving a cleaner look and space for a central stat.

```ts
const spec = {
  mark: { type: "arc", innerRadius: 40 },
  data: [
    { category: "Healthcare", spending: 24 },
    { category: "Social Security", spending: 21 },
    { category: "Defense", spending: 13 },
    { category: "Net Interest", spending: 13 },
    { category: "All Other", spending: 29 },
  ],
  encoding: {
    y: { field: "spending", type: "quantitative" },
    color: { field: "category", type: "nominal" },
  },
};
```

**Live examples**: [Donut chart](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#donut-center-metric) | [Donut with leaders](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#leader-line-labels) | [Side-by-side comparison](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#comparison-donuts)

---

## Dot plot

Comparing values across categories with emphasis on individual data points rather than bar length. Cleaner than bars when values are close together.

```ts
const spec = {
  mark: "circle",
  data: [
    { city: "New York", minutes: 40.6 },
    { city: "Chicago", minutes: 33.5 },
    { city: "San Francisco", minutes: 32.2 },
    { city: "Seattle", minutes: 28.8 },
    { city: "Denver", minutes: 26.1 },
  ],
  encoding: {
    x: { field: "minutes", type: "quantitative" },
    y: { field: "city", type: "nominal" },
  },
};
```

Add a `color` encoding to group dots by category. Use diverging data (positive and negative values) for lollipop-style charts.

**Live examples**: [Simple dot plot](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dot-plot) | [Colored dots](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dot-plot) | [Diverging lollipop](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#lollipop) | [Dumbbell chart](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dumbbell)

---

## Lollipop

Dots connected to a zero baseline by thin stems. Cleaner than bars for datasets where values are far from zero. Uses `mark: "lollipop"`, a semantic alias for the dot renderer.

```ts
const spec = {
  mark: "lollipop",
  data: [
    { dept: "Engineering", headcount: 142 },
    { dept: "Sales", headcount: 89 },
    { dept: "Marketing", headcount: 67 },
    { dept: "Support", headcount: 53 },
  ],
  encoding: {
    x: { field: "headcount", type: "quantitative" },
    y: { field: "dept", type: "nominal" },
  },
};
```

**Accepted encodings:**
- `x` (quantitative, required) -- the value axis
- `y` (nominal/ordinal, required) -- the category axis
- `color` (optional) -- categorical for dumbbell mode, quantitative for sequential gradient on dots

Adding a categorical `color` encoding with 2+ series automatically switches to **dumbbell mode**: a connecting bar spans from the minimum to maximum value for each category, with colored dots at each series value.

**Live examples**: [Diverging lollipop](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#lollipop) | [Dumbbell chart](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dumbbell)

---

## Scatter

Correlation between two quantitative variables. Good for finding outliers and clusters.

```ts
const spec = {
  mark: "point",
  data: [
    { country: "Singapore", spending: 14.5, math: 575 },
    { country: "Japan", spending: 10.1, math: 536 },
    { country: "United States", spending: 14.3, math: 465 },
    { country: "Mexico", spending: 3.3, math: 395 },
  ],
  encoding: {
    x: { field: "spending", type: "quantitative" },
    y: { field: "math", type: "quantitative" },
  },
};
```

Add `size` encoding with a quantitative field for bubble charts. Add `color` encoding for grouped scatter.

**Live examples**: [Basic scatter](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#basic-scatter) | [Bubble chart](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#bubble) | [Color grouping](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#color-grouping)

---

## Sankey

Flow between stages, showing how quantities split and merge across columns. Good for budget allocation, energy flows, user journeys.

Sankey uses a separate component and spec type (`SankeySpec`) from standard charts.

```tsx
// React
import { Sankey } from "@opendata-ai/openchart-react";

const spec = {
  type: "sankey",
  data: [
    { source: "Coal", target: "Electricity", value: 46 },
    { source: "Natural Gas", target: "Electricity", value: 38 },
    { source: "Natural Gas", target: "Heating", value: 26 },
    { source: "Electricity", target: "Residential", value: 39 },
    { source: "Electricity", target: "Commercial", value: 36 },
    { source: "Heating", target: "Residential", value: 15 },
  ],
  encoding: {
    source: { field: "source", type: "nominal" },
    target: { field: "target", type: "nominal" },
    value: { field: "value", type: "quantitative" },
  },
  chrome: { title: "Energy flow" },
};

<Sankey spec={spec} />
```

Options: `nodeWidth`, `nodePadding`, `nodeAlign` (`'justify'` | `'left'` | `'right'` | `'center'`), `linkStyle` (`'gradient'` | `'source'` | `'target'` | `'neutral'`), `encoding.value.format` for number formatting (top-level `valueFormat` is deprecated in v8).

For the full field reference, see [SankeySpec in spec-reference.md](spec-reference.md#sankeyspec).

**Live examples**: [Energy flow](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#energy-flow) | [Budget allocation](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#budget-allocation) | [User journey](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#user-journey)

---

## Map (choropleth)

Geographic data on real geometries: US states, counties, world countries, or any TopoJSON source. Data rows join to features by id, and a color encoding fills each feature. An optional points layer overlays lat/lon symbols on top.

Maps use a separate component and spec type (`MapSpec`) from standard charts.

```tsx
// React
import { GeoMap } from "@opendata-ai/openchart-react";
import us from "us-atlas/states-albers-10m.json";

const spec = {
  type: "map",
  geo: { features: us, projection: "identity" },
  data: [
    { id: "06", rate: 5.3 },
    { id: "48", rate: 4.3 },
    // ...one row per state, keyed by FIPS id
  ],
  encoding: {
    key: { field: "id", type: "nominal" },
    color: { field: "rate", type: "quantitative" },
  },
  chrome: { title: "Unemployment by state" },
};

<GeoMap spec={spec} />
```

`geo.features` takes a TopoJSON topology (from `us-atlas`, `world-atlas`, or your own source). `encoding.key` names the data field that joins rows to feature ids. A quantitative `color` bins values into quantile classes from a sequential scheme (`blue` by default; set `encoding.color.scale.scheme` to `green`, `orange`, `purple`, or `teal`); a nominal `color` assigns categorical fills via `scale.range`.

Add a `points` layer for symbol overlays (`longitude`/`latitude` channels, optional `size` and `color`), and `geo.focus` to zoom the camera to a feature, a set of features, or the point cluster. Vanilla uses `createMap(container, spec)`.

For the full field reference, see [MapSpec in spec-reference.md](spec-reference.md#mapspec).

**Live examples**: [US choropleth](https://tryopendata.github.io/openchart/?story=maps--maps#us-state-unemployment) | [World projections](https://tryopendata.github.io/openchart/?story=maps--maps#world-equal-earth) | [Zoom to feature](https://tryopendata.github.io/openchart/?story=maps--maps#zoom-to-feature) | [Point layer](https://tryopendata.github.io/openchart/?story=maps--maps#point-layer)

---

## Tilemap

US state tile grid map: every state is an equal-size square in a fixed 12x8 grid. Because each state gets the same visual weight, small states stay readable, at the cost of true geography. Good for one-value-per-state datasets where Rhode Island matters as much as Texas.

Tilemaps use a separate component and spec type (`TileMapSpec`) from standard charts.

```tsx
// React
import { TileMap } from "@opendata-ai/openchart-react";

const spec = {
  type: "tilemap",
  data: { CA: 5.3, TX: 4.3, NY: 4.5, FL: 3.1 /* ...state code -> value */ },
  palette: "blue",
  chrome: { title: "Unemployment by state" },
};

<TileMap spec={spec} />
```

`data` is either a record mapping state postal codes to values (shown above) or tabular rows plus an `encoding` with `state` and `value` channels. Numeric values produce a sequential color scale with a gradient legend; string values (or a `colors` map) switch to categorical mode with swatches. States missing from the data render as empty tiles rather than gaps.

`palette` picks the sequential scale: `'blue'` (default), `'green'`, `'orange'`, `'purple'`, or `'teal'`. Note that `scale.scheme` on tilemap encoding channels fails validation; the top-level `palette` property is the mechanism tilemaps use. Format numbers with `encoding.value.format` (a d3-format string). Vanilla uses `createTileMap(container, spec)`.

For the full field reference, see [TileMapSpec in spec-reference.md](spec-reference.md#tilemapspec).

**Live examples**: [Quantitative](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#quantitative) | [Categorical](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#categorical) | [Palette variants](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#palettes) | [Partial data](https://tryopendata.github.io/openchart/?story=sankey---tile-maps--sankey-and-tile-maps#partial-data)

---

## Beeswarm

Distribution of individual observations, dodged apart so no two dots overlap. Better than a histogram when you want every data point visible, and better than a strip plot when the data is dense enough that ticks would pile up.

```ts
const spec = {
  mark: "beeswarm",
  data: [
    { county: "A", income: 71.2 },
    { county: "B", income: 54.7 },
    { county: "C", income: 94.3 },
    // ...one row per observation
  ],
  encoding: {
    x: { field: "income", type: "quantitative" },
  },
};
```

One positional channel is the quantitative value axis (`x` for a horizontal swarm, `y` for a vertical one). The other positional channel is optional: add a nominal/ordinal `y` (or `x`) to split into grouped lanes, one swarm per category.

**Accepted encodings:**
- `x` or `y` (quantitative, required) -- the value axis
- the other position (nominal/ordinal, optional) -- grouped lanes, one per category
- `color` (optional) -- categorical grouping, or quantitative for a sequential gradient on dots
- `size` (optional, quantitative) -- scales dot radius; pass `size.scale.range` to cap the radius so tall stacks stay inside the chart area

The cross axis has no scale. The dodge layout computes pixel offsets around each lane center, so lane order and dot packing come from the data, not a positional encoding.

**Live examples**: [Single-lane swarm](https://tryopendata.github.io/openchart/?story=testing--fixtures--beeswarm-basic) | [Grouped lanes](https://tryopendata.github.io/openchart/?story=testing--fixtures--beeswarm-grouped) | [Sized dots](https://tryopendata.github.io/openchart/?story=testing--fixtures--beeswarm-sized)

---

## Waffle

Part-to-whole composition as a grid of unit squares. Each cell is one unit, so "37 of 100" reads directly off the grid. A concrete alternative to a pie when the audience should be able to count.

```ts
const spec = {
  mark: "waffle",
  data: [
    { tenure: "Own with mortgage", share: 40 },
    { tenure: "Own outright", share: 26 },
    { tenure: "Rent", share: 34 },
  ],
  encoding: {
    theta: { field: "share", type: "quantitative" },
    color: { field: "tenure", type: "nominal" },
  },
};
```

`theta` is the quantitative share value (the same part-to-whole channel arc marks use; it is an alias for `y`, so provide one of the two). `color` is the required category. Values normalize to the grid via largest-remainder rounding, so the cells always sum exactly even when the shares are fractional.

**Mark options:**
- `units` (default 100) -- total number of cells in the grid
- `columns` (default 10) -- columns per grid; rows derive from `units / columns`

Set these on the mark object, e.g. `mark: { type: "waffle", units: 50, columns: 10 }`. A categorical `color` encoding accepts `highlight` to single out one category and mute the rest.

**Live examples**: [Basic waffle](https://tryopendata.github.io/openchart/?story=testing--fixtures--waffle-basic) | [Highlighted category](https://tryopendata.github.io/openchart/?story=testing--fixtures--waffle-highlight)

---

## Calendar

GitHub-style calendar heatmap: one cell per day, laid out as weeks (columns) by weekdays (rows), colored by a daily value. Good for daily time series where seasonality and weekday patterns matter more than exact values.

```ts
const spec = {
  mark: "calendar",
  data: [
    { date: "2023-01-01", reports: 6 },
    { date: "2023-01-02", reports: 15 },
    // ...one row per day
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    color: { field: "reports", type: "quantitative" },
  },
};
```

`x` is the daily date (temporal, one row per day) and `color` is the quantitative per-day value. There is no `y` channel: the calendar computes its own weeks-by-weekdays geometry, so it owns positional layout with no axes. Multi-year data partitions into one stacked band per year, all bands sharing a single color scale and legend. Days with no data row render as empty cells.

The `color` scale drives the legend. A quantitative `color` encoding produces a **continuous legend** instead of categorical swatches: a gradient bar for sequential/diverging scales, or discrete class swatches for binned scales (`quantile`, `quantize`, `threshold`). Sequential ramps label the min and max; diverging ramps (e.g. `scale: { scheme: "redBlue" }`) add a midpoint label. Any mark with a quantitative `color` encoding gets this legend, not just the calendar.

**Mark options:**
- `weekStart` (`'monday'` default, or `'sunday'`) -- which weekday occupies the top row
- `cellRadius` (default 1) -- corner radius in pixels for day cells

**Live examples**: [One year, diverging](https://tryopendata.github.io/openchart/?story=testing--fixtures--calendar-diverging-year) | [Two years, sequential](https://tryopendata.github.io/openchart/?story=testing--fixtures--calendar-sequential-two-years) | [Compact](https://tryopendata.github.io/openchart/?story=testing--fixtures--calendar-compact)

---

## Parliament

Hemicycle seat chart: one dot per seat, packed into concentric semicircular arcs and grouped by party left to right. The standard form for legislative composition, where "who holds a majority" is the question.

```ts
const spec = {
  mark: "parliament",
  data: [
    { party: "Democratic", seats: 213 },
    { party: "Republican", seats: 222 },
  ],
  encoding: {
    theta: { field: "seats", type: "quantitative" },
    color: {
      field: "party",
      type: "nominal",
      scale: { range: ["#1b7fa3", "#c44e52"] },
    },
  },
};
```

`theta` is the quantitative seat count (an alias for `y`; provide one of the two) and `color` is the required party. Order the data left to right by political group; the layout preserves that order across the arc. Party colors typically come from an explicit `color.scale.range` rather than the default palette.

**Mark options:**
- `shape` (`'hemicycle'`, the default and only shape)
- `seatRadius` (`'auto'` default) -- seat dot radius in pixels; `'auto'` sizes dots to fill the rings for the given seat count
- `majorityLine` (default true) -- draws the majority-threshold line and its "N to win" label

**Live examples**: [US House](https://tryopendata.github.io/openchart/?story=testing--fixtures--parliament-us-house) | [Multi-party](https://tryopendata.github.io/openchart/?story=testing--fixtures--parliament-eu-multi-party) | [Compact](https://tryopendata.github.io/openchart/?story=testing--fixtures--parliament-compact)

---

## Marks: text, rule, tick

Lower-level mark types for specialized use cases.

### Text mark

Data-positioned labels. Place text at specific coordinates in the chart.

```ts
const spec = {
  mark: "text",
  data: [
    { x: 2020, y: 50, label: "Baseline" },
    { x: 2023, y: 82, label: "Current" },
  ],
  encoding: {
    x: { field: "x", type: "quantitative" },
    y: { field: "y", type: "quantitative" },
    text: { field: "label" },
  },
};
```

### Rule mark

Reference lines as data marks, not annotations. Use when you want to plot horizontal or vertical lines from data.

```ts
const spec = {
  mark: "rule",
  data: [
    { threshold: 100, label: "Target" },
    { threshold: 75, label: "Minimum" },
  ],
  encoding: {
    y: { field: "threshold", type: "quantitative" },
  },
};
```

### Tick mark

Strip/rug plots showing distribution of individual observations along an axis.

```ts
const spec = {
  mark: "tick",
  data: [
    { score: 72 }, { score: 85 }, { score: 91 },
    { score: 68 }, { score: 79 }, { score: 88 },
  ],
  encoding: {
    x: { field: "score", type: "quantitative" },
  },
};
```

**Live examples**: [Text mark](https://tryopendata.github.io/openchart/?story=charts--building-blocks#text-mark) | [Rule mark](https://tryopendata.github.io/openchart/?story=charts--building-blocks#rule-mark) | [Tick mark](https://tryopendata.github.io/openchart/?story=charts--building-blocks#tick-mark)

---

## Layer charts

Overlay different mark types on shared scales. Use layers when you need to combine chart types that can't be expressed as a single mark (e.g., a line over an area, or reference bars behind scatter points).

```ts
const spec = {
  layer: [
    {
      mark: "area",
      data: revenueData,
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "revenue", type: "quantitative" },
      },
    },
    {
      mark: "line",
      data: targetData,
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "target", type: "quantitative" },
      },
    },
  ],
  chrome: { title: "Revenue vs target" },
};
```

**How it works:**
- All layers share scales by default. The engine unions data from all layers to compute a single domain.
- Parent-level `data` and `encoding` are inherited by children that don't define their own. Child channels override parent channels on the same key.
- `chrome`, `legend`, `annotations`, and `labels` are set at the parent level.

**When to use layers vs. multi-series:** If your data has multiple series of the same mark type (e.g., US vs UK lines), use a single chart with a `color` encoding. Use layers when you need different mark types or independent datasets on the same axes.

See [LayerSpec](spec-reference.md#layerspec) for the full field reference.

---

## Faceting (small multiples)

Repeat one chart as a grid of panels, one panel per category. Better than a crowded multi-series chart when the series overlap too much to read, or when the point is comparing shapes across groups.

```ts
const spec = {
  mark: "line",
  data: gdpData, // rows carry a country field
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "gdp", type: "quantitative" },
    facet: { field: "country", type: "nominal", columns: 3 },
  },
  chrome: { title: "GDP growth by country" },
};
```

Three facet channels, all taking the same `{ field, type, sort }` shape:

- `encoding.facet` -- wrap grid. Panels flow left-to-right and wrap; `columns` controls the grid width (auto-computed when omitted). Both scales are shared by default.
- `encoding.row` -- vertically stacked panels, one per value. Shares the x-axis by default; each panel gets its own y-axis. Good for directional comparisons like "same value axis, different categories per panel".
- `encoding.column` -- side-by-side panels in a single row. Shares the y-axis by default; each panel gets its own x-axis.

The channels are mutually exclusive: `row` + `column` together is rejected (no cross-product faceting yet), as is combining either with `facet`.

Override the shared/independent defaults with the top-level `resolve` field:

```ts
const spec = {
  mark: "line",
  data: gdpData,
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "gdp", type: "quantitative" },
    facet: { field: "country", type: "nominal" },
  },
  resolve: { scale: { y: "independent" } }, // each panel fits its own y-domain
};
```

Shared scales keep panels directly comparable; independent scales let each panel fill its frame so the shape reads, not the level. When a scale is shared, redundant tick labels are stripped: y-axis labels render only on the leftmost column, and row-faceted panels show x-axis labels only on the bottom panel.

Each panel compiles as a regular chart with a header showing the facet value. Panels have a 200px minimum width (columns degrade responsively below that) and the figure grows taller when panels would fall under 100px.

See [Faceting in spec-reference.md](spec-reference.md#faceting) for the full field reference.

**Live examples**: [Shared scales](https://tryopendata.github.io/openchart/?story=features--data-and-encoding#facet-shared) | [Independent scales](https://tryopendata.github.io/openchart/?story=features--data-and-encoding#facet-independent) | [Row faceting](https://tryopendata.github.io/openchart/?story=features--data-and-encoding#row-facet)

---

## Editorial examples

Publication-quality charts with responsive variants at different breakpoints:

| Chart type | Live example |
|------------|-------------|
| Horizontal bar | [Population by country](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#simple-bars) |
| Stacked bar | [Household spending](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#stacked-bars) |
| Diverging column | [Temperature anomaly](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#diverging-columns) |
| Stacked column | [Energy mix](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#stacked-bars) |
| Multi-series line | [GDP growth](https://tryopendata.github.io/openchart/?story=charts--line-and-area#multi-series-labels) |
| Bubble chart | [Emissions vs renewables](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#bubble) |
| Scatter with trend | [Wealth and health](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#trend-annotation) |
| Dumbbell | [Life expectancy](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dumbbell) |
| Donut with leaders | [Smartphone market](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#leader-line-labels) |
| Donut comparison | [Electricity mix](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#comparison-donuts) |

---

## Related docs

- [Ranking and change](ranking-and-change.md) for slope, bump, and range chart recipes
- [Spec reference](spec-reference.md) for field-by-field type details and encoding rules
- [Tables](tables.md) for data tables with heatmaps, sparklines, and more
- [Graphs](graphs.md) for network/relationship visualizations
- [Getting started](getting-started.md) for a hands-on tutorial
- [Integration guide](integration-guide.md) for events, export, responsive patterns, and framework-specific code
- [Visualization patterns](agent-patterns.md) for data storytelling recipes with real-world data
