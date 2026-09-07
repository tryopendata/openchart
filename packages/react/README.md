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

## 3D graphs

`dimensions: 3` on a graph spec renders with WebGL instead of canvas. The 3D
renderer ships on its own subpath so three.js never lands in the default bundle,
and its libraries are optional peers you install yourself:

```bash
npm install three 3d-force-graph three-spritetext
```

The subpath registers the renderer as an import side effect, so it has to be
imported before the graph mounts. Every framework package ships its own mirror
of it (`@opendata-ai/openchart-vue/graph-3d`,
`@opendata-ai/openchart-svelte/graph-3d`), so you never reach past the package
you depend on; everything else is identical.

```tsx
import { Graph } from '@opendata-ai/openchart-react';

function Graph3D({ spec }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    import('@opendata-ai/openchart-react/graph-3d').then(() => setReady(true));
  }, []);

  if (!ready) return <Spinner />;
  return <Graph spec={{ ...spec, dimensions: 3 }} />;
}
```

The subpath import is required only when compilation actually resolves to 3D.
A spec above the 2000-node gate warns and falls back to 2D, so it renders
without the import; a `dimensions: 3` spec that stays 3D throws without it.

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
