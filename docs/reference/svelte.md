---
title: "Svelte"
description: "The Svelte 5 components, their callback props and exported methods, the composables, and how the components behave under server rendering."
section: api
order: 4
---

# Svelte

`@opendata-ai/openchart-svelte` wraps the [vanilla mount functions](./vanilla.md) in Svelte 5 components. A component mounts its visualization in an effect, calls `update()` when the spec changes, and destroys the instance when it is removed. The package re-exports all of `@opendata-ai/openchart-core`, the engine's `compile*` and `validateSpec` functions, and the vanilla export functions, so an app needs only this import.

See it: [Frameworks](../integration-guide.md) shows the same chart in React, Vue, Svelte and vanilla JavaScript.

## Install

```bash
npm install @opendata-ai/openchart-svelte
```

Svelte 5 is a peer dependency; the components use runes and don't run on Svelte 4. Import the stylesheet once, in your root layout or entry module:

```ts
import "@opendata-ai/openchart-svelte/styles.css";
```

```svelte
<script lang="ts">
import { Chart, type ChartSpec } from "@opendata-ai/openchart-svelte";
let { spec }: { spec: ChartSpec } = $props();
</script>

<Chart {spec} style="height: 400px" />
```

## Components

| Component | Renders | Exported methods (through `bind:this`) |
| --- | --- | --- |
| `Chart` | `ChartSpec` or `LayerSpec` | `getSelectedElement()`, `select(ref)`, `deselect()`, `getInstance()` |
| `DataTable` | `TableSpec` | none |
| `Graph` | `GraphSpec` | search, selection, highlight and camera methods, and `update(spec)` |
| `Sankey` | `SankeySpec` | none |
| `TileMap` | `TileMapSpec` | none |
| `GeoMap` | `GeoMapSpec` | `getInstance()` |
| `BarList` | `BarListSpec` | none |
| `Visualization` | any `VizSpec`, routed to the component above by spec kind | none |
| `ChartStory` | a chart or map driven through scroll steps | `goTo(index)`, `getInstance()` |
| `VizThemeProvider` | its `children` snippet, with `theme` and `darkMode` set for every component inside | none |

Every component that renders a spec takes `spec`, `theme`, `darkMode`, `class` and `style`, except `ChartStory`, which takes `spec` and `class` but no `theme`, `darkMode` or `style`. It ignores `VizThemeProvider`; pass its theme and dark mode through `mountOptions`. A component `theme` merges over the provider's theme, which merges over the spec's. A component `darkMode` replaces the provider's. `Visualization` takes no callbacks; use the specific component when you need them.

### Chart props

