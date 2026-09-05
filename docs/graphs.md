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
| `nodeOpacity` | Node fill opacity | quantitative (0.25-1 range)  |
| `nodeLabel` | Node label text  | any                            |
| `nodeLabelPriority` | Which labels survive label thinning | quantitative (0-1 range) |
| `edgeColor` | Edge stroke color| nominal, ordinal, quantitative |
| `edgeWidth` | Edge stroke width| quantitative (0.5-4px range)   |
| `edgeStyle` | Edge line style  | nominal, ordinal (solid/dashed/dotted) |

Labels run on a budget, not a threshold: the renderer draws the highest-priority labels that fit the current zoom (12 when zoomed out, up to 80 zoomed in) and drops any whose box would collide with one already placed. Label priority defaults to node degree, so the best-connected nodes keep their labels as the view gets crowded. Point `nodeLabelPriority` at a field to label by importance instead:

```ts
encoding: {
  nodeLabel: { field: "name" },
  nodeLabelPriority: { field: "citations" },
}
```

`nodeOverrides[id].alwaysShowLabel` still hard-pins an individual label above everything the channel produces. Pinned, hovered, selected, and search-matched labels bypass both the budget and the declutter, and they are the only ones drawn with a halo behind the text.

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

## Seed node

A graph built around one entity — the dataset you searched for, the person at the center of a network — can name that node declaratively instead of hand-writing an override for it:

```ts
seedNode: "travis-county",

// or with styling on top of the defaults:
seedNode: { id: "travis-county", style: { radius: 14 } },
```

The seed gets a ring in the theme's text color, a 2px stroke, and an always-on label. Its radius is deliberately left to the `nodeSize` encoding so the seed doesn't contradict the data; set `style.radius` when you want it bigger regardless.

The seed also stays lit whenever focus dims the rest of the graph — a category highlight, a legend filter, a hover, or a selection. It is an always-visible anchor rather than a per-interaction emphasis. Search is the exception: a seed that doesn't match the query dims with everything else. Only the seed itself is exempt — its neighbors dim like any other node, which is what keeps a hub seed from lighting up half the graph. An `id` that matches no node warns once and is ignored rather than throwing, so a filtered or paginated node update can't crash the host; route that warning somewhere other than the console with the `onWarn` mount option.

`seedNode` names a node. It is unrelated to `layout.seed`, which is the deterministic RNG seed for the force simulation.

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

### Driving emphasis from your own UI

Set `legend: false` and the graph instance still exposes everything the built-in legend uses, so a custom sidebar keeps its own counts, edge key, and mobile layout without giving up native focus rendering. The methods are on the vanilla `GraphInstance` and on `useGraph()` in all three framework wrappers.

`getLegend()` returns the resolved categories with label, color, count, and active flag. `setActiveCategories(values)` sets the sticky filter (empty array means no filter), and `getActiveCategories()` reads it back. `highlight(target)` applies transient emphasis over a category, an explicit node id set, or a node's neighborhood; `clearHighlight()` releases it. None of these recompile the spec.

The two emphasis layers compose rather than compete. `setActiveCategories` is sticky and survives until you change it; `highlight()` is transient and layers on top, so the natural pattern is click to filter, hover to preview:

```tsx
const { ref, getLegend, getActiveCategories, setActiveCategories, highlight, clearHighlight } =
  useGraph();

const toggle = (label: string) => {
  const active = getActiveCategories();
  setActiveCategories(
    active.includes(label) ? active.filter((v) => v !== label) : [...active, label],
  );
};

<LegendRow
  onClick={() => toggle(row.label)}
  onMouseEnter={() => highlight({ category: { field: "type", value: row.label } })}
  onMouseLeave={() => clearHighlight()}
/>;
```

When both are active the effective set is their intersection, except that hovering a row outside the filter previews that category on its own rather than lighting nothing. Releasing the hover returns to the filtered view. A `highlight()` target that matches no nodes at all is a no-op layer: the standing filter keeps dimming rather than the graph going fully lit. A category-form target is re-resolved on every `update()`, so it tracks data changes instead of freezing the ids it matched when you called it.

Two consequences worth knowing. `clearHighlight()` clears only the transient layer — clearing the filter is `setActiveCategories([])`. And legend `active` flags track the filter alone, so a hover never makes rows flicker between states.

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
