# Getting started

A hands-on walkthrough building from a bare chart to themed, annotated visualizations and data tables. Each section builds on the previous one. All examples are complete and runnable.

## Your first chart

Install the package for your framework:

```bash
# React
bun add @opendata-ai/openchart-react

# Vue 3
bun add @opendata-ai/openchart-vue

# Svelte 5
bun add @opendata-ai/openchart-svelte

# Vanilla JS
bun add @opendata-ai/openchart-vanilla
```

Each framework package pulls in `core` and `engine` as dependencies. You don't need to install them separately.

Create a line chart with a few data points. The spec is the same across all frameworks, only the component import changes.

### React

```tsx
import { Chart } from "@opendata-ai/openchart-react";

const spec = {
  type: "line",
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

function App() {
  return (
    <div style={{ width: 600, height: 400 }}>
      <Chart spec={spec} />
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { Chart } from "@opendata-ai/openchart-vue";

const spec = {
  type: "line",
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
</script>

<template>
  <div style="width: 600px; height: 400px">
    <Chart :spec="spec" />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
import { Chart } from "@opendata-ai/openchart-svelte";

const spec = {
  type: "line",
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
</script>

<div style="width: 600px; height: 400px">
  <Chart {spec} />
</div>
```

The `encoding` object maps data fields to visual channels. `type` tells the engine how to interpret the values: `temporal` for dates, `quantitative` for numbers, `nominal` for categories.

The chart component fills its parent container. Set width and height on the wrapper element.

**The rest of this guide uses React for code examples.** The spec is always the same. For Vue, swap the import to `@opendata-ai/openchart-vue` and use `<Chart :spec="spec" />`. For Svelte, import from `@opendata-ai/openchart-svelte` and use `<Chart {spec} />`.

## Add chrome

Chrome is the editorial text around the chart: title, subtitle, source attribution, byline, footer. These are first-class structural elements, not string afterthoughts.

```tsx
const spec = {
  type: "line",
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
  chrome: {
    title: "Monthly active users",
    subtitle: "Quarterly growth through 2023",
    source: "Source: Internal analytics",
  },
};
```

The engine reserves space for chrome elements and positions them with proper typography hierarchy. You can also pass an object with style overrides instead of a plain string:

```tsx
chrome: {
  title: { text: 'Monthly active users', style: { fontSize: 24, fontWeight: 700 } },
  subtitle: 'Quarterly growth through 2023',
  source: 'Source: Internal analytics',
}
```

## Change chart type

Swap `type: 'line'` for any supported chart type. The encoding channels stay the same, the engine handles the rest.

```tsx
const spec = {
  type: "bar",
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
  chrome: {
    title: "Language popularity",
    subtitle: "2024 developer survey results",
  },
};
```

Supported types: `line`, `area`, `bar` (horizontal), `column` (vertical), `scatter`, `dot`, `pie`, `donut`.

**Bar vs column**: `bar` draws horizontal bars (categories on y-axis). `column` draws vertical bars (categories on x-axis). Pick the one that matches your data layout.

## Multi-series

Add a `color` encoding channel to split data into series. The engine assigns colors from the categorical palette and generates a legend automatically.

```tsx
const spec = {
  type: "line",
  data: [
    { date: "2020-01-01", gdp: 2.3, country: "United States" },
    { date: "2021-01-01", gdp: 5.7, country: "United States" },
    { date: "2022-01-01", gdp: 2.1, country: "United States" },
    { date: "2020-01-01", gdp: 1.4, country: "United Kingdom" },
    { date: "2021-01-01", gdp: 7.4, country: "United Kingdom" },
    { date: "2022-01-01", gdp: 3.7, country: "United Kingdom" },
    { date: "2020-01-01", gdp: 0.6, country: "Germany" },
    { date: "2021-01-01", gdp: 2.9, country: "Germany" },
    { date: "2022-01-01", gdp: 1.8, country: "Germany" },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "gdp",
      type: "quantitative",
      axis: { label: "GDP Growth (%)" },
    },
    color: { field: "country", type: "nominal" },
  },
  chrome: {
    title: "GDP growth comparison",
    subtitle: "Annual GDP growth rate, 2020-2022",
    source: "Source: World Bank",
  },
};
```

