---
title: "Spec reference"
description: "The VizSpec union, the spec builder functions, and an index of the reference pages for every spec field."
section: spec
slug: overview
order: 1
---
<!-- phase-4-stub -->

# Spec reference

The definitive field-by-field reference for every type in `VizSpec`. Cross-referenced against the TypeScript source in `@opendata-ai/openchart-core/src/types/`.

All types are importable from `@opendata-ai/openchart-core` or from the convenience re-exports in `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`, and `@opendata-ai/openchart-engine`.

## Contents

- [VizSpec](#vizspec) (top-level union type)
- [ChartSpec](reference/chart-spec.md#chartspec-1) (line, area, bar, column, pie, donut, dot, scatter)
  - [Mark properties](reference/chart-spec.md#mark-properties) (fill, gradient, point, interpolate, opacity)
- [LayerSpec](reference/layer-spec.md#layerspec-1) (overlay multiple chart types)
- [Encoding](reference/encoding.md#encoding-1) (x, y, color, size, detail channels)
- [Faceting](reference/encoding.md#faceting) (facet, row, column channels; resolve)
- [Transforms](reference/transforms.md#transforms-1) (filter, bin, aggregate, joinaggregate, calculate, timeUnit, fold, window, density)
- [Annotations](reference/annotations.md#annotations-1) (refline, text, range)
- [Labels](reference/chrome.md#labels) (density, format, position)
- [Endpoint labels](reference/chrome.md#endpoint-labels) (series names and last values)
- [Chrome](reference/chrome.md#chrome) (title, subtitle, source, byline, footer)
- [ThemeConfig](reference/theme.md#themeconfig) (colors, fonts, spacing, editorial rule)
- [A11yConfig](reference/chart-spec.md#a11yconfig) (figure name, hidden table, decorative charts)
- [FrameConfig](reference/chart-spec.md#frameconfig) (fixed left/right plot margins)
- [BarListSpec](reference/barlist-spec.md#barlistspec-1) (grouped ranked lists and value references)
- [DarkMode](reference/theme.md#darkmode) (auto, force, off)
- [TableSpec](reference/table-spec.md#tablespec-1) (data tables: density, striping, sort, totals)
- [ColumnConfig](reference/table-spec.md#columnconfig) (column definitions and visual types)
- [Event handlers](reference/events.md#event-handlers) (chart and table interaction callbacks)
- [GraphSpec](reference/graph-spec.md#graphspec-1) (network/relationship visualizations)
- [SankeySpec](reference/sankey-spec.md#sankeyspec-1) (flow diagrams)
- [GeoMapSpec](reference/geomap-spec.md#geomapspec-1) (choropleth and symbol maps)
- [TileMapSpec](reference/tilemap-spec.md#tilemapspec-1) (US state tile grid maps)
- [Spec builder functions](#spec-builder-functions) (lineChart, barChart, etc.)
- [Validation](reference/json-schema.md#validation) (validateSpec, error codes)

## VizSpec

The top-level type is a discriminated union on the `type` field:

```ts
type VizSpec =
  | ChartSpec
  | LayerSpec
  | TableSpec
  | GraphSpec
  | SankeySpec
  | TileMapSpec
  | GeoMapSpec
  | BarListSpec;
```

Use `type` to select which spec shape you're building:

- Chart types (`line`, `area`, `bar`, `column`, `pie`, `donut`, `dot`, `scatter`) produce a `ChartSpec`
- `table` produces a `TableSpec`
- `graph` produces a `GraphSpec`
- `sankey` produces a `SankeySpec`
- `tilemap` produces a `TileMapSpec`
- `map` produces a `GeoMapSpec`
- `barlist` produces a `BarListSpec`

Type guards are available: `isChartSpec(spec)`, `isTableSpec(spec)`, `isGraphSpec(spec)`, `isSankeySpec(spec)`, `isTileMapSpec(spec)`, `isGeoMapSpec(spec)`, `isBarListSpec(spec)`.

---

## Spec builder functions

Helper functions that reduce boilerplate. Source: `core/src/helpers/spec-builders.ts`.

All builders accept field names as strings (auto-infer type from data) or full `EncodingChannel` objects (when you need to customize type, aggregate, axis, or scale).

| Builder        | Signature                           | Produces                                                             |
| -------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `lineChart`    | `(data, x, y, options?)`            | `ChartSpec` with `mark: 'line'`                                      |
| `areaChart`    | `(data, x, y, options?)`            | `ChartSpec` with `mark: 'area'`                                      |
| `barChart`     | `(data, category, value, options?)` | `ChartSpec` with `mark: 'bar'`. category -> y, value -> x            |
| `columnChart`  | `(data, x, y, options?)`            | `ChartSpec` with `mark: 'bar'`. x nominal, y quantitative            |
| `pieChart`     | `(data, category, value, options?)` | `ChartSpec` with `mark: 'arc'`. category -> color, value -> y        |
| `donutChart`   | `(data, category, value, options?)` | `ChartSpec` with `mark: { type: 'arc', innerRadius: 40 }`. category -> color, value -> y |
| `dotChart`     | `(data, x, y, options?)`            | `ChartSpec` with `mark: 'circle'`                                    |
| `scatterChart` | `(data, x, y, options?)`            | `ChartSpec` with `mark: 'point'`                                     |
| `dataTable`    | `(data, options?)`                  | `TableSpec`. Auto-generates columns from data keys if none provided. |

### ChartBuilderOptions

| Field         | Type           | Description                                |
| ------------- | -------------- | ------------------------------------------ |
| `color`       | `FieldRef`     | Color encoding for series differentiation. |
| `size`        | `FieldRef`     | Size encoding (bubble charts).             |
| `chrome`      | `Chrome`       | Editorial chrome.                          |
| `annotations` | `Annotation[]` | Annotations.                               |
| `responsive`  | `boolean`      | Responsive behavior.                       |
| `theme`       | `ThemeConfig`  | Theme overrides.                           |
| `watermark`   | `boolean`      | Whether to show the tryOpenData.ai watermark. Mount/compile options take precedence over the spec; defaults to `true`. |

`FieldRef` is `string | EncodingChannel`. When a string is provided, `inferFieldType()` uses the shared builder/compiler inference: sample up to 50 rows, ignore nulls, and require more than 80% agreement. Numeric strings are considered before dates, so a column of `'2020'` values is quantitative. Set the channel type explicitly when years should be ordinal or temporal.

### Builder example

```ts
import { lineChart } from "@opendata-ai/openchart-core";

const spec = lineChart(data, "date", "revenue", {
  color: "region",
  chrome: { title: "Revenue trend" },
  annotations: [{ type: "refline", y: 50000, label: "Target" }],
});
```

---

## Related docs

- [Chart types](chart-types.md) for a visual gallery with boilerplate specs and live examples
- [Tables](tables.md) for data table features (heatmaps, sparklines, flags, and more)
- [Graphs](graphs.md) for network/relationship visualizations
- [Getting started](getting-started.md) for a hands-on tutorial
- [Architecture](architecture.md) for how the packages and compilation pipeline work
- [Integration guide](integration-guide.md) for building apps on top of the library
