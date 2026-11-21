---
title: "TileMapSpec"
description: "TileMapSpec fields for US state tile grids: encoding, behavior and an example."
section: spec
order: 14
---

# TileMapSpec

A `TileMapSpec` (`type: 'tilemap'`) draws each US state and the District of Columbia as an equal square in a fixed grid, colored by value or by category. Use it when a choropleth would let large, sparsely populated states dominate.

See it: [Tile map](https://openchart.steamfield.io/docs/maps/tile-map/).

## TileMapSpec

Input for US state tile grid maps. Source: `core/src/types/spec.ts`.

Every state renders as an equal-size square in a fixed 12x8 grid, so small states get the same visual weight as large ones. Uses a separate component: `<TileMap>` (React/Vue/Svelte) or `createTileMap` (vanilla).

| Field         | Type                                                  | Default     | Description                                                                     |
| ------------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `type`        | `'tilemap'`                                           | (required)  | Discriminant. Always `'tilemap'`.                                               |
| `data`        | `Record<string, number \| string \| null> \| DataRow[]` | (required)  | Either a record mapping state postal codes to values (`{ CA: 5.3, TX: 4.3 }`), or tabular rows (requires `encoding`). Numeric values produce quantitative mode; string values produce categorical mode. |
| `encoding`    | `TileMapEncoding`                                     | auto        | Required when data is `DataRow[]`. Auto-generated when data is a record map.    |
| `palette`     | `'blue' \| 'green' \| 'orange' \| 'purple' \| 'teal'` | `'blue'`    | Sequential color palette. Quantitative mode only.                               |
| `colors`      | `Record<string, string>`                              | `undefined` | Category-to-color mapping for categorical tilemaps. When provided, forces categorical mode. |
| `chrome`      | `Chrome`                                              | `undefined` | Editorial text (title, subtitle, source, byline, footer).                       |
| `legend`      | `LegendConfig`                                        | `undefined` | Legend display configuration. `show: false` hides it.                           |
| `theme`       | `ThemeConfig`                                         | `undefined` | Theme overrides.                                                                |
| `watermark`   | `boolean`                                             | `true`      | Whether to show the tryOpenData.ai watermark.                                   |
| `animation`   | `AnimationSpec`                                       | on          | Animation configuration. On by default.                                            |
| `valueFormat` | `string` | `undefined` | Tilemap fallback d3-format string for values, legend labels, and tooltips; `encoding.value.format` takes precedence. |

### TileMapEncoding

| Channel   | Type                                   | Required | Description                                                                                 |
| --------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `state`   | `EncodingChannel`                      | yes      | State code field (nominal). Maps to US state postal abbreviations.                          |
| `value`   | `EncodingChannel`                      | yes      | Value field. Quantitative values map to the sequential palette; strings switch to categorical mode. |
| `color`   | `EncodingChannel`                      | no       | Nominal color channel. When present, enables categorical coloring.                          |
| `tooltip` | `EncodingChannel \| EncodingChannel[]` | no       | Tooltip encoding.                                                                           |

### Tilemap behavior

- **Quantitative mode** renders a gradient legend bar with min/max labels below the grid. **Categorical mode** (string values, a `color` channel, or a `colors` map) renders swatch rows instead.
- States missing from the data render as empty tiles, keeping their place on the grid.
- **Number formatting:** set `encoding.value.format` (d3-format string, e.g. `".1f"`, `"$,.0f"`, `"~s"`). It applies to tile values, legend labels, and tooltips, and wins over top-level `valueFormat`. With record-map data and no explicit encoding, `valueFormat` remains supported.
- **`scale.scheme` fails validation on tilemap encoding channels.** The tilemap compile path never reads it; the top-level `palette` property is the mechanism tilemaps use for color.

### Tilemap example

```ts
import { TileMap } from "@opendata-ai/openchart-react";

const spec: TileMapSpec = {
  type: "tilemap",
  data: { CA: 5.3, TX: 4.3, NY: 4.5, FL: 3.1 /* ...state code -> value */ },
  palette: "blue",
  chrome: {
    title: "Where the Job Market Is Tightest",
    subtitle: "State unemployment rate, seasonally adjusted, %",
    source: "Bureau of Labor Statistics",
  },
  animation: true,
};
```

With tabular data, add the encoding explicitly:

```ts
const spec: TileMapSpec = {
  type: "tilemap",
  data: [
    { code: "CA", rate: 5.3 },
    { code: "TX", rate: 4.3 },
  ],
  encoding: {
    state: { field: "code", type: "nominal" },
    value: { field: "rate", type: "quantitative", format: ".1f" },
  },
};
```
