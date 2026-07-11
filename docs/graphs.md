# Graphs

Force-directed network visualizations with community detection, visual encoding, search, and interactive navigation. Graphs use the `GraphSpec` type and render through the `<Graph>` component (or `createGraph` in vanilla JS).

## Quick start

```tsx
import { Graph } from "@opendata-ai/openchart-react";

const spec = {
  type: "graph",
  nodes: [
    { id: "a", label: "Alice" },
    { id: "b", label: "Bob" },
    { id: "c", label: "Carol" },
    { id: "d", label: "Dave" },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "a", target: "c" },
    { source: "b", target: "d" },
    { source: "c", target: "d" },
  ],
  layout: { type: "force" },
};

<Graph spec={spec} />
```

For Vue, import from `@opendata-ai/openchart-vue`. For Svelte, import from `@opendata-ai/openchart-svelte`. For vanilla JS, use `createGraph(container, spec)` from `@opendata-ai/openchart-vanilla`.

**Live example**: [Basic graph](https://tryopendata.github.io/openchart/?story=graphs--graphs#basic)

---

## Layout algorithms

Set via `layout.type` on the spec.

### Force (default)

Nodes repel each other and edges pull connected nodes together. The simulation runs in a web worker for performance.

```ts
layout: {
  type: "force",
  chargeStrength: -120,  // repulsion (negative = push apart)
  linkDistance: 40,       // target distance between connected nodes
  collisionPadding: 2,   // extra pixels for collision detection
  centerForce: true,     // keep graph centered in container
}
```

### Radial

Nodes arranged in concentric rings around the center. Good for showing hierarchy or distance from a central node.

```ts
layout: { type: "radial" }
```

### Hierarchical

Tree layout with parent-child relationships. Good for org charts and dependency trees.

```ts
layout: { type: "hierarchical" }
```

---

## Encoding channels

Map data fields on nodes and edges to visual properties.

```ts
const spec = {
  type: "graph",
  nodes: [
    { id: "n1", label: "Item 1", weight: 80, type: "person" },
    { id: "n2", label: "Item 2", weight: 45, type: "org" },
    // ...
  ],
  edges: [
    { source: "n1", target: "n2", confidence: 0.9 },
    // ...
  ],
  encoding: {
    nodeSize: { field: "weight" },
    nodeColor: { field: "type" },
    edgeWidth: { field: "confidence" },
  },
};
```

| Channel     | Maps to          | Field type constraint          |
|-------------|------------------|-------------------------------|
| `nodeColor` | Node fill color  | nominal, ordinal, quantitative |
| `nodeSize`  | Node radius      | quantitative (3-12px range)    |
| `nodeLabel` | Node label text  | any                            |
| `edgeColor` | Edge stroke color| nominal, ordinal, quantitative |
| `edgeWidth` | Edge stroke width| quantitative (0.5-4px range)   |
| `edgeStyle` | Edge line style  | nominal, ordinal (solid/dashed/dotted) |

**Live example**: [Encoded graph](https://tryopendata.github.io/openchart/?story=graphs--graphs#encoded)

---

## Community detection and clustering

Group nodes spatially by a field. The layout applies cluster forces to pull nodes in the same group together.

```ts
layout: {
  type: "force",
  clustering: { field: "group" },
}
```

When `nodeColor` encoding is also set, colors come from the encoding (not from community assignment). Community assignment still affects spatial grouping.

**Live example**: [Community clusters](https://tryopendata.github.io/openchart/?story=graphs--graphs#communities)

---

## Node overrides

Apply per-node visual styling for highlighting specific nodes.

```ts
nodeOverrides: {
  "important-node": {
    fill: "#e63946",
    radius: 12,
    strokeWidth: 3,
    stroke: "#1d3557",
    alwaysShowLabel: true,
  },
},
```

---

## Interaction

Graphs support several built-in interaction modes:

- **Click**: Select a node
- **Drag**: Reposition a node (pins it in place)
- **Double-click**: Release a pinned node
- **Search**: Filter/highlight nodes by label
- **Zoom/pan**: Mouse wheel or pinch to zoom, drag background to pan
- **Keyboard navigation**: Tab through nodes, Enter to select

**Live examples**: [Search demo](https://tryopendata.github.io/openchart/?story=graphs--graphs#search) | [With chrome](https://tryopendata.github.io/openchart/?story=graphs--graphs#chrome)

---

## Chrome and theme

Graphs support the same `chrome` (title, subtitle, source, byline) and `theme` configuration as charts.

```ts
const spec = {
  type: "graph",
  nodes: [...],
  edges: [...],
  layout: { type: "force" },
  chrome: {
    title: "Research collaboration network",
    subtitle: "500 papers, colored by department",
    source: "Source: University records",
  },
  darkMode: "auto",
};
```

---

## Scale testing

The graph renderer has been tested with large networks. See the scale stories for performance characteristics:

[1K nodes](https://tryopendata.github.io/openchart/?story=graphs--graphs#scale) | [5K nodes](https://tryopendata.github.io/openchart/?story=graphs--graphs#scale) | [10K nodes](https://tryopendata.github.io/openchart/?story=graphs--graphs#scale)

---

## Related docs

- [Spec reference: GraphSpec](spec-reference.md#graphspec) for field-by-field type details
- [Chart types](chart-types.md) for standard chart visualizations
- [Tables](tables.md) for data table visualizations
- [Integration guide](integration-guide.md) for graph event handling and advanced patterns
