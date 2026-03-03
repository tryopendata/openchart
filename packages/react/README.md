# @opendata-ai/openchart-react

React components for OpenChart. Renders chart specs as SVG and table specs as DOM, with full React lifecycle management.

## Install

```bash
npm install @opendata-ai/openchart-react @opendata-ai/openchart-core
```

## Quick start

```tsx
import { Chart } from '@opendata-ai/openchart-react';
import { lineChart } from '@opendata-ai/openchart-core';

const data = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 150 },
  { date: '2024-03', value: 130 },
];

const spec = lineChart(data, 'date', 'value');

function App() {
  return <Chart spec={spec} />;
}
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

The recommended entry point when you're rendering arbitrary `VizSpec` values and don't know the type ahead of time. It inspects the spec and routes to `Chart`, `DataTable`, or `Graph` automatically.

```tsx
import { Visualization } from '@opendata-ai/openchart-react';
import type { VizSpec } from '@opendata-ai/openchart-core';

function RenderSpec({ spec }: { spec: VizSpec }) {
  // Renders Chart, DataTable, or Graph based on spec.type
  return <Visualization spec={spec} />;
}
```

If you need event handlers or component-specific props, use the specific component directly instead.

## Dark mode and theming

Wrap your app (or a subtree) with `VizThemeProvider` to set theme and dark mode for all child visualizations. All `Chart`, `DataTable`, and `Graph` components inside the provider inherit its values.

```tsx
import { VizThemeProvider, Chart } from '@opendata-ai/openchart-react';

function Dashboard({ specs }) {
  return (
    <VizThemeProvider theme={myTheme} darkMode="auto">
      <Chart spec={specs[0]} />
      <Chart spec={specs[1]} />
    </VizThemeProvider>
  );
}
```

`darkMode` accepts `"auto"` (follows system preference), `"force"` (always dark), or `"off"` (always light).

For one-off overrides, pass `darkMode` or `theme` directly on an individual component. Component-level props take priority over the provider.

```tsx
<VizThemeProvider theme={defaultTheme} darkMode="auto">
  <Chart spec={spec1} />
  {/* This one stays light regardless of system preference */}
  <Chart spec={spec2} darkMode="off" />
</VizThemeProvider>
```

## Hooks

For lower-level control or custom rendering, these hooks give you direct access to the compilation and rendering pipeline:

- `useChart(spec, options?)` - Returns `{ ref, chart, layout }`. Attach `ref` to a container div
- `useGraph()` - Returns `{ ref, search, zoomToFit, ... }`. Pair with `<Graph ref={ref} />`
- `useTable(spec, options?)` - Returns `{ ref, table, layout }`. Attach `ref` to a container div
- `useTableState(options?)` - Manages table sorting, pagination, and search state
- `useDarkMode(preference?)` - Resolves dark mode preference against system settings
