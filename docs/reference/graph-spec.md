---
title: "GraphSpec"
description: "GraphSpec fields for network charts, plus the Graph component, its props and its interaction model."
section: spec
order: 12
---

# GraphSpec

A `GraphSpec` (`type: 'graph'`) draws a network of nodes and edges on canvas, positioned by a force simulation. It takes `nodes` and `edges` arrays instead of `data`, and renders through `<Graph>` or `createGraph`, not `<Chart>`.

See it: [Graph](/docs/flow/graph/).

## GraphSpec

Input for network/relationship visualizations. Source: `core/src/types/spec.ts`.

Graphs render force-directed network visualizations on canvas. They support node interaction (click, drag, double-click), search, zoom/pan, keyboard navigation, and selection. Nodes are positioned by a force simulation running in a web worker.

| Field            | Type                             | Default     | Description                                                                           |
| ---------------- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `type`           | `'graph'`                        | (required)  | Discriminant.                                                                         |
| `nodes`          | `GraphNode[]`                    | (required)  | Node array. Each node must have an `id: string` field plus arbitrary data fields.     |
| `edges`          | `GraphEdge[]`                    | (required)  | Edge array. Each edge has `source: string` and `target: string` referencing node ids. |
| `encoding`       | `GraphEncoding`                  | `undefined` | Visual property mappings for nodes/edges.                                             |
| `layout`         | `GraphLayoutConfig`              | `undefined` | Layout algorithm configuration.                                                       |
| `nodeOverrides`  | `Record<string, NodeOverride>`   | `undefined` | Per-node visual overrides keyed by node id. See [NodeOverride](#nodeoverride).        |
| `seedNode`       | `string \| { id, style? }`       | `undefined` | The graph's seed/root node: gets a ring and an always-on label, and stays lit when a category highlight or filter dims the rest. `style` is a `NodeOverride` that layers under any `nodeOverrides` entry for the same id. An unknown id warns and is ignored. Unrelated to `layout.seed`. |
| `chrome`         | `Chrome`                         | `undefined` | Editorial text.                                                                       |
| `annotations`    | `Annotation[]`                   | `undefined` | Annotations.                                                                          |
| `theme`          | `ThemeConfig`                    | `undefined` | Theme overrides.                                                                      |
| `watermark`      | `boolean`                        | `true`      | Whether to show the tryOpenData.ai watermark. Mount/compile options take precedence over spec and active breakpoint values. |

### GraphEncoding

Each channel is a `GraphEncodingChannel` with `field`, optional `type`, and optional `scale` (same `ScaleConfig` as chart encodings). When `scale.domain` and `scale.range` are provided, the engine uses them directly instead of auto-deriving from the data. This is useful for controlling deterministic color assignment. `scale.scheme` is not read by the graph compile path and fails validation; use `scale.range` for explicit colors.

| Channel     | Field type constraint          | Purpose                                  |
| ----------- | ------------------------------ | ---------------------------------------- |
| `nodeColor` | nominal, ordinal, quantitative | Color mapping for nodes.                 |
| `nodeSize`  | quantitative                   | Size mapping for nodes (3-12px radius).  |
| `nodeOpacity` | quantitative                 | Fill opacity for nodes (0.25-1).         |
| `edgeColor` | nominal, ordinal, quantitative | Color mapping for edges.                 |
| `edgeWidth` | quantitative                   | Width mapping for edges (0.5-4px).       |
| `edgeStyle` | nominal, ordinal               | Line style mapping (solid/dashed/dotted).|
| `nodeLabel` | any                            | Label field for nodes.                   |
| `nodeLabelPriority` | quantitative           | Which labels survive thinning (0-1). Defaults to node degree when unset; `nodeOverrides[id].alwaysShowLabel` still hard-pins above it. |

When `nodeColor` encoding is set, it takes precedence over community-based coloring from `layout.clustering`. Community assignment still affects spatial grouping, but colors are driven by the encoding.

### NodeOverride

Per-node visual overrides. Useful for highlighting seed nodes, selected nodes, or applying custom styling to specific nodes.

| Field            | Type      | Description                                        |
| ---------------- | --------- | -------------------------------------------------- |
| `fill`           | `string`  | Override fill color.                               |
| `radius`         | `number`  | Override node radius.                              |
| `strokeWidth`    | `number`  | Override stroke width.                             |
| `stroke`         | `string`  | Override stroke color.                             |
| `alwaysShowLabel` | `boolean` | Force label to always show regardless of zoom/priority. |

### GraphLayoutConfig

| Field              | Type                                    | Default         | Description                                             |
| ------------------ | --------------------------------------- | --------------- | ------------------------------------------------------- |
| `type`             | `'force' \| 'radial' \| 'hierarchical'` | (required)      | Layout algorithm.                                       |
| `clustering`       | `{ field: string }`                     | `undefined`     | Group nodes by a field for cluster forces.              |
| `chargeStrength`   | `number`                                | library default | Charge strength for force layout. Negative = repulsion. |
| `linkDistance`      | `number`                                | library default | Target distance between linked nodes.                   |
| `collisionPadding` | `number`                                | `2`             | Extra pixels added to node radius for collision detection. |
| `linkStrength`     | `number`                                | `undefined`     | Link force strength override.                           |
| `centerForce`      | `boolean`                               | `true`          | Whether to apply center force to keep graph centered.   |

---

## Graph visualization

Graphs render force-directed network visualizations on canvas. The input is a `GraphSpec` with `nodes` and `edges` instead of `data` and `encoding`. See the [graphs guide](../graphs.md) for layout and encoding details, and the [spec reference](#graphspec-1) for the full type definition. Live examples: [basic](https://tryopendata.github.io/openchart/?story=graphs--graphs#basic), [search](https://tryopendata.github.io/openchart/?story=graphs--graphs#search)

### React

```tsx
import { Graph } from "@opendata-ai/openchart-react";

<Graph
  spec={graphSpec}
  theme={theme}
  darkMode="auto"
  onNodeClick={(node) => console.log("Clicked:", node)}
  onNodeDoubleClick={(node) => console.log("Double-clicked:", node)}
  onSelectionChange={(nodeIds) => console.log("Selected:", nodeIds)}
  style={{ width: "100%", height: 500 }}
/>;
```

### Vue

```vue
<script setup lang="ts">
import { Graph } from "@opendata-ai/openchart-vue";
</script>

<template>
  <Graph
    :spec="graphSpec"
    :theme="theme"
    dark-mode="auto"
    @node-click="(node) => console.log('Clicked:', node)"
    @node-double-click="(node) => console.log('Double-clicked:', node)"
    @selection-change="(nodeIds) => console.log('Selected:', nodeIds)"
    style="width: 100%; height: 500px"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
import { Graph } from "@opendata-ai/openchart-svelte";
</script>

<Graph
  spec={graphSpec}
  theme={theme}
  darkMode="auto"
  onnodeclick={(node) => console.log("Clicked:", node)}
  onnodedoubleclick={(node) => console.log("Double-clicked:", node)}
  onselectionchange={(nodeIds) => console.log("Selected:", nodeIds)}
  style="width: 100%; height: 500px"
/>
```

### Graph props

| Prop                | Type                                      | Description                                 |
| ------------------- | ----------------------------------------- | ------------------------------------------- |
| `spec`              | `GraphSpec`                               | The graph spec. Required.                   |
| `theme`             | `ThemeConfig`                             | Theme overrides.                            |
| `darkMode`          | `DarkMode`                                | Dark mode: `'auto'`, `'force'`, or `'off'`. |
| `onNodeClick`       | `(node: Record<string, unknown>) => void` | Fires when a node is clicked.               |
| `onNodeDoubleClick` | `(node: Record<string, unknown>) => void` | Fires when a node is double-clicked.        |
| `onSelectionChange` | `(nodeIds: string[]) => void`             | Fires when the selected nodes change.       |

### useGraph hook/composable

For imperative control over the graph (search, zoom, selection), each framework provides a hook/composable:

**React:**

```tsx
import { Graph, useGraph } from "@opendata-ai/openchart-react";

function SearchableGraph({ spec }: { spec: GraphSpec }) {
  const { ref, search, clearSearch, zoomToFit, zoomToNode, selectNode } =
    useGraph();

  return (
    <div>
      <input
        onChange={(e) => search(e.target.value)}
        placeholder="Search nodes..."
      />
      <button onClick={zoomToFit}>Fit all</button>
      <button onClick={clearSearch}>Clear search</button>
      <div style={{ width: "100%", height: 500 }}>
        <Graph ref={ref} spec={spec} />
      </div>
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { Graph, useGraph } from "@opendata-ai/openchart-vue";

const { graphRef, search, clearSearch, zoomToFit } = useGraph();
</script>

<template>
  <input @input="(e) => search(e.target.value)" placeholder="Search nodes..." />
  <button @click="zoomToFit">Fit all</button>
  <div style="width: 100%; height: 500px">
    <Graph ref="graphRef" :spec="spec" />
  </div>
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { Graph, useGraph } from "@opendata-ai/openchart-svelte";

const { action, search, clearSearch, zoomToFit } = useGraph(() => spec);
</script>

<input oninput={(e) => search(e.target.value)} placeholder="Search nodes..." />
<button onclick={zoomToFit}>Fit all</button>
<div style="width: 100%; height: 500px" use:action>
</div>
```

All frameworks return the same control methods:

| Property             | Type               | Description                         |
| -------------------- | ------------------ | ----------------------------------- |
| `ref`                | `RefObject`        | Pass to `<Graph ref={ref}>`.        |
| `search(query)`      | `(string) => void` | Highlight nodes matching the query. |
| `clearSearch()`      | `() => void`       | Clear search highlights.            |
| `zoomToFit()`        | `() => void`       | Fit all nodes in the viewport.      |
| `zoomToNode(id)`     | `(string) => void` | Center and zoom to a specific node. |
| `selectNode(id)`     | `(string) => void` | Programmatically select a node.     |
| `getSelectedNodes()` | `() => string[]`   | Get currently selected node IDs.    |

### Vanilla

```ts
import { createGraph } from "@opendata-ai/openchart-vanilla";

const graph = createGraph(container, graphSpec, {
  darkMode: "auto",
  autoResize: true,
  onNodeClick: (node) => console.log("Clicked:", node),
  onNodeDoubleClick: (node) => console.log("Double-clicked:", node),
  onSelectionChange: (nodeIds) => console.log("Selected:", nodeIds),
});

// Imperative control
graph.search("alice");
graph.clearSearch();
graph.zoomToFit();
graph.zoomToNode("node-42");
graph.selectNode("node-42");
console.log(graph.getSelectedNodes());

// Update with new spec
graph.update(newGraphSpec);

// Clean up
graph.destroy();
```

`createGraph` returns a `GraphInstance` with these methods:

| Method               | What it does                                                 |
| -------------------- | ------------------------------------------------------------ |
| `update(spec)`       | Recompile and re-render with a new spec.                     |
| `search(query)`      | Highlight nodes matching the query string.                   |
| `clearSearch()`      | Clear search highlights.                                     |
| `zoomToFit()`        | Fit all nodes in the viewport.                               |
| `zoomToNode(id)`     | Center and zoom to a specific node.                          |
| `selectNode(id)`     | Programmatically select a node.                              |
| `getSelectedNodes()` | Get currently selected node IDs.                             |
| `resize()`           | Manually trigger resize (usually handled by ResizeObserver). |
| `destroy()`          | Remove DOM, stop simulation, disconnect observers.           |

### Graph interaction model

Nodes support click, drag, and double-click. Dragging a node pins it in place temporarily; when released, the simulation takes over again. Multi-select isn't built in (each click selects one node), but you can track selections via `onSelectionChange`.

The force simulation runs in a web worker to keep the main thread responsive. Nodes auto-fit to the viewport once the simulation settles.
