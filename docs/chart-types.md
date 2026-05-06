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

**Live examples**: [Single line](https://tryopendata.github.io/openchart/?story=line--single-line) | [Multi-series](https://tryopendata.github.io/openchart/?story=line--multi-series) | [Five series](https://tryopendata.github.io/openchart/?story=line--five-series) | [Interpolation modes](https://tryopendata.github.io/openchart/?story=line--interpolation-modes)

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

Add a `color` encoding to split into series. Multi-series area charts default to **overlap** mode — translucent gradient fills layered on a shared baseline, so each series's curve stays readable. Pass `encoding.y.stack: 'zero'` (or `true`, `'normalize'`, `'center'`) to opt into stacked composition over time.

**Live examples**: [Area chart](https://tryopendata.github.io/openchart/?story=line--area-chart) | [Multi-series overlap](https://tryopendata.github.io/openchart/?story=line--multi-series-area-overlap) | [Stacked area](https://tryopendata.github.io/openchart/?story=line--multi-series-area-stacked) | [Step area](https://tryopendata.github.io/openchart/?story=line--step-area)

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

**Live examples**: [Simple bars](https://tryopendata.github.io/openchart/?story=bar--simple-bars) | [Grouped bars](https://tryopendata.github.io/openchart/?story=bar--grouped-bars) | [Negative values](https://tryopendata.github.io/openchart/?story=bar--negative-values)

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

**Live examples**: [Simple columns](https://tryopendata.github.io/openchart/?story=column--simple-columns) | [Grouped columns](https://tryopendata.github.io/openchart/?story=column--grouped-columns) | [Negative values](https://tryopendata.github.io/openchart/?story=column--negative-values)

---

## Stacking

When a bar or column chart has a `color` encoding, values are **stacked by default** (one segment per series, stacked from zero). Control this with the `stack` property on the quantitative encoding channel.

> **Area charts are different.** Multi-series area defaults to **overlap** (translucent gradients per series, shared zero baseline) — comparison-first rather than composition-first. To stack a multi-series area, opt in explicitly with `stack: 'zero'` (or any of the values below). The `stack` property and its values otherwise behave the same way for area charts.

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

**Live examples**: [Basic pie](https://tryopendata.github.io/openchart/?story=pie--basic-pie) | [Small slice grouping](https://tryopendata.github.io/openchart/?story=pie--small-slice-grouping) | [Seven categories](https://tryopendata.github.io/openchart/?story=pie--seven-categories)

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

**Live examples**: [Donut chart](https://tryopendata.github.io/openchart/?story=pie--donut-chart) | [Donut with leaders](https://tryopendata.github.io/openchart/?story=donut-leaders--smartphone-market) | [Side-by-side comparison](https://tryopendata.github.io/openchart/?story=donut-comparison--electricity-mix)

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

**Live examples**: [Simple dot plot](https://tryopendata.github.io/openchart/?story=dot--simple-dot-plot) | [Colored dots](https://tryopendata.github.io/openchart/?story=dot--colored-dots) | [Diverging lollipop](https://tryopendata.github.io/openchart/?story=dot--diverging-lollipop) | [Dumbbell chart](https://tryopendata.github.io/openchart/?story=dot-dumbbell--life-expectancy)

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

**Live examples**: [Diverging lollipop](https://tryopendata.github.io/openchart/?story=dot--diverging-lollipop) | [Dumbbell chart](https://tryopendata.github.io/openchart/?story=dot-dumbbell--life-expectancy)

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

**Live examples**: [Basic scatter](https://tryopendata.github.io/openchart/?story=scatter--basic-scatter) | [Bubble chart](https://tryopendata.github.io/openchart/?story=scatter--bubble-chart) | [Color grouping](https://tryopendata.github.io/openchart/?story=scatter--color-grouping)

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

Options: `nodeWidth`, `nodePadding`, `nodeAlign` (`'justify'` | `'left'` | `'right'` | `'center'`), `linkStyle` (`'gradient'` | `'source'` | `'target'` | `'neutral'`), `valueFormat` for number formatting.

For the full field reference, see [SankeySpec in spec-reference.md](spec-reference.md#sankeyspec).

**Live examples**: [Energy flow](https://tryopendata.github.io/openchart/?story=sankey--energy-flow) | [Budget allocation](https://tryopendata.github.io/openchart/?story=sankey--budget-allocation) | [User journey](https://tryopendata.github.io/openchart/?story=sankey--user-journey)

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

**Live examples**: [Text mark](https://tryopendata.github.io/openchart/?story=marks--text-mark) | [Rule mark](https://tryopendata.github.io/openchart/?story=marks--rule-mark) | [Tick mark](https://tryopendata.github.io/openchart/?story=marks--tick-mark)

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

## Editorial examples

Publication-quality charts with responsive variants at different breakpoints:

| Chart type | Live example |
|------------|-------------|
| Horizontal bar | [Population by country](https://tryopendata.github.io/openchart/?story=bar-horizontal--population-bar) |
| Stacked bar | [Household spending](https://tryopendata.github.io/openchart/?story=bar-stacked--household-spending) |
| Diverging column | [Temperature anomaly](https://tryopendata.github.io/openchart/?story=column-diverging--temperature-anomaly) |
| Stacked column | [Energy mix](https://tryopendata.github.io/openchart/?story=column-stacked--energy-mix) |
| Multi-series line | [GDP growth](https://tryopendata.github.io/openchart/?story=line-multiseries--gdp-growth) |
| Bubble chart | [Emissions vs renewables](https://tryopendata.github.io/openchart/?story=scatter-bubble--emissions-vs-renewables) |
| Scatter with trend | [Wealth and health](https://tryopendata.github.io/openchart/?story=scatter-trend--wealth-health) |
| Dumbbell | [Life expectancy](https://tryopendata.github.io/openchart/?story=dot-dumbbell--life-expectancy) |
| Donut with leaders | [Smartphone market](https://tryopendata.github.io/openchart/?story=donut-leaders--smartphone-market) |
| Donut comparison | [Electricity mix](https://tryopendata.github.io/openchart/?story=donut-comparison--electricity-mix) |

---

## Related docs

- [Spec reference](spec-reference.md) for field-by-field type details and encoding rules
- [Tables](tables.md) for data tables with heatmaps, sparklines, and more
- [Graphs](graphs.md) for network/relationship visualizations
- [Getting started](getting-started.md) for a hands-on tutorial
- [Integration guide](integration-guide.md) for events, export, responsive patterns, and framework-specific code
- [Visualization patterns](agent-patterns.md) for data storytelling recipes with real-world data
