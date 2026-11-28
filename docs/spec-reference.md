---
title: "Spec reference"
description: "The VizSpec union, the spec builder functions, and a one-line index of every reference page."
section: spec
slug: overview
order: 1
---

# Spec reference

Every OpenChart visualization is one JSON object, a `VizSpec`. The reference pages list each spec type field by field, with types and defaults checked against the TypeScript source in `packages/core/src/types/`. Use them to look up an exact name or default; the Building blocks pages teach the same fields with charts.

See it: [Anatomy of a spec](https://openchart.steamfield.io/docs/the-spec/anatomy/) builds a spec one block at a time.

All types are importable from `@opendata-ai/openchart-core` or from the convenience re-exports in `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`, and `@opendata-ai/openchart-engine`.

## Contents

### Spec

- [ChartSpec](reference/chart-spec.md): a chart with one mark, its top-level fields and mark properties, plus `a11y` and `frame`.
- [LayerSpec](reference/layer-spec.md): several chart specs on shared axes, and what each layer inherits.
- [Encoding](reference/encoding.md): the channels, field types, aggregates, axes and scales, and faceting into small multiples.
- [Marks](reference/marks.md): the channels each mark takes, a complete spec for each common chart, and canvas mark mode.
- [Chrome, labels and legends](reference/chrome.md): title, subtitle, source, byline and footer, value labels, endpoint labels and the legend.
- [Transforms](reference/transforms.md): filter, bin, calculate, timeUnit, aggregate, joinaggregate, fold, window and density.
- [Annotations](reference/annotations.md): text callouts, ranges and reference lines.
- [Animation](reference/animation.md): presets, entrance and update phases, and data-update transitions.
- [Theme](reference/theme.md): `ThemeConfig` overrides and the `DarkMode` setting.
- [TableSpec](reference/table-spec.md): data tables, `ColumnConfig` and the column visual types.
- [GraphSpec](reference/graph-spec.md): network charts and the `Graph` component.
- [SankeySpec](reference/sankey-spec.md): flow diagrams.
- [TileMapSpec](reference/tilemap-spec.md): US state tile grids.
- [GeoMapSpec](reference/geomap-spec.md): choropleth and symbol maps.
- [BarListSpec](reference/barlist-spec.md): ranked bar lists.
- [Authoring and reader APIs](reference/authoring.md): field metadata, reader identity, diagnostics and callout limits for editing and reading apps.

### API

- [Vanilla API](reference/vanilla.md): the `create*` mount functions, `MountOptions`, `ChartInstance` and the lifecycle.
- [React](reference/react.md), [Vue](reference/vue.md) and [Svelte](reference/svelte.md): components, props, hooks or composables, and server rendering.
- [Events](reference/events.md): every handler and payload, interaction modes and edit persistence.
- [Export API](reference/export.md): SVG, PNG, JPG, CSV and animated GIF export.
- [Table state](reference/table-state.md): controlled and uncontrolled sort, search and pagination.

### Tokens

- [Theming tokens](theming-tokens.md): `ThemeConfig` fields and the CSS custom properties behind them.
- [Design system](design-system.md): the default palette, type scale, spacing, mark defaults, motion and presets.

### Machine-readable

- [JSON Schema and llms.txt](reference/json-schema.md): the published schema, `validateSpec` and its error codes, the llms.txt exports and the agent skill.

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
| `watermark`   | `boolean`      | Whether to show the OpenChart watermark. Mount/compile options take precedence over the spec; defaults to `true`. |

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
