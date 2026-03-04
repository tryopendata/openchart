# @opendata-ai/openchart-vanilla

DOM rendering adapter for OpenChart. Creates SVG charts, HTML tables, and canvas-based network graphs from compiled specs. Framework-agnostic.

## Install

```bash
npm install @opendata-ai/openchart-vanilla
```

You typically don't install this directly unless you're working without a framework. The framework packages (`openchart-react`, `openchart-vue`, `openchart-svelte`) include it as a dependency and wrap it with lifecycle management.

## Charts

```typescript
import { createChart } from '@opendata-ai/openchart-vanilla';

const chart = createChart(container, spec, {
  darkMode: 'auto',
  responsive: true,
  onMarkClick: (event) => console.log(event.datum),
  onMarkHover: (event) => showTooltip(event),
  onMarkLeave: () => hideTooltip(),
  onLegendToggle: (series, visible) => console.log(series, visible),
  onAnnotationClick: (annotation, event) => console.log(annotation),
});

chart.update(newSpec);          // Re-render with new spec
chart.resize();                 // Manual resize trigger
chart.export('svg');            // Export as SVG string
await chart.export('png');      // Export as PNG Blob
chart.export('csv');            // Export data as CSV
chart.destroy();                // Clean up DOM and observers
```

Responsive mode (default) uses a `ResizeObserver` on the container. Charts recompile at new dimensions automatically.

## Tables

```typescript
import { createTable } from '@opendata-ai/openchart-vanilla';

const table = createTable(container, tableSpec, {
  responsive: true,
  onRowClick: (row) => console.log(row),
  onStateChange: (state) => console.log(state.sort, state.search, state.page),
});

table.update(newSpec);
table.getState();               // { sort, search, page }
table.setState({ page: 2 });    // Programmatic state control
table.export('csv');             // CSV export (respects sort/search, ignores pagination)
table.destroy();
```

## Graphs

```typescript
import { createGraph } from '@opendata-ai/openchart-vanilla';

const graph = createGraph(container, graphSpec, {
  darkMode: 'auto',
  responsive: true,
  onNodeClick: (node) => console.log(node),
  onNodeDoubleClick: (node) => console.log(node),
  onSelectionChange: (nodeIds) => console.log(nodeIds),
});

graph.search('query');           // Highlight matching nodes
graph.clearSearch();
graph.zoomToFit();              // Fit all nodes in viewport
graph.zoomToNode('node-id');    // Center on a specific node
graph.selectNode('node-id');    // Programmatic selection
graph.getSelectedNodes();       // Get selected node IDs
graph.update(newSpec);
graph.destroy();
```

Graphs render on canvas with a force simulation running in a web worker. Nodes support click, drag, and double-click. The simulation auto-fits nodes once it settles.

## Export utilities

Standalone export functions if you need them outside of an instance:

```typescript
import { exportSVG, exportPNG, exportCSV } from '@opendata-ai/openchart-vanilla';
```

## Other exports

- `observeResize()` - ResizeObserver wrapper for container tracking
- `attachKeyboardNav()` - Keyboard navigation for chart marks
- `createTooltipManager()` - Tooltip lifecycle management
- `renderChartSVG()` - Low-level SVG rendering from a ChartLayout
- `renderTable()` - Low-level table DOM rendering from a TableLayout
- `renderCell()` and cell-type renderers (`renderBarCell`, `renderSparklineCell`, `renderHeatmapCell`, etc.) - Individual table cell renderers

## Related docs

- [Getting started](../../docs/getting-started.md) for a hands-on tutorial
- [Integration guide](../../docs/integration-guide.md) for lifecycle management and events
- [Spec reference](../../docs/spec-reference.md) for field-by-field type details
