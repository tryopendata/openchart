# @opendata-ai/openchart-svelte

Svelte 5 components for OpenChart. Renders chart specs as SVG and table specs as DOM, using Svelte's rune-based reactivity.

## Install

```bash
npm install @opendata-ai/openchart-svelte @opendata-ai/openchart-core
```

## Quick start

```svelte
<script lang="ts">
import { Chart } from '@opendata-ai/openchart-svelte';
import { lineChart } from '@opendata-ai/openchart-core';

const data = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 150 },
  { date: '2024-03', value: 130 },
];

const spec = lineChart(data, 'date', 'value');
</script>

<Chart {spec} />
```

See the [core README](../core/README.md) for all available spec builders.

## Components

| Component | Purpose |
|-----------|---------|
| `Chart` | Renders any chart spec (line, bar, column, pie, scatter, etc.) |
| `DataTable` | Renders table specs with sorting, search, and pagination |
| `Graph` | Renders network graph specs with force-directed layout |
| `Visualization` | Routes to the correct component based on spec type |
| `VizThemeProvider` | Provides theme and dark mode context to child components |

## Visualization

When you're rendering arbitrary `VizSpec` values and don't know the type ahead of time, `Visualization` inspects the spec and routes to the correct component.

```svelte
<script lang="ts">
import { Visualization } from '@opendata-ai/openchart-svelte';
import type { VizSpec } from '@opendata-ai/openchart-core';

let { spec }: { spec: VizSpec } = $props();
</script>

<!-- Renders Chart, DataTable, or Graph based on spec.type -->
<Visualization {spec} />
```

If you need event handlers or component-specific props, use the specific component directly instead.

## 3D graphs

`dimensions: 3` on a graph spec renders with WebGL instead of canvas. The 3D
renderer ships on its own subpath so three.js never lands in the default bundle,
and its libraries are optional peers you install yourself:

```bash
npm install three 3d-force-graph three-spritetext
```

The subpath registers the renderer as an import side effect, so it has to be
imported before the graph mounts. Import this package's own subpath rather than
reaching past it into vanilla:

```svelte
<script lang="ts">
import { Graph } from '@opendata-ai/openchart-svelte';
import { onMount } from 'svelte';

let { spec } = $props();
let ready = $state(false);

// Client-side only: 3d-force-graph touches `window` at import time.
onMount(async () => {
  await import('@opendata-ai/openchart-svelte/graph-3d');
  ready = true;
});
</script>

{#if ready}
  <Graph spec={{ ...spec, dimensions: 3 }} />
{/if}
```

The subpath import is required only when compilation actually resolves to 3D: a
spec above the 2000-node gate falls back to 2D and renders without it. See the
[vanilla README](../vanilla/README.md#3d-graphs) for how 3D differs from 2D.

## Dark mode and theming

Wrap components with `VizThemeProvider` to set theme and dark mode for all child visualizations. It uses Svelte's context API, so all `Chart`, `DataTable`, and `Graph` components inside the provider inherit its values.

```svelte
<script lang="ts">
import { VizThemeProvider, Chart } from '@opendata-ai/openchart-svelte';
</script>

<VizThemeProvider theme={myTheme} darkMode="auto">
  <Chart spec={spec1} />
  <Chart spec={spec2} />
</VizThemeProvider>
```

`darkMode` accepts `"auto"` (follows system preference), `"force"` (always dark), or `"off"` (always light).

For one-off overrides, pass `darkMode` or `theme` directly on an individual component. Component-level props take priority over the provider.

## Composables

For lower-level control or custom rendering:

- `useChart(spec, options?)` - Returns `{ action, chart, layout }`. Use with `use:action` directive
- `useGraph(spec, options?)` - Returns `{ action, search, zoomToFit, ... }`. Use with `use:action`
- `useTable(spec, options?)` - Returns `{ action, table, layout }`. Use with `use:action` directive
- `useTableState(options?)` - Manages table sorting, pagination, and search state
- `useDarkMode(preference?)` - Resolves dark mode preference against system settings

Context helpers for reading provider values directly:

- `getVizTheme()` - Returns the theme from the nearest `VizThemeProvider`
- `getVizDarkMode()` - Returns the dark mode preference from the nearest provider
- `setVizTheme(getter)` - Sets theme context (used internally by `VizThemeProvider`)
- `setVizDarkMode(getter)` - Sets dark mode context (used internally by `VizThemeProvider`)
