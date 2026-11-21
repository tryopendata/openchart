---
title: "Marks"
description: "The channels each mark type takes, complete spec examples for common charts, and canvas mark mode."
section: spec
order: 5
---
<!-- phase-4-stub -->

# Marks

## Encoding by chart type

The engine validates encoding channels at runtime using `MARK_ENCODING_RULES`. Source: `core/src/types/encoding.ts`.

**Legend**: (req) = required, (opt) = optional, -- = not applicable

| Chart Type | x                                | y                      | color                  | size               | detail        | description | Notes                                             |
| ---------- | -------------------------------- | ---------------------- | ---------------------- | ------------------ | ------------- | --- | ------------------------------------------------- |
| `line`     | temporal, ordinal (req)          | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | color splits into multi-series with auto legend   |
| `area`     | temporal, ordinal (req)          | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Same encoding as line, filled region              |
| `bar`      | quantitative (req)               | nominal, ordinal (req) | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Horizontal bars. x = values, y = categories       |
| `column`   | nominal, ordinal, temporal (req) | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Vertical bars. x = categories, y = values         |
| `pie`      | -- (opt, unused)                 | -- (use theta) | nominal, ordinal (req) | quantitative (opt) | nominal (opt) | optional | color = slice categories, theta = slice values        |
| `donut`    | -- (opt, unused)                 | -- (use theta) | nominal, ordinal (req) | quantitative (opt) | nominal (opt) | optional | theta = slice values; same as pie with inner radius                     |
| `dot`      | quantitative (req)               | nominal, ordinal (req) | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Dot plot. x = values, y = categories              |
| `scatter`  | quantitative (req)               | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Both axes quantitative. size creates bubble chart |
| `beeswarm` | quantitative or nominal (opt)    | quantitative or nominal (opt) | nominal, ordinal, quantitative (opt) | quantitative (opt) | nominal (opt) | optional | One position is the quantitative value axis; the other (nominal/ordinal) splits into grouped lanes |
| `range`    | quantitative or nominal (req)    | quantitative or nominal (req) | nominal, ordinal (opt) | -- | nominal (opt) | optional | Dumbbell/arrow/range-bar. x+x2 (horizontal) or y+y2 (vertical); orientation-dependent second endpoint |
| `errorbar` | quantitative or nominal/ordinal/temporal (req) | quantitative or nominal/ordinal/temporal (req) | optional | optional | optional | optional | Quantitative x+x2 bounds with categorical/temporal y, or quantitative y+y2 bounds with categorical/temporal x; exactly one second endpoint |
| `waffle`   | -- (opt, unused)                 | -- (use theta) | nominal, ordinal (req) | -- | nominal (opt) | optional | Unit grid. `theta` = share, color = category |
| `parliament` | -- (opt, unused)               | -- (use theta) | nominal, ordinal (req) | -- | nominal (opt) | optional | Hemicycle seats. `theta` = seat count, color = party |
| `histogram` | quantitative (req)              | quantitative (opt)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | optional | Raw values on x; y defaults to the per-bin count. Color groups overlap rather than dodge |
| `density`  | quantitative (req)               | -- (computed)          | nominal, ordinal (opt) | -- | nominal (opt) | optional | KDE over raw x values; y is the estimated density |
| `calendar` | temporal (req)                   | -- (not allowed)       | quantitative (req)     | -- | nominal (opt) | optional | Calendar heatmap. x = daily date, color = per-day value; owns its own geometry |

### Channel purpose per chart type

**x channel**: Horizontal position. Temporal/ordinal for time series (line, area), nominal/ordinal for categories (bar, column), quantitative for values (bar, dot, scatter).

**y channel**: Vertical position. Quantitative values for most types. Nominal/ordinal categories for bar and dot (horizontal layout).

**theta channel**: Quantitative part-to-whole values for arc, waffle, and parliament. Their former authored `y` alias is rejected; use `theta`.

**color channel**: Series differentiation. Assigns colors from the categorical palette. Required for pie/donut (defines slices). Optional for all others (creates multi-series with legend).

**size channel**: Mark size. Creates bubble charts when applied to scatter. Maps a quantitative field to the dot **radius in pixels**, area-proportionally (sqrt curve); the default range is [3, 30] and `scale.range` overrides it in radius px. A constant lives at `mark.size`, also a radius (default 5, typical 2-12). Note this differs from Vega-Lite, where point `size` is an **area** in px² — a VL size of 110 is `mark.size: 6` here (r = √(area/π)); validation rejects radii above 50 with the conversion.

