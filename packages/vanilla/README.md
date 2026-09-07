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

## 3D graphs

`dimensions: 3` on a graph spec renders with WebGL instead of canvas. The 3D
renderer ships on its own subpath so three.js never lands in the default bundle,
and its libraries are optional peers you install yourself:

```bash
npm install three 3d-force-graph three-spritetext
```

The subpath registers the renderer as an import side effect, so it has to be
imported before the graph mounts:

```typescript
import '@opendata-ai/openchart-vanilla/graph-3d';
import { createGraph } from '@opendata-ai/openchart-vanilla';

createGraph(container, { ...graphSpec, dimensions: 3 });
```

The subpath import is required only when compilation actually resolves to 3D.
A spec above the 2000-node gate warns and falls back to 2D, so it renders
without the import; a `dimensions: 3` spec that stays 3D throws without it.

Framework hosts import their own package's mirror of this subpath rather than
reaching past it into vanilla: `@opendata-ai/openchart-react/graph-3d`,
`@opendata-ai/openchart-vue/graph-3d`, `@opendata-ai/openchart-svelte/graph-3d`.

Notes:

- **SSR**: `3d-force-graph` touches `window` at import time. Import the subpath
  client-side only (inside `useEffect`, a dynamic `import()`, or a browser-only
  module) and render your own placeholder until it resolves.
- **One copy of three**: run `npm ls three` (or `bun pm ls three`) and confirm a
  single copy. Two copies fail at runtime with `Cannot read properties of
  undefined (reading 'VERTEX')` (vasturiano/react-force-graph#595).

Differences from 2D:

- Labels use a fixed budget re-ranked by camera distance, so distant labels drop
  out instead of being decluttered by priority.
- The force simulation runs on the main thread. Above 2000 nodes the spec warns
  and renders in 2D.
- Keyboard navigation, SVG export, `interaction.cursorRepulsion`, and
  `interaction.springyDrag` are unsupported. Each warns and is ignored.
  (`layout.type` of `radial` or `hierarchical` is rejected by spec validation in
  both dimensions, so it never reaches either renderer.)
- `getCamera()` returns a pose, not a zoom transform: `x`/`y` are the look-at
  point in world units, alongside `position` and `target`. In 2D they are the
  zoom transform's translate in pixels. `onCameraChange` carries the same
  payload, so persisted camera state has to be keyed on the dimension it came
  from. Both are typed `GraphCamera`, whose `position`/`target` are optional
  because only 3D sets them; `flyTo` accepts them back, and 2D ignores them.
- A structural `update()` reheats the whole layout, so settled nodes drift. 2D
  applies a local impulse instead.
- `nodeOverrides[*].stroke` and `strokeWidth` are ignored (no ring).
- A dimension change is a remount, not an `update()`. The framework wrappers do
  this for you; `update()` with a changed `dimensions` warns and no-ops.

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
