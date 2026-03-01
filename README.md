# @openchart

[![CI](https://github.com/openchart/openchart/actions/workflows/ci.yml/badge.svg)](https://github.com/openchart/openchart/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@openchart/core)](https://www.npmjs.com/package/@openchart/core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

A declarative visualization library that compiles JSON specs into charts and data tables. Write what you want to see, not how to render it.

### [Examples](https://tryopendata.github.io/openchart/)

## Quick start

```tsx
import { Chart } from '@openchart/react';

const spec = {
  type: 'line',
  data: [
    { date: '2023-01-01', value: 12 },
    { date: '2023-04-01', value: 28 },
    { date: '2023-07-01', value: 35 },
    { date: '2023-10-01', value: 42 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Monthly active users',
    source: 'Source: Internal analytics',
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

Most charting libraries make you think in terms of SVG primitives, component trees, or imperative draw calls. This library takes a different approach: you describe *what* the chart should show using a declarative spec (inspired by Vega-Lite), and the engine handles layout, scales, accessibility, and rendering.

The spec is a plain JSON object. That makes it easy for both humans and LLMs to generate, and simple to serialize, validate, and store. The headless engine means the same spec renders in React, vanilla JS, or a future server-side renderer without any code changes.

Tables are treated as a visualization type, not an afterthought. They support heatmaps, sparklines, inline bars, category coloring, sorting, search, and pagination out of the box.

## Features

| Category | What you get |
|----------|-------------|
| Chart types | Line, area, bar, column, scatter, dot, pie, donut |
| Tables | Sort, search, pagination, heatmap cells, sparklines, inline bars, category colors, flags, images |
| Chrome | Title, subtitle, source, byline, footer (first-class, not string afterthoughts) |
| Annotations | Reference lines, highlighted ranges, text callouts |
| Dark mode | `"auto"` (system preference), `"force"`, or `"off"` |
| Themes | Deep-mergeable theme config for colors, fonts, spacing |
| Accessibility | Auto-generated alt text, ARIA labels, keyboard navigation, screen reader data tables |
| Responsive | Breakpoint-aware layout (label density, legend position, annotation placement) |
| Graphs | Force-directed network visualization, canvas rendering, node interaction, search, zoom, keyboard navigation |
| Export | SVG, PNG, CSV |

## Installation

| Use case | Install |
|----------|---------|
| React app | `bun add @openchart/react` |
| Vanilla JS / any framework | `bun add @openchart/vanilla` |
| Types only / custom renderer | `bun add @openchart/core @openchart/engine` |

Each package re-exports the types you need, so you typically only install one. The React package pulls in vanilla, engine, and core as dependencies.

Replace `bun add` with `npm install` or `yarn add` depending on your setup.

## Usage

### React: chart

```tsx
import { Chart } from '@openchart/react';
import type { ChartSpec } from '@openchart/core';

const spec: ChartSpec = {
  type: 'bar',
  data: [
    { language: 'Python', popularity: 29 },
    { language: 'JavaScript', popularity: 24 },
    { language: 'TypeScript', popularity: 17 },
    { language: 'Java', popularity: 14 },
    { language: 'Go', popularity: 10 },
  ],
  encoding: {
    x: { field: 'popularity', type: 'quantitative' },
    y: { field: 'language', type: 'nominal' },
  },
  chrome: {
    title: 'Language popularity',
    subtitle: '2024 developer survey results',
    source: 'Source: Stack Overflow',
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
import { DataTable } from '@openchart/react';
import type { TableSpec } from '@openchart/core';

const spec: TableSpec = {
  type: 'table',
  data: [
    { city: 'Phoenix', jan: 12.8, jul: 35.0, avg: 24.3 },
    { city: 'Miami', jan: 20.1, jul: 28.3, avg: 24.8 },
    { city: 'Chicago', jan: -3.2, jul: 24.7, avg: 10.8 },
    { city: 'Anchorage', jan: -8.8, jul: 15.4, avg: 2.6 },
  ],
  columns: [
    { key: 'city', label: 'City' },
    { key: 'jan', label: 'Jan', format: '.1f', heatmap: { palette: 'redBlue' } },
    { key: 'jul', label: 'Jul', format: '.1f', heatmap: { palette: 'redBlue' } },
    { key: 'avg', label: 'Average', format: '.1f', bar: {} },
  ],
  chrome: {
    title: 'Average monthly temperatures',
    subtitle: 'Degrees Celsius by US city',
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
import { Graph } from '@openchart/react';

<Graph
  spec={{
    type: 'graph',
    nodes: [
      { id: 'a', label: 'Alice', group: 'eng' },
      { id: 'b', label: 'Bob', group: 'eng' },
      { id: 'c', label: 'Carol', group: 'design' },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
    encoding: {
      nodeColor: { field: 'group', type: 'nominal' },
      nodeLabel: { field: 'label', type: 'nominal' },
    },
    layout: { type: 'force' },
    chrome: { title: 'Team connections' },
  }}
/>
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
import { Chart, VizThemeProvider } from '@openchart/react';
import type { ThemeConfig } from '@openchart/core';

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
import { createChart } from '@openchart/vanilla';

const container = document.getElementById('chart');

const chart = createChart(container, {
  type: 'line',
  data: [
    { date: '2023-01-01', value: 12 },
    { date: '2023-04-01', value: 28 },
    { date: '2023-07-01', value: 35 },
    { date: '2023-10-01', value: 42 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Monthly active users',
  },
}, {
  darkMode: 'auto',
  responsive: true,
});

// Update with new data
chart.update(newSpec);

// Export
const svgString = chart.export('svg');
const pngBlob = await chart.export('png');

// Clean up
chart.destroy();
```

### Vanilla JS: data table

```ts
import { createTable } from '@openchart/vanilla';

const container = document.getElementById('table');

const table = createTable(container, {
  type: 'table',
  data: myData,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value', format: ',.0f', bar: {} },
  ],
  search: true,
  pagination: { pageSize: 20 },
}, {
  responsive: true,
  onRowClick: (row) => console.log('Clicked:', row),
});

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
@openchart/core       Types, theme, colors, a11y, locale (no DOM)
@openchart/engine     Headless compiler: spec in, layout out (no DOM)
@openchart/vanilla    Imperative DOM rendering (SVG charts, HTML tables, canvas graphs)
@openchart/react      React components wrapping vanilla with lifecycle management
```

Dependency direction: `core <- engine <- vanilla <- react`. No lateral imports.

## License

Apache 2.0
