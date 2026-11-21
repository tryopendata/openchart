---
title: "React"
description: "The React components, their props and handles, the hooks, and how the components behave under server rendering."
section: api
order: 2
---

# React

`@opendata-ai/openchart-react` wraps the [vanilla mount functions](./vanilla.md) in React components. A component mounts its visualization in an effect after the first render, calls `update()` when the spec changes, and destroys the instance on unmount. The package re-exports all of `@opendata-ai/openchart-core`, the engine's `compile*` and `validateSpec` functions, and the vanilla export functions, so an app needs only this import.

See it: [Frameworks](../integration-guide.md) shows the same chart in React, Vue, Svelte and vanilla JavaScript.

## Install

```bash
npm install @opendata-ai/openchart-react
```

React 18 or later is a peer dependency. Import the stylesheet once, in your app's entry module:

```ts
import "@opendata-ai/openchart-react/styles.css";
```

```tsx
import { Chart, type ChartSpec } from "@opendata-ai/openchart-react";

export function Inflation({ spec }: { spec: ChartSpec }) {
  return <Chart spec={spec} style={{ height: 400 }} />;
}
```

## Components

| Component | Renders | Ref handle |
| --- | --- | --- |
| `Chart` | `ChartSpec` or `LayerSpec` | `ChartHandle` |
| `DataTable` | `TableSpec` | none |
| `Graph` | `GraphSpec` | `GraphHandle` |
| `Sankey` | `SankeySpec` | `SankeyHandle` |
| `TileMap` | `TileMapSpec` | `TileMapHandle` |
| `GeoMap` | `GeoMapSpec` | `GeoMapHandle` |
| `BarList` | `BarListSpec` | `BarListHandle` |
| `Visualization` | any `VizSpec`, routed to the component above by spec kind | none |
| `ChartStory` | a chart or map driven through scroll steps | `ChartStoryHandle` |
| `VizThemeProvider` | nothing; supplies `theme` and `darkMode` to every component inside it | none |

Every component that renders a spec takes `spec`, `theme`, `darkMode`, `className` and `style`, except `ChartStory`, which takes `spec`, `className` and `style` but not `theme` or `darkMode`. It ignores `VizThemeProvider`; pass its theme and dark mode through `mountOptions`. A component `theme` merges over the provider's theme, which merges over the spec's. A component `darkMode` replaces the provider's. `Visualization` takes no event handlers; use the specific component when you need them.

### Chart props

