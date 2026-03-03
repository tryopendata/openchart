# @opendata-ai/openchart-vue

Vue 3 components for OpenChart. Renders chart specs as SVG and table specs as DOM, with Vue reactivity and lifecycle management.

## Install

```bash
npm install @opendata-ai/openchart-vue @opendata-ai/openchart-core
```

## Quick start

```vue
<script setup lang="ts">
import { Chart } from '@opendata-ai/openchart-vue';
import { lineChart } from '@opendata-ai/openchart-core';

const data = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 150 },
  { date: '2024-03', value: 130 },
];

const spec = lineChart(data, 'date', 'value');
</script>

<template>
  <Chart :spec="spec" />
</template>
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

```vue
<script setup lang="ts">
import { Visualization } from '@opendata-ai/openchart-vue';
import type { VizSpec } from '@opendata-ai/openchart-core';

const props = defineProps<{ spec: VizSpec }>();
</script>

<template>
  <!-- Renders Chart, DataTable, or Graph based on spec.type -->
  <Visualization :spec="props.spec" />
</template>
```

If you need event handlers or component-specific props, use the specific component directly instead.

## Dark mode and theming

Wrap components with `VizThemeProvider` to set theme and dark mode for all child visualizations. It uses Vue's `provide`/`inject` under the hood, so all `Chart`, `DataTable`, and `Graph` components inside the provider inherit its values.

```vue
<script setup lang="ts">
import { VizThemeProvider, Chart } from '@opendata-ai/openchart-vue';
</script>

<template>
  <VizThemeProvider :theme="myTheme" dark-mode="auto">
    <Chart :spec="spec1" />
    <Chart :spec="spec2" />
  </VizThemeProvider>
</template>
```

`darkMode` accepts `"auto"` (follows system preference), `"force"` (always dark), or `"off"` (always light).

For one-off overrides, pass `dark-mode` or `theme` directly on an individual component. Component-level props take priority over the provider.

## Composables

For lower-level control or custom rendering:

- `useChart(spec, options?)` - Returns `{ containerRef, chart, layout }`. Bind `containerRef` via `ref`
- `useGraph()` - Returns `{ componentRef, search, zoomToFit, ... }`. Bind to `<Graph>` via `ref`
- `useTable(spec, options?)` - Returns `{ containerRef, table, layout }`. Bind `containerRef` via `ref`
- `useTableState(options?)` - Manages table sorting, pagination, and search state
- `useDarkMode(preference?)` - Resolves dark mode preference against system settings

Context composables for reading provider values directly:

- `useVizTheme()` - Returns the theme from the nearest `VizThemeProvider`
- `useVizDarkMode()` - Returns the dark mode preference from the nearest provider