Event handlers are lowercase callback props: `onmarkclick`, `onmarkhover`, `onmarkfocus`, `onmarkleave`, `onlegendtoggle`, `onhighlightchange`, `onannotationclick`, `onselect`, `ondeselect`, `onedit`, `onreveal` and `onreaderchange`. Payloads match the [Events](./events.md#charteventhandlers) table. A camelCase name such as `onMarkClick` is not a prop, so Svelte ignores it.

The other props map onto [`MountOptions`](./vanilla.md#mountoptions) and the [`ChartInstance`](./vanilla.md#chartinstance) methods:

| Prop | Type | Maps to |
| --- | --- | --- |
| `spec` | `ChartSpec \| LayerSpec` | The mounted spec. A change calls `update()`. |
| `theme` | `ThemeConfig` | `MountOptions.theme`, merged over the provider theme. |
| `darkMode` | `'auto' \| 'force' \| 'off'` | `MountOptions.darkMode`. |
| `interaction` | `'read' \| 'select' \| 'edit'` | `MountOptions.interaction`. |
| `renderer` | `'auto' \| 'svg' \| 'canvas'` | `MountOptions.renderer`. |
| `autoResize` | `boolean` | `MountOptions.autoResize`. |
| `rowHover` | `boolean` | `MountOptions.rowHover`. |
| `revision` | `string \| number` | Stamped on emitted edit transactions. |
| `selectedElement` | `ElementRef` | Controlled selection. |
| `highlight` | `string[] \| null` | `chart.setHighlight()`. |
| `reader`, `readerSelection` | `false \| ReaderPresentationOptions`, selection | Reader pinning through `createReader`; changes arrive on `onreaderchange`. |
| `class`, `style` | `string` | The wrapper `<div>`. |

### Other component props

| Component | Callback props | Other props |
| --- | --- | --- |
| `DataTable` | `onrowclick`, `onsortchange`, `onsearchchange`, `onpagechange` | `sort`, `search`, `page` for a controlled table; see [Table state](./table-state.md) |
| `Graph` | `onnodeclick`, `onnodedoubleclick`, `onnodehover`, `onedgehover`, `onselectionchange`, `onlegendhover`, `onlegendtoggle`, `onhighlightchange`, `oncamerachange` | `tooltip`, `legend`, `fitOnLoad`, `initialZoom`; see [Graph props](./graph-spec.md#graph-props) |
| `Sankey` | `onnodeclick`, `onlinkclick`, `onnodehover`, `onlinkhover` | none |
| `TileMap` | `ontileclick`, `ontilehover` | none |
| `GeoMap` | `onmarkclick`, `onmarkhover`, `oncamerachange`, `onreaderchange` | `reader`, `readerSelection`, `labelInventory` |
| `BarList` | `onrowclick`, `onrowhover` | none |
| `ChartStory` | none | `spec` (required; a chart, layer or map spec), `steps`, `narrative` (an array of snippets, one per step), `step`, `triggerPosition`, `cameraMode`, `mountOptions` (theme and dark mode go here; the provider is ignored), `class` |

## Composables

The composables take getter functions, so they re-run when the state they read changes. The mount composables return an action for `use:action` on your own element.

`chart`, `layout`, `table` and `state` on the returned object, like `sort`, `search` and `page` from `useTableState`, are getters. Destructuring copies their value at that moment and loses reactivity, so keep the object:

```svelte
<script lang="ts">
import { useChart } from "@opendata-ai/openchart-svelte";
let { spec } = $props();
const c = useChart(() => spec);
</script>

<div use:c.action style="height: 400px"></div>
<button onclick={() => c.chart?.export("svg")}>Export SVG</button>
```

| Composable | Returns | Use |
| --- | --- | --- |
| `useChart(() => spec, () => options)` | `{ action, chart, layout }` | Mount a chart with `<div use:c.action>`. Options take `theme`, `darkMode`, `autoResize` and `renderer`. |
| `useTable(() => spec, () => options)` | `{ action, table, state }` | Mount a table. Options are `TableMountOptions`; `state` tracks sort, search and page. |
| `useTableState(initial?)` | `{ sort, setSort, search, setSearch, page, setPage, resetState }` | State for a controlled `DataTable`. |
| `useGraph(() => spec, () => options)` | `{ action, search, clearSearch, zoomToFit, zoomToNode, selectNode, ... }` | Mount a graph with `use:action` and control it. Options take the `Graph` props and callbacks in camelCase (`onNodeClick`), plus `autoResize`. See [useGraph](./graph-spec.md#usegraph-hookcomposable). |
| `useDarkMode(() => mode)` | `{ isDark }` | Resolves `'auto'`, `'force'` or `'off'`, following the system setting for `'auto'`. |

`setVizTheme`, `setVizDarkMode`, `getVizTheme` and `getVizDarkMode` read and write the context `VizThemeProvider` uses. Each takes or returns a getter.

## Server rendering

The components draw nothing on the server: the chart mounts in an effect, and Svelte doesn't run effects during server rendering. SvelteKit sends the empty wrapper `<div>` and the chart draws after hydration, so give the container a height to keep the layout from shifting.

To put the chart itself in the server HTML, render it in a `+page.server.ts` load function with `renderStaticSVG` from `@opendata-ai/openchart-vanilla/static`, and output the string with `{@html svg}`; see [static rendering](../static-rendering.md).

The 3D graph subpath, `@opendata-ai/openchart-svelte/graph-3d`, touches `window` when imported. Import it in the browser only, for example with a dynamic `import()` in `onMount`.

## Related

- [Events](./events.md): every handler, its payload and its spelling in each framework.
