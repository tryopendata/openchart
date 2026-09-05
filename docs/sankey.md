# Sankey

Flow diagrams (`type: 'sankey'`) compiled from source/target/value rows.
This page covers label anatomy, value formatting, the opt-in `other`
bucketing convention, and path-hover semantics.

## Quick start

```tsx
import { Sankey } from "@opendata-ai/openchart-react";

const spec = {
  type: "sankey",
  data: [
    { source: "Coal", target: "Electricity", value: 120 },
    { source: "Gas", target: "Electricity", value: 90 },
    { source: "Electricity", target: "Residential", value: 130 },
    { source: "Electricity", target: "Industry", value: 80 },
  ],
  encoding: {
    source: { field: "source" },
    target: { field: "target" },
    value: { field: "value" },
  },
  chrome: { title: "Energy flow, 2025" },
};

<Sankey spec={spec} />
```

For Vue, import from `@opendata-ai/openchart-vue`. For Svelte, import from
`@opendata-ai/openchart-svelte`. For vanilla JS, use `createSankey(container,
spec)` from `@opendata-ai/openchart-vanilla`. See the
[spec reference](spec-reference.md#sankeyspec) for every `SankeySpec` field.

## Labels

Node labels are positioned by column depth: depth 0 (the leftmost column)
labels outside-left, the last depth labels outside-right, and every middle
column labels to the right of its node. A symmetric left-overflow
reservation caps how much width the outside-left labels may claim at 35% of
the chart width, so a long first-column label can't crowd out the flow
diagram itself.

Each label is the node name at weight 500, with a tabular-figure value
`<tspan>` in `colors.axis` beside it — the name reads as the primary label,
the number as a lighter secondary figure. On an interior column, if the
value tspan would collide with the next column's content, it's dropped
rather than overlapping (verified at 360px width in the `sankey-narrow-long-labels`
fixture, where "Heating 25.80" would otherwise run into "Industry"). Nodes
carry no stroke (`stroke: none`) — only the link opacity below distinguishes
flow from background.

## Link opacity

Default link opacity is 0.5 on light backgrounds, 0.6 on dark (`linkOpacity`
overrides it explicitly). The dark value was tuned down from an earlier
0.75, which turned every link crossing into a visually solid slab; 0.6 keeps
overlapping links readable as overlapping rather than merged.

## The `other` bucket

Sub-threshold nodes can be merged into a trailing "Other" node per depth,
opt-in via `SankeySpec.other`:

```ts
{
  type: 'sankey',
  other: 0.05, // merge nodes below 5% of their depth's total flow
  // or: other: { threshold: 0.05, label: 'Long tail' }
}
```

Merged nodes are rewritten into one bucket per depth colored
`theme.colors.neutral[300]` (a deliberately neutral, non-categorical color,
since "Other" isn't a real category). The merge preserves total flow —
links into and out of merged nodes are redirected onto the bucket node
rather than dropped. This is the same `other` spelling and shape used by
waffle charts (see `docs/design-system.md`), and by design there is no
default bucketing anywhere in the library: every category or node renders
individually unless you opt in.

## Hover

Hovering a node or a link traces the whole connected path — every link and
node upstream and downstream of the hovered element — via a breadth-first
search from the hovered node (link hover seeds the search from both of its
endpoints). On-path links go to 0.7 opacity, off-path links dim to 0.12,
and off-path nodes and their labels (stamped `data-node-id` for the match)
dim to 0.3. For example, tracing from node B in a flow A→B→C alongside a
separate A→D yields the on-path set `{A, B, C}`, with D and its link dimmed.
Opacity transitions run at `--oc-hover-duration` (140ms), the same token
every other hover transition in the library uses.

Source: `packages/engine/src/sankey/compile-sankey.ts` (node labels, link
opacity, `other` resolution), `packages/vanilla/src/sankey-mount.ts`
(`highlightPath`, path tracing), `packages/vanilla/src/sankey-renderer.ts`
(label rendering), `packages/core/src/styles/sankey.css` (hover
transitions).