`ChartProps` extends `ChartEventHandlers`, so every handler in the [Events](./events.md#charteventhandlers) table is a prop with the same name (`onMarkClick`, `onEdit`). The other props map onto [`MountOptions`](./vanilla.md#mountoptions) and the [`ChartInstance`](./vanilla.md#chartinstance) methods:

| Prop | Type | Maps to |
| --- | --- | --- |
| `spec` | `ChartSpec \| LayerSpec` | The mounted spec. A change calls `update()`. |
| `theme` | `ThemeConfig` | `MountOptions.theme`, merged over the provider theme. |
| `darkMode` | `'auto' \| 'force' \| 'off'` | `MountOptions.darkMode`. |
| `interaction` | `'read' \| 'select' \| 'edit'` | `MountOptions.interaction`. A change recreates the chart. |
| `renderer` | `'auto' \| 'svg' \| 'canvas'` | `MountOptions.renderer`. |
| `autoResize` | `boolean` | `MountOptions.autoResize`. |
| `rowHover` | `boolean` | `MountOptions.rowHover`. |
| `revision` | `string \| number` | Stamped on emitted edit transactions. |
| `selectedElement` | `ElementRef` | Controlled selection. |
| `highlight` | `string[] \| null` | `chart.setHighlight()`. |
| `reader`, `readerSelection`, `onReaderChange` | see `ChartReaderProps` | Reader pinning through `createReader`; `reader: { mode: 'slices' }` pins slices. |
| `className`, `style` | `string`, `CSSProperties` | The wrapper `<div>`. |

A change to `theme` (its own or the provider's), `darkMode`, `renderer`, `interaction`, `rowHover` or `autoResize` destroys and recreates the chart, and so does adding or removing an `onEdit`, `onSelect` or `onDeselect` handler. Other handler changes don't. With `interaction` omitted, the mode is inferred from those three handlers: `onEdit` gives `'edit'`, `onSelect` or `onDeselect` gives `'select'`, and none gives `'read'`.

`ChartHandle`, from a `ref` on `<Chart>`, has `getSelectedElement()`, `select(ref)`, `deselect()` and `instance`, the underlying `ChartInstance` (`null` until mounted).

### Other component props

| Component | Event props | Other props |
| --- | --- | --- |
| `DataTable` | `onRowClick`, `onSortChange`, `onSearchChange`, `onPageChange` | `sort`, `search`, `page` for a controlled table; see [Table state](./table-state.md) |
| `Graph` | `onNodeClick`, `onNodeDoubleClick`, `onNodeHover`, `onEdgeHover`, `onSelectionChange`, `onLegendHover`, `onLegendToggle`, `onHighlightChange`, `onCameraChange` | `tooltip`, `legend`, `fitOnLoad`, `initialZoom`; see [Graph props](./graph-spec.md#graph-props) |
| `Sankey` | `onNodeClick`, `onLinkClick`, `onNodeHover`, `onLinkHover` | none |
| `TileMap` | `onTileClick`, `onTileHover` | none |
| `GeoMap` | `onMarkClick`, `onMarkHover`, `onCameraChange` | `reader`, `readerSelection`, `onReaderChange`, `labelInventory` |
| `BarList` | `onRowClick`, `onRowHover` | none |
| `ChartStory` | none | `spec` (required; a chart, layer or map spec), `steps`, `narrative` (one React node per step), `step` (drives it from outside), `triggerPosition` (default `0.4`), `cameraMode` (`'step'` or `'scrub'`), `mountOptions` (theme, dark mode and the other mount options), `className`, `style` |

The `Sankey`, `TileMap`, `GeoMap` and `BarList` handles expose `instance`. `GraphHandle` has the graph's search, selection, highlight and camera methods, plus `update(spec)` and `instance`. `ChartStoryHandle` has `goTo(index)` and `instance`.

## Hooks

| Hook | Returns | Use |
| --- | --- | --- |
| `useChart(spec, options?)` | `{ ref, chart, layout }` | Mount a chart into your own `<div ref={ref}>`. `options` takes `theme`, `darkMode`, `autoResize` and `renderer`. |
| `useTable(spec, options?)` | `{ ref, table, state }` | Mount a table into your own element. `options` is `TableMountOptions`; `state` tracks sort, search and page. |
| `useTableState(initial?)` | `{ sort, setSort, search, setSearch, page, setPage, resetState }` | State for a controlled `DataTable`. |
| `useGraph()` | `{ ref, search, clearSearch, zoomToFit, zoomToNode, selectNode, ... }` | Imperative graph control. Pass `ref` to `<Graph ref={ref}>`. See [useGraph](./graph-spec.md#usegraph-hookcomposable). |
| `useDarkMode(mode?)` | `boolean` | Resolves `'auto'`, `'force'` or `'off'` to dark or not, following the system setting for `'auto'`. |
| `useVizTheme()` | `ThemeConfig \| undefined` | The nearest `VizThemeProvider` theme. |
| `useVizDarkMode()` | `DarkMode \| undefined` | The nearest `VizThemeProvider` dark mode. |

## Server rendering

The components draw nothing on the server. `renderToString(<Chart spec={spec} />)` returns `<div class="oc-chart-root"></div>`, and the chart mounts in the browser after hydration, so give the container a height to keep the layout from shifting.

The components use hooks and the package has no `"use client"` directive. In the Next.js App Router, render them from a Client Component.

To put the chart itself in the server HTML, render it with `renderStaticSVG` from `@opendata-ai/openchart-vanilla/static`; see [static rendering](../static-rendering.md).

The 3D graph subpath, `@opendata-ai/openchart-react/graph-3d`, touches `window` when imported. Import it in the browser only, for example with a dynamic `import()` inside `useEffect`.

## Related

- [Events](./events.md): every handler, its payload and its spelling in each framework.