**detail channel**: Grouping without visual encoding. Splits data into groups (like color does) but doesn't assign different colors. Useful when you want separate lines per group but all the same color.

---

## Complete spec examples

### Line chart

```ts
const spec: ChartSpec = {
  mark: "line",
  data: [
    { date: "2023-01-01", revenue: 42000, region: "North" },
    { date: "2023-04-01", revenue: 58000, region: "North" },
    { date: "2023-07-01", revenue: 63000, region: "North" },
    { date: "2023-01-01", revenue: 31000, region: "South" },
    { date: "2023-04-01", revenue: 44000, region: "South" },
    { date: "2023-07-01", revenue: 52000, region: "South" },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "revenue",
      type: "quantitative",
      axis: { label: "Revenue ($)", format: ",.0f" },
    },
    color: { field: "region", type: "nominal" },
  },
  chrome: {
    title: "Revenue by region",
    subtitle: "Quarterly results, 2023",
    source: "Source: Finance team",
  },
  labels: { density: "endpoints" },
  annotations: [
    { type: "refline", y: 50000, label: "Target", style: "dashed" },
  ],
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--line-and-area#multi-series-labels)

### Area chart

```ts
const spec: ChartSpec = {
  mark: "area",
  data: [
    { month: "2024-01", users: 1200 },
    { month: "2024-02", users: 1800 },
    { month: "2024-03", users: 2400 },
    { month: "2024-04", users: 3100 },
  ],
  encoding: {
    x: { field: "month", type: "temporal" },
    y: { field: "users", type: "quantitative" },
  },
  chrome: { title: "User growth" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--line-and-area#area)

### Bar chart (horizontal)

```ts
const spec: ChartSpec = {
  mark: "bar",
  data: [
    { language: "Python", popularity: 29 },
    { language: "JavaScript", popularity: 24 },
    { language: "TypeScript", popularity: 17 },
    { language: "Java", popularity: 14 },
    { language: "Go", popularity: 10 },
  ],
  encoding: {
    x: { field: "popularity", type: "quantitative" },
    y: { field: "language", type: "nominal" },
  },
  chrome: { title: "Language popularity" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#simple-bars)

### Column chart (vertical bars)

```ts
const spec: ChartSpec = {
  mark: "bar",
  data: [
    { month: "Jan", sales: 120 },
    { month: "Feb", sales: 180 },
    { month: "Mar", sales: 240 },
    { month: "Apr", sales: 210 },
  ],
  encoding: {
    x: { field: "month", type: "nominal" },
    y: { field: "sales", type: "quantitative" },
  },
  chrome: { title: "Monthly sales" },
  labels: { density: "all", format: ",.0f" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--bar-and-column#columns)

### Pie chart

```ts
const spec: ChartSpec = {
  mark: "arc",
  data: [
    { category: "Desktop", share: 58 },
    { category: "Mobile", share: 35 },
    { category: "Tablet", share: 7 },
  ],
  encoding: {
    theta: { field: "share", type: "quantitative" },
    color: { field: "category", type: "nominal" },
  },
  chrome: { title: "Traffic by device" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#pie-inline-labels)

### Donut chart

```ts
const spec: ChartSpec = {
  mark: { type: "arc", innerRadius: 40 },
  data: [
    { status: "Complete", count: 42 },
    { status: "In Progress", count: 18 },
    { status: "Blocked", count: 5 },
  ],
  encoding: {
    theta: { field: "count", type: "quantitative" },
    color: { field: "status", type: "nominal" },
  },
  chrome: { title: "Task status" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--pie-and-donut#donut-center-metric)

### Scatter chart

```ts
const spec: ChartSpec = {
  mark: "point",
  data: [
    { gdp: 21400, lifeExp: 78.9, country: "USA", pop: 331 },
    { gdp: 40300, lifeExp: 83.4, country: "Switzerland", pop: 8.6 },
    { gdp: 1900, lifeExp: 69.4, country: "India", pop: 1380 },
    { gdp: 10500, lifeExp: 76.9, country: "China", pop: 1400 },
  ],
  encoding: {
    x: {
      field: "gdp",
      type: "quantitative",
      axis: { label: "GDP per capita ($)" },
    },
    y: {
      field: "lifeExp",
      type: "quantitative",
      axis: { label: "Life expectancy" },
    },
    size: { field: "pop", type: "quantitative" },
    color: { field: "country", type: "nominal" },
  },
  chrome: { title: "GDP vs life expectancy" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#bubble)

### Dot plot

```ts
const spec: ChartSpec = {
  mark: "circle",
  data: [
    { team: "Engineering", satisfaction: 8.2 },
    { team: "Design", satisfaction: 7.9 },
    { team: "Sales", satisfaction: 6.5 },
    { team: "Support", satisfaction: 7.1 },
  ],
  encoding: {
    x: { field: "satisfaction", type: "quantitative" },
    y: { field: "team", type: "nominal" },
  },
  chrome: { title: "Team satisfaction scores" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=charts--scatter-and-distribution#dot-plot)

---

## Canvas mark mode

Scatter charts with thousands of points cost more in DOM elements than they do
in pixels. The `renderer` mount option moves point marks onto a `<canvas>`
layered under the chart SVG, which keeps a 50,000-point scatter interactive and
lets a high-cardinality keyed morph actually tween instead of snapping.

The renderer is not part of the spec. It is a host decision passed to
`createChart()` (or the `renderer` prop on the React/Vue/Svelte `<Chart>`
components), mirroring vega-embed's `{ renderer }` embed option:

```ts
createChart(el, {
  mark: 'point',
  data: campuses,          // 4,341 rows
  encoding: {
    x: { field: 'lowIncomePct', type: 'quantitative' },
    y: { field: 'readingProficiency', type: 'quantitative' },
    key: { field: 'campusId' },
  },
}, { renderer: 'canvas' });
```

| Value      | Behavior |
| ---------- | -------- |
| `'auto'`   | Default. Canvas above 1,000 compiled points, SVG at or below. |
| `'canvas'` | Canvas at any point count. |
| `'svg'`    | Never canvas. |

`renderer` applies to point marks only. On any other mark type, and on faceted,
layered or sparkline charts, it falls back to SVG; an explicit `'canvas'` there
warns once per compile.

### What canvas mode changes

The canvas paints the figure background, the gridlines and the dots. The SVG
keeps axes, tick labels, the trendline, annotations, legend and chrome, and
still carries the chart's `role` and `aria-label`.

Everything below is a deliberate trade, not a limitation to work around:

- **The trendline draws above the dots**, even with `trendline.layer: 'below'`.
  The canvas is a single layer under the whole SVG, so anything the SVG draws
  lands on top.
- **Gradient fills flatten to their first stop on screen.** Exports render the
  true gradient, because they materialize a full SVG (see below).
- **Overlapping dots can show a stroke over a neighbour's fill.** The canvas
  paints all fills in one pass and all strokes in a second, so a later dot's
  stroke can sit over an earlier dot's fill. SVG paints each dot's fill and
  stroke together. Sparse clouds are indistinguishable; tight clusters show it.
  Lowering `mark.opacity` for dense scatters — worth doing regardless, to keep
  overplotting readable — makes it disappear.
- **Per-mark keyboard focus and edit-mode point selection are unavailable.**
  There are no per-point elements to focus. Annotation, chrome and legend
  editing still work, and the screen-reader data table is unaffected.
- **The screen-reader table caps at 1,000 rows** with a caption naming the true
  total. Full data remains available via CSV export.

Tooltips, `onMarkClick`, `onMarkHover` and hover highlighting all work: pointer
events fall through to the canvas and hit-test against a spatial index.

### Exports

Exports are full-fidelity regardless of what is on screen. Canvas-mode charts
re-render to a complete SVG at export time, so gradients, gridlines and the
background all come back as vector.

| Format | Behavior |
| ------ | -------- |
| `svg`, `svg-with-fonts` | Vector at or below 5,000 points -- byte-identical to exporting the SVG-mode twin. Above that, vector everything with the dot cloud inlined as one raster `<image>`, so gridlines and text stay crisp without shipping 50,000 `<circle>` elements. |
| `png`, `jpg`, `gif` | Always full vector before rasterizing, so output is pixel-identical to SVG mode. |
| `csv` | Unchanged. |

### encoding.key channel

The `key` channel maps a field that uniquely identifies each datum across updates. It is not visually encoded. When omitted, the engine derives keys from the x-axis value (and color field for grouped charts).

Explicit keys are useful for scatter plots where multiple points can share the same x/y values:

```ts
{
  mark: 'point',
  data: points,
  encoding: {
    x: { field: 'longitude', type: 'quantitative' },
    y: { field: 'latitude', type: 'quantitative' },
    key: { field: 'stationId' },
  },
  animation: true,
}
```

### Interruption behavior

When `.update()` is called while a previous transition is still running, the new transition retargets from the current interpolated positions rather than snapping to the previous final state. This creates a smooth redirect effect for rapid updates or streaming data.

For line/area marks, mid-morph interruption uses a crossfade from the frozen intermediate path to the new final path, since re-matching interpolated point arrays is intractable.