The `axis.label` property on an encoding channel customizes the axis title. Without it, the field name is used.

## Annotations

Add reference lines, highlighted ranges, or text callouts to draw attention to specific data points.

```tsx
const spec = {
  type: "line",
  data: [
    { date: "2020-01-01", gdp: 2.3, country: "United States" },
    { date: "2021-01-01", gdp: 5.7, country: "United States" },
    { date: "2022-01-01", gdp: 2.1, country: "United States" },
    { date: "2020-01-01", gdp: 1.4, country: "United Kingdom" },
    { date: "2021-01-01", gdp: 7.4, country: "United Kingdom" },
    { date: "2022-01-01", gdp: 3.7, country: "United Kingdom" },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "gdp",
      type: "quantitative",
      axis: { label: "GDP Growth (%)" },
    },
    color: { field: "country", type: "nominal" },
  },
  chrome: {
    title: "GDP growth comparison",
    source: "Source: World Bank",
  },
  annotations: [
    // Horizontal reference line at zero
    { type: "refline", y: 0, label: "Zero growth", style: "dashed" },
    // Text callout at a specific point
    { type: "text", x: "2021-01-01", y: 7.4, text: "UK recovery peak" },
    // Highlighted range
    {
      type: "range",
      x1: "2020-01-01",
      x2: "2020-07-01",
      label: "COVID impact",
      opacity: 0.1,
    },
  ],
};
```

Three annotation types are available:

| Type      | Purpose                               | Required fields            |
| --------- | ------------------------------------- | -------------------------- |
| `refline` | Horizontal or vertical reference line | `x` or `y` (data value)    |
| `text`    | Text callout at a data coordinate     | `x`, `y`, `text`           |
| `range`   | Highlighted band                      | `x1`/`x2` and/or `y1`/`y2` |

## Dark mode

Three modes: `"auto"` follows system preference, `"force"` always renders dark, `"off"` (default) always renders light.

```tsx
// System preference
<Chart spec={spec} darkMode="auto" />

// Always dark
<Chart spec={spec} darkMode="force" />
```

Dark mode adapts the theme automatically: background, text colors, gridlines, axis colors, and palette brightness are all adjusted. You don't need to define a separate dark theme.

## Custom theme

Override any part of the default theme with a `ThemeConfig` object. The engine deep-merges your overrides onto the defaults, so you only specify what you want to change.

```tsx
import { Chart, VizThemeProvider } from "@opendata-ai/openchart-react";
import type { ThemeConfig } from "@opendata-ai/openchart-core";

const warmTheme: ThemeConfig = {
  colors: {
    categorical: ["#e76f51", "#f4a261", "#e9c46a", "#2a9d8f", "#264653"],
    background: "#fdf6ec",
    text: "#3d2c1e",
    gridline: "#e8ddd0",
  },
  fonts: {
    family: 'Georgia, "Times New Roman", serif',
  },
  spacing: {
    padding: 16,
  },
  borderRadius: 8,
};
```

Apply a theme per-component or to all descendants via the provider:

**React:**

```tsx
import { Chart, VizThemeProvider } from "@opendata-ai/openchart-react";

// Per-component
<Chart spec={spec} theme={warmTheme} />

// All descendants
<VizThemeProvider theme={warmTheme}>
  <Chart spec={chartSpec} />
  <DataTable spec={tableSpec} />
</VizThemeProvider>
```

**Vue:**

```vue
<template>
  <VizThemeProvider :theme="warmTheme">
    <Chart :spec="chartSpec" />
    <DataTable :spec="tableSpec" />
  </VizThemeProvider>
</template>
```

**Svelte:**

```svelte
<VizThemeProvider theme={warmTheme}>
  <Chart spec={chartSpec} />
  <DataTable spec={tableSpec} />
</VizThemeProvider>
```

Theme config options:

