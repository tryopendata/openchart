# Rendering & APIs

Framework-specific rendering, event handlers, and builder functions.

## React

```tsx
import { Chart, DataTable, Graph, VizThemeProvider } from '@opendata-ai/react';

<Chart spec={chartSpec} darkMode="auto" />
<DataTable spec={tableSpec} onRowClick={(row) => console.log(row)} />
<Graph spec={graphSpec} onNodeClick={(node) => console.log(node)} />

<VizThemeProvider theme={myTheme}>
  <Chart spec={spec1} />
  <DataTable spec={spec2} />
</VizThemeProvider>
```

## Vue

```vue
import { Chart, DataTable, Graph, VizThemeProvider } from '@opendata-ai/vue';

<Chart :spec="chartSpec" darkMode="auto" />
<DataTable :spec="tableSpec" />
<Graph :spec="graphSpec" />
```

## Svelte

```svelte
import { Chart, DataTable, Graph, ThemeProvider } from '@opendata-ai/svelte';

<Chart {spec} darkMode="auto" />
<DataTable {spec} />
<Graph {spec} />
```

## Vanilla JS

```typescript
import { createChart, createTable, createGraph } from "@opendata-ai/vanilla";

// Charts
const chart = createChart(container, spec, { darkMode: "auto", responsive: true });
chart.update(newSpec);
const svgString = chart.export("svg");           // returns string
const pngBlob = await chart.export("png");       // returns Promise<Blob>
const csvString = chart.export("csv");            // returns string
chart.destroy();

// Tables
const table = createTable(container, tableSpec, { responsive: true });
table.export("csv");                              // returns string (all filtered/sorted rows)
table.getState();                                 // { sort, search, page }
table.setState({ search: "query", page: 0 });    // programmatic state control
table.destroy();

// Graphs
const graph = createGraph(container, graphSpec, { responsive: true });
graph.search("query");
graph.zoomToFit();
graph.zoomToNode("node-id");
graph.selectNode("node-id");
graph.destroy();
```

## Event Handlers

**Charts:** `onMarkClick`, `onMarkHover`, `onMarkLeave`, `onLegendToggle`, `onAnnotationClick`, `onAnnotationEdit`
**Tables:** `onRowClick`, `onSortChange`, `onSearchChange`, `onPageChange`
**Graphs:** `onNodeClick`, `onNodeDoubleClick`, `onSelectionChange`

`onAnnotationEdit` fires when a user drags a text annotation label to reposition it. Signature: `(annotation: TextAnnotation, updatedOffset: { dx?: number, dy?: number }) => void`. Use this to persist annotation position changes.

## Builder Functions

Shorthand for common specs. Import from `@opendata-ai/core`.

```typescript
import { lineChart, barChart, columnChart, pieChart, scatterChart, dataTable, inferFieldType } from "@opendata-ai/core";

const spec = lineChart(data, "date", "revenue", { color: "region", chrome: { title: "Revenue by region" } });
const spec = barChart(data, "category", "value");  // note: barChart(data, category, value) not (data, x, y)
const spec = dataTable(data, { search: true, pagination: { pageSize: 20 } });

// inferFieldType samples data values and returns "quantitative"|"temporal"|"nominal"
const fieldType = inferFieldType(data, "fieldName");
```

Builder functions accept field names as strings (auto-infers type from data) or full `EncodingChannel` objects for explicit control.
