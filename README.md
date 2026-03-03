# @opendata-ai/openchart

[![CI](https://github.com/tryopendata/openchart/actions/workflows/ci.yml/badge.svg)](https://github.com/tryopendata/openchart/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@opendata-ai/openchart-core)](https://www.npmjs.com/package/@opendata-ai/openchart-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

From the team behind [OpenData](https://tryopendata.ai), an open source data platform.

Publication-quality data graphics from a JSON spec. The kind of rich, annotated charts you see in the best newsrooms and research teams, generated from a simple declarative format that both humans and LLMs can write.

<img alt="image" src="https://github.com/user-attachments/assets/a08a9237-8fe0-45ff-8203-898848a142ab" />

### [Interactive Examples](https://tryopendata.github.io/openchart/)

## Quick start

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
  chrome: {
    title: "User growth accelerated through Q4",
    subtitle: "Monthly active users, 2023",
    source: "Source: Internal analytics",
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

## Why this exists

Most charting libraries give you building blocks and leave the editorial work to you. You get axes, gridlines, and bars, but no opinions about how to actually communicate with data. You end up spending more time wrangling SVG primitives and layout quirks than telling the story your data contains.

OpenChart works the other way around. You describe _what the chart should communicate_ in a declarative spec: the title states a finding, annotations highlight what matters, and the engine handles scales, label placement, accessibility, and responsive layout so the result reads like a polished infographic, not a developer's debug output.

The spec is a plain JSON object. That makes it easy for both humans and LLMs to author, and simple to serialize, validate, and store. The headless engine means the same spec renders in React, Vue, Svelte, or vanilla JS without code changes.

OpenChart is the visualization layer for [OpenData](https://tryopendata.ai), where researchers and journalists work with public datasets. That context shaped its design: when someone is exploring economic trends or environmental data, the chart needs to communicate the finding clearly, not just plot numbers on a screen.

Tables are a first-class visualization type, not an afterthought. They support heatmaps, sparklines, inline bars, category coloring, sorting, search, and pagination out of the box.

<img alt="image" src="https://github.com/user-attachments/assets/392db37a-1ee1-4659-8b51-4fab0890e7a9" />

## Features

| Category      | What you get                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Chart types   | Line, area, bar, column, scatter, dot, pie, donut                                                           |
| Tables        | Sort, search, pagination, heatmap cells, sparklines, inline bars, category colors, flags, images            |
| Chrome        | Title, subtitle, source, byline, footer (first-class, not string afterthoughts)                             |
| Annotations   | Reference lines, highlighted ranges, text callouts                                                          |
| Dark mode     | `"auto"` (system preference), `"force"`, or `"off"`                                                         |
| Themes        | Deep-mergeable theme config for colors, fonts, spacing                                                      |
| Accessibility | Auto-generated alt text, ARIA labels, keyboard navigation, screen reader data tables                        |
| Responsive    | Breakpoint-aware layout (label density, legend position, annotation placement)                              |
| Graphs        | Force-directed network visualization, canvas rendering, node interaction, search, zoom, keyboard navigation |
| Export        | SVG, PNG, CSV                                                                                               |

![Clipboard-20260301-051059-787](https://github.com/user-attachments/assets/3f20cfab-76fe-4a44-8d8d-2fe624e6b3de)

## Installation

| Use case                     | Install                                         |
| ---------------------------- | ----------------------------------------------- |
| React app                    | `bun add @opendata-ai/openchart-react`                    |
| Vue 3 app                    | `bun add @opendata-ai/openchart-vue`                      |
| Svelte 5 app                 | `bun add @opendata-ai/openchart-svelte`                   |
| Vanilla JS / any framework   | `bun add @opendata-ai/openchart-vanilla`                  |
| Types only / custom renderer | `bun add @opendata-ai/openchart-core @opendata-ai/openchart-engine` |

Each package re-exports the types you need, so you typically only install one. The React package pulls in vanilla, engine, and core as dependencies.

Replace `bun add` with `npm install` or `yarn add` depending on your setup.

## Usage

### React: chart

```tsx
import { Chart } from "@opendata-ai/openchart-react";
import type { ChartSpec } from "@opendata-ai/openchart-core";

const spec: ChartSpec = {
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
    source: "Source: Stack Overflow",
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

### React: data table

```tsx
import { DataTable } from "@opendata-ai/openchart-react";
import type { TableSpec } from "@opendata-ai/openchart-core";

const spec: TableSpec = {
  type: "table",
  data: [
    { city: "Phoenix", jan: 12.8, jul: 35.0, avg: 24.3 },
    { city: "Miami", jan: 20.1, jul: 28.3, avg: 24.8 },
    { city: "Chicago", jan: -3.2, jul: 24.7, avg: 10.8 },
    { city: "Anchorage", jan: -8.8, jul: 15.4, avg: 2.6 },
  ],
  columns: [
    { key: "city", label: "City" },
    {
      key: "jan",
      label: "Jan",
      format: ".1f",
      heatmap: { palette: "redBlue" },
    },
    {
      key: "jul",
      label: "Jul",
      format: ".1f",
      heatmap: { palette: "redBlue" },
    },
    { key: "avg", label: "Average", format: ".1f", bar: {} },
  ],
  chrome: {
    title: "Average monthly temperatures",
    subtitle: "Degrees Celsius by US city",
  },
  search: true,
};

function App() {
  return (
    <div style={{ maxWidth: 700 }}>
      <DataTable spec={spec} />
    </div>
  );
}
```

### React: graph

```tsx
import { Graph } from "@opendata-ai/openchart-react";

<Graph
  spec={{
    type: "graph",
    nodes: [
      { id: "a", label: "Alice", group: "eng" },
      { id: "b", label: "Bob", group: "eng" },
      { id: "c", label: "Carol", group: "design" },
    ],
    edges: [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ],
    encoding: {
      nodeColor: { field: "group", type: "nominal" },
      nodeLabel: { field: "label", type: "nominal" },
    },
    layout: { type: "force" },
    chrome: { title: "Team connections" },
  }}
/>;
```

### React: dark mode

```tsx
// Follows system preference
<Chart spec={spec} darkMode="auto" />

// Always dark
<Chart spec={spec} darkMode="force" />
```

### React: custom theme

```tsx
import { Chart, VizThemeProvider } from '@opendata-ai/openchart-react';
import type { ThemeConfig } from '@opendata-ai/openchart-core';

const theme: ThemeConfig = {
  colors: {
    categorical: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'],
    background: '#fdf6ec',
    text: '#3d2c1e',
  },
  fonts: {
    family: 'Georgia, "Times New Roman", serif',
  },
};

// Per-component
<Chart spec={spec} theme={theme} />

// Or provide to all descendants
<VizThemeProvider theme={theme}>
  <Chart spec={chartSpec} />
  <DataTable spec={tableSpec} />
</VizThemeProvider>
```

### Vanilla JS

```ts
import { createChart } from "@opendata-ai/openchart-vanilla";

const container = document.getElementById("chart");

const chart = createChart(
  container,
  {
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
    },
  },
  {
    darkMode: "auto",
    responsive: true,
  },
);

// Update with new data
chart.update(newSpec);

// Export
const svgString = chart.export("svg");
const pngBlob = await chart.export("png");

// Clean up
chart.destroy();
```

### Vanilla JS: data table

```ts
import { createTable } from "@opendata-ai/openchart-vanilla";

const container = document.getElementById("table");

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
  },
);

// Update with new data
table.update(newSpec);

// Clean up
table.destroy();
```

## Documentation

- [Getting started](docs/getting-started.md) - Hands-on tutorial building progressively from first chart to custom themes
- [Spec reference](docs/spec-reference.md) - Field-by-field type reference for ChartSpec, TableSpec, and GraphSpec
- [Integration guide](docs/integration-guide.md) - Building apps: events, controlled tables, export, responsive, graphs
- [Agent patterns](docs/agent-patterns.md) - Cookbook of visualization patterns for LLM-generated charts
- [Architecture](docs/architecture.md) - How the packages fit together, compilation pipeline, design decisions
- [Conventions](CONVENTIONS.md) - Architectural decisions and patterns for contributors
- [Contributing](CONTRIBUTING.md) - Setup, running tests, adding chart types, PR guidelines

## Package structure

```
@opendata-ai/openchart-core       Types, theme, colors, a11y, locale (no DOM)
@opendata-ai/openchart-engine     Headless compiler: spec in, layout out (no DOM)
@opendata-ai/openchart-vanilla    Imperative DOM rendering (SVG charts, HTML tables, canvas graphs)
@opendata-ai/openchart-react      React components wrapping vanilla with lifecycle management
@opendata-ai/openchart-vue        Vue 3 components wrapping vanilla with lifecycle management
@opendata-ai/openchart-svelte     Svelte 5 components wrapping vanilla with lifecycle management
```

Dependency direction: `core <- engine <- vanilla <- react / vue / svelte`. No lateral imports.

## Claude Code Plugin

If you use [Claude Code](https://docs.anthropic.com/en/docs/claude-code), the OpenChart plugin gives Claude knowledge of the spec grammar, chart types, encoding rules, and design best practices so it can generate publication-quality specs from your data.

### Install

```shell
# Add the marketplace
/plugin marketplace add tryopendata/openchart

# Install the plugin
/plugin install openchart@openchart
```

### Use

Invoke the skill directly:

```shell
/visualize-data
```

Or reference it in your prompts and rules as `openchart:visualize-data`. The skill includes reference docs for all chart types, annotations, theming, color strategy, typography, and editorial design review.

## Part of the OpenData ecosystem

OpenChart is one piece of [OpenData](https://tryopendata.ai), an open source platform for discovering, exploring, and visualizing public datasets. If you're looking for data to chart, that's a good place to start.

## License

Apache 2.0