| Property             | What it controls                                      |
| -------------------- | ----------------------------------------------------- |
| `colors.categorical` | Array of CSS color strings for series differentiation |
| `colors.background`  | Chart background color                                |
| `colors.text`        | Default text color                                    |
| `colors.gridline`    | Gridline color                                        |
| `colors.axis`        | Axis line and tick color                              |
| `fonts.family`       | Primary font family                                   |
| `fonts.mono`         | Monospace font for tabular numbers                    |
| `spacing.padding`    | Internal padding (px)                                 |
| `spacing.chromeGap`  | Gap between chrome elements (px)                      |
| `borderRadius`       | Border radius for containers and tooltips             |

## Your first table

Tables are a visualization type, not a plain HTML grid. Define columns, add visual features, enable sorting and search.

```tsx
import { DataTable } from "@opendata-ai/openchart-react";
import type { TableSpec } from "@opendata-ai/openchart-core";

const spec: TableSpec = {
  type: "table",
  data: [
    { language: "Python", popularity: 29, growth: 3.2 },
    { language: "JavaScript", popularity: 24, growth: -1.1 },
    { language: "TypeScript", popularity: 17, growth: 4.5 },
    { language: "Java", popularity: 14, growth: -0.8 },
    { language: "Go", popularity: 10, growth: 2.1 },
    { language: "Rust", popularity: 6, growth: 1.9 },
  ],
  columns: [
    { key: "language", label: "Language" },
    { key: "popularity", label: "Popularity %", format: ".0f", bar: {} },
    { key: "growth", label: "YoY Growth", format: "+.1f" },
  ],
  chrome: {
    title: "Developer survey",
    subtitle: "Top languages by popularity",
  },
  search: true,
};

function App() {
  return (
    <div style={{ maxWidth: 600 }}>
      <DataTable spec={spec} />
    </div>
  );
}
```

Each column config has a `key` (matching a field in the data) and optional properties for display, formatting, and visual features. Columns are sortable by default.

## Table visual types

Each column can have one visual feature. The most common ones:

### Heatmap

Color the cell background based on the numeric value:

```tsx
columns: [
  { key: "city", label: "City" },
  {
    key: "temperature",
    label: "Temp",
    format: ".1f",
    heatmap: { palette: "redBlue" },
  },
];
```

The `palette` property accepts a named palette (`'redBlue'`) or an array of color stops. The domain is auto-derived from the data unless you provide `domain: [min, max]`.

### Inline bar

Render a proportional bar in the cell:

```tsx
columns: [
  { key: "name", label: "Name" },
  { key: "value", label: "Sales", format: ",.0f", bar: { color: "#2a9d8f" } },
];
```

### Sparkline

Render a mini line or bar chart from an array field:

```tsx
columns: [
  { key: "name", label: "Name" },
  {
    key: "trend",
    label: "12-Month Trend",
    sparkline: { type: "line", valuesField: "trend" },
  },
];
```

### Category colors

Color-code cells based on categorical values:

```tsx
columns: [
  { key: "state", label: "State" },
  {
    key: "winner",
    label: "Winner",
    categoryColors: {
      Democrat: "#2166ac",
      Republican: "#b2182b",
    },
  },
];
```

### Other column options

| Property   | Type                            | What it does                                |
| ---------- | ------------------------------- | ------------------------------------------- |
| `sortable` | `boolean`                       | Enable column sorting (default: `true`)     |
| `align`    | `'left' \| 'center' \| 'right'` | Text alignment (auto-detected for numbers)  |
| `width`    | `string`                        | CSS width like `'200px'` or `'20%'`         |
| `format`   | `string`                        | d3-format string for number/date formatting |
| `image`    | `{ width?, height?, rounded? }` | Render cell value as an image URL           |
| `flag`     | `boolean`                       | Render cell value as a country flag         |

### Table-level options

```tsx
const spec: TableSpec = {
  type: 'table',
  data: myData,
  columns: [...],
  search: true,                        // Client-side search bar
  pagination: { pageSize: 20 },        // Paginate with 20 rows per page
  stickyFirstColumn: true,             // Freeze first column on horizontal scroll
  compact: true,                       // Reduced padding and font sizes
};
```

