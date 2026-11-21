---
title: "Vue"
description: "The Vue 3 components, their props, events and exposed methods, the composables, and how the components behave under server rendering."
section: api
order: 3
---

# Vue

`@opendata-ai/openchart-vue` wraps the [vanilla mount functions](./vanilla.md) in Vue 3 components. A component mounts its visualization in `onMounted`, calls `update()` when the spec changes, and destroys the instance on unmount. The package re-exports all of `@opendata-ai/openchart-core`, the engine's `compile*` and `validateSpec` functions, and the vanilla export functions, so an app needs only this import.

See it: [Frameworks](../integration-guide.md) shows the same chart in React, Vue, Svelte and vanilla JavaScript.

## Install

```bash
npm install @opendata-ai/openchart-vue
```

Vue 3.3 or later is a peer dependency. Import the stylesheet once, in your app's entry module:

```ts
import "@opendata-ai/openchart-vue/styles.css";
```

```vue
<script setup lang="ts">
import { Chart, type ChartSpec } from "@opendata-ai/openchart-vue";
defineProps<{ spec: ChartSpec }>();
</script>

<template>
  <Chart :spec="spec" style="height: 400px" />
</template>
```

## Components

| Component | Renders | Exposed through a template ref |
| --- | --- | --- |
| `Chart` | `ChartSpec` or `LayerSpec` | `getSelectedElement()`, `select(ref)`, `deselect()`, `instance` |
| `DataTable` | `TableSpec` | nothing |
| `Graph` | `GraphSpec` | search, selection, highlight and camera methods, `update(spec)`, `instance` |
| `Sankey` | `SankeySpec` | `instance` |
| `TileMap` | `TileMapSpec` | `instance` |
| `GeoMap` | `GeoMapSpec` | `instance` |
| `BarList` | `BarListSpec` | `instance` |
| `Visualization` | any `VizSpec`, routed to the component above by spec kind | nothing |
| `ChartStory` | a chart or map driven through scroll steps | `goTo(index)`, `instance` |
| `VizThemeProvider` | nothing; provides `theme` and `darkMode` to every component inside it | nothing |

Every component that renders a spec takes `spec`, `theme`, `darkMode`, `class` and `style`, except `ChartStory`, which takes `spec` but no `theme`, `darkMode`, `class` or `style` props. It ignores `VizThemeProvider`; pass its theme and dark mode through `mountOptions`. A component `theme` merges over the provider's theme, which merges over the spec's. A component `darkMode` replaces the provider's. `Visualization` emits no events; use the specific component when you need them.

### Chart props and events

Each handler in the [Events](./events.md#charteventhandlers) table is a kebab-case event on `<Chart>`: `@mark-click`, `@mark-hover`, `@mark-focus`, `@mark-leave`, `@legend-toggle`, `@highlight-change`, `@annotation-click`, `@reveal` and `@reader-change`. `onEdit`, `onSelect` and `onDeselect` are declared as props, because their presence picks the interaction mode, but you still bind them as `@edit`, `@select` and `@deselect`.

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
| `reader`, `readerSelection` | `false \| ReaderPresentationOptions`, selection | Reader pinning through `createReader`; changes arrive on `@reader-change`. |
| `class`, `style` | `string`, `string \| CSSProperties` | The wrapper `<div>`. |

### Other component props and events

| Component | Events | Other props |
| --- | --- | --- |
| `DataTable` | `@row-click`, `@update:sort`, `@update:search`, `@update:page` | `sort`, `search`, `page`, so `v-model:sort` works; see [Table state](./table-state.md) |
| `Graph` | `@node-click`, `@node-double-click`, `@node-hover`, `@edge-hover`, `@selection-change`, `@legend-hover`, `@legend-toggle`, `@highlight-change`, `@camera-change` | `tooltip`, `legend`, `fitOnLoad`, `initialZoom`; see [Graph props](./graph-spec.md#graph-props) |
| `Sankey` | `@node-click`, `@link-click`, `@node-hover`, `@link-hover` | none |
| `TileMap` | `@tile-click`, `@tile-hover` | none |
| `GeoMap` | `@mark-click`, `@mark-hover`, `@camera-change`, `@reader-change` | `reader`, `readerSelection`, `labelInventory` |
| `BarList` | `@row-click`, `@row-hover` | none |
| `ChartStory` | none | `spec` (required; a chart, layer or map spec), `steps`, `narrative` (or the default slot, one root node per step), `step`, `triggerPosition`, `cameraMode`, `mountOptions` (theme and dark mode go here; the provider is ignored) |

## Composables

| Composable | Returns | Use |
| --- | --- | --- |
| `useChart(spec, options?)` | `{ containerRef, chart, layout }` | Mount a chart into your own element. `spec` is a `Ref`; bind `ref="containerRef"`. `options` takes `theme`, `darkMode`, `autoResize` and `renderer`. |
| `useTable(spec, options?)` | `{ containerRef, table, state }` | Mount a table into your own element. `spec` is a `Ref<TableSpec>`; `options` is `TableMountOptions`. |
| `useTableState(initial?)` | `{ sort, setSort, search, setSearch, page, setPage, resetState }` | State for a controlled `DataTable`. `sort`, `search` and `page` are refs. |
| `useGraph()` | `{ graphRef, search, clearSearch, zoomToFit, zoomToNode, selectNode, ... }` | Imperative graph control. Bind `ref="graphRef"` on `<Graph>`. See [useGraph](./graph-spec.md#usegraph-hookcomposable). |
| `useDarkMode(mode)` | `Ref<boolean>` | Resolves a `Ref` of `'auto'`, `'force'` or `'off'`, following the system setting for `'auto'`. |
| `useVizTheme()` | `ComputedRef<ThemeConfig \| undefined>` | The nearest `VizThemeProvider` theme. |
| `useVizDarkMode()` | `ComputedRef<DarkMode \| undefined>` | The nearest `VizThemeProvider` dark mode. |

`VizThemeKey` and `VizDarkModeKey` are the injection keys the provider uses, for code that calls `provide` itself.

## Server rendering

The components draw nothing on the server. Rendering `<Chart :spec="spec" />` with `vue/server-renderer` returns `<div class="oc-chart-root" style=""></div>`, and the chart mounts in the browser after hydration, so give the container a height to keep the layout from shifting.

To put the chart itself in the server HTML, render it with `renderStaticSVG` from `@opendata-ai/openchart-vanilla/static`; see [static rendering](../static-rendering.md).

The 3D graph subpath, `@opendata-ai/openchart-vue/graph-3d`, touches `window` when imported. Import it in the browser only, for example with a dynamic `import()` in `onMounted`.

## Related

- [Events](./events.md): every handler, its payload and its spelling in each framework.
