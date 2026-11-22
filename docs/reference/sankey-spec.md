---
title: "SankeySpec"
description: "SankeySpec fields for flow diagrams: encoding, node and link settings, and an example."
section: spec
order: 13
---

# SankeySpec

A `SankeySpec` (`type: 'sankey'`) draws flows between stages as bands whose width is the flow's value. Each data row is one link from a source node to a target node.

See it: [Sankey](https://openchart.steamfield.io/docs/flow/sankey/).

## SankeySpec

Input for flow/Sankey diagram visualizations. Source: `core/src/types/spec.ts`.

Sankey diagrams show flows between stages. Each data row represents a link from a source node to a target node with a quantitative value. Nodes are auto-derived from the data. Uses a separate component: `<Sankey>` (React/Vue/Svelte) or `createSankey` (vanilla).

| Field           | Type              | Default     | Description                                                                         |
| --------------- | ----------------- | ----------- | ----------------------------------------------------------------------------------- |
| `type`          | `'sankey'`        | (required)  | Discriminant. Always `'sankey'`.                                                    |
| `data`          | `DataRow[]`       | (required)  | Tabular flow data. Each row is a source-target-value link.                          |
| `encoding`      | `SankeyEncoding`  | (required)  | Maps data fields to source, target, value channels. See below.                      |
| `nodeWidth`     | `number`          | `12`        | Width of node rectangles in pixels.                                                 |
| `nodePadding`   | `number`          | `16`        | Vertical padding between nodes in pixels.                                           |
| `nodeAlign`     | `SankeyNodeAlign` | `'justify'` | Node alignment: `'left'`, `'right'`, `'center'`, `'justify'`.                      |
| `iterations`    | `number`          | `6`         | Number of layout relaxation iterations.                                             |
| `linkStyle`     | `SankeyLinkColor` | `'gradient'`| Link coloring: `'gradient'`, `'source'`, `'target'`, `'neutral'`.                  |
| `linkOpacity`   | `number`          | `0.5`       | Link fill opacity (0-1). Defaults to 0.75 in dark mode.                            |
| `nodeLabelAlign`| `string`          | `'auto'`    | Label placement: `'auto'`, `'left'`, `'right'`. Under `'auto'`, labels move onto the flow when outside gutters would leave the bands under half the width. |
| `overrides`     | `{ compact?, medium? }` | `undefined` | Per-breakpoint settings (`compact` under 400px, `medium` 400 to 700px): `chrome` (merged), `other`, `nodeSort`, `nodeLabelAlign`, `nodePadding`. |
| `chrome`        | `Chrome`          | `undefined` | Editorial text (title, subtitle, source, byline, footer).                           |
| `legend`        | `LegendConfig`    | `undefined` | Legend display configuration.                                                       |
| `theme`         | `ThemeConfig`     | `undefined` | Theme overrides.                                                                    |
| `watermark`     | `boolean`         | `true`      | Whether to show the tryOpenData.ai watermark.                                       |
| `animation`     | `AnimationSpec`   | on          | Animation configuration. On by default; `false` disables it. Supports entrance, update and exit (see [Data-update transitions](./animation.md#data-update-transitions)). |

### SankeyEncoding

| Channel   | Type                               | Required | Description                           |
| --------- | ---------------------------------- | -------- | ------------------------------------- |
| `source`  | `EncodingChannel`                  | yes      | Source node field (nominal).          |
| `target`  | `EncodingChannel`                  | yes      | Target node field (nominal).          |
| `value`   | `EncodingChannel`                  | yes      | Flow value field (quantitative).      |
| `color`   | `EncodingChannel`                  | no       | Groups nodes into color categories. Colors cycle `theme.colors.categorical`; `scale.scheme` is not read and fails validation. |
| `tooltip` | `EncodingChannel \| EncodingChannel[]` | no  | Tooltip encoding.                     |

### Sankey example

```ts
import { Sankey } from "@opendata-ai/openchart-react";

const spec: SankeySpec = {
  type: "sankey",
  data: [
    { source: "Coal", target: "Electricity", value: 46.5 },
    { source: "Natural Gas", target: "Electricity", value: 38.2 },
    { source: "Natural Gas", target: "Heating", value: 25.8 },
    { source: "Electricity", target: "Residential", value: 38.5 },
    { source: "Electricity", target: "Commercial", value: 35.8 },
    { source: "Heating", target: "Residential", value: 15.2 },
  ],
  encoding: {
    source: { field: "source", type: "nominal" },
    target: { field: "target", type: "nominal" },
    value: { field: "value", type: "quantitative" },
  },
  chrome: {
    title: "US Energy Flow",
    subtitle: "From primary sources to end-use sectors, quadrillion BTU",
    source: "U.S. Energy Information Administration",
  },
};
```