## Graph visualization

Graphs render force-directed network visualizations from nodes and edges. Instead of `data` and `encoding`, you provide `nodes` (with `id` fields), `edges` (with `source`/`target`), and a graph-specific `encoding` that maps node data to visual properties.

The spec is the same across all frameworks:

```ts
const spec: GraphSpec = {
  type: "graph",
  nodes: [
    { id: "a", label: "Alice", group: "eng" },
    { id: "b", label: "Bob", group: "eng" },
    { id: "c", label: "Carol", group: "design" },
    { id: "d", label: "Dan", group: "design" },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "d" },
    { source: "a", target: "c" },
  ],
  encoding: {
    nodeColor: { field: "group", type: "nominal" },
    nodeLabel: { field: "label", type: "nominal" },
  },
  layout: { type: "force" },
  chrome: { title: "Team connections" },
};
```

**React:**

```tsx
import { Graph } from "@opendata-ai/openchart-react";

<div style={{ width: 600, height: 400 }}>
  <Graph spec={spec} />
</div>
```

**Vue:**

```vue
<script setup lang="ts">
import { Graph } from "@opendata-ai/openchart-vue";
</script>

<template>
  <div style="width: 600px; height: 400px">
    <Graph :spec="spec" />
  </div>
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { Graph } from "@opendata-ai/openchart-svelte";
</script>

<div style="width: 600px; height: 400px">
  <Graph {spec} />
</div>
```

Graphs render on canvas (not SVG) and use a force simulation to position nodes. They support click, drag, double-click interaction, text search across nodes, zoom/pan, and keyboard navigation. See the [integration guide](integration-guide.md) for imperative control via the `useGraph()` hook (React), composable (Vue), or action (Svelte).

## Vanilla JS

If you're not using React, install the vanilla package directly:

```bash
bun add @opendata-ai/openchart-vanilla
```

### Chart

```ts
import { createChart } from "@opendata-ai/openchart-vanilla";

const container = document.getElementById("chart")!;

const chart = createChart(
  container,
  {
    type: "column",
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
    chrome: {
      title: "Monthly sales",
    },
  },
  {
    darkMode: "auto",
    responsive: true,
  },
);

// Later: update with new data
chart.update(newSpec);

// Export to SVG or PNG
const svgString = chart.export("svg");
const pngBlob = await chart.export("png");

// Clean up when done
chart.destroy();
```

`createChart` returns a `ChartInstance` with four methods:

| Method           | What it does                               |
| ---------------- | ------------------------------------------ |
| `update(spec)`   | Re-compile and re-render with a new spec   |
| `resize()`       | Re-compile at current container dimensions |
| `export(format)` | Export as `'svg'`, `'png'`, or `'csv'`     |
| `destroy()`      | Remove DOM elements, disconnect observers  |

Responsive mode (enabled by default) uses a `ResizeObserver` on the container, so charts resize automatically when the container changes size.

### Table

```ts
import { createTable } from "@opendata-ai/openchart-vanilla";

const container = document.getElementById("table")!;

const table = createTable(
  container,
  {
    type: "table",
    data: myData,
    columns: [
      { key: "name", label: "Name" },
      { key: "value", label: "Value", format: ",.0f", bar: {} },
    ],
    search: true,
    pagination: { pageSize: 20 },
  },
  {
    responsive: true,
    onRowClick: (row) => console.log("Clicked:", row),
    onStateChange: (state) => {
      // { sort, search, page }
      console.log("State changed:", state);
    },
  },
);

table.update(newSpec);
table.destroy();
```

## Next steps

- [Spec reference](spec-reference.md) for field-by-field type details on every spec property
- [Integration guide](integration-guide.md) for building apps: events, controlled tables, export, responsive, graphs
- [Agent patterns](agent-patterns.md) for a cookbook of visualization patterns with realistic data
- [Architecture overview](architecture.md) for how the packages fit together
- [Conventions](../CONVENTIONS.md) for code patterns and decisions
- [Contributing](../CONTRIBUTING.md) if you want to add a chart type or table feature
