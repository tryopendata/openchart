---
title: "LayerSpec"
description: "LayerSpec fields for overlaying several marks on shared scales, and what each layer inherits."
section: spec
order: 3
---

# LayerSpec

A `LayerSpec` draws several chart specs on one set of axes: a line over an area, points over a line, a rule at a target value. Children inherit the parent's data, encoding and transforms unless they set their own. A spec with a `layer` array is a `LayerSpec`.

See it: [Layers](/docs/composition/layers/) and [Trendlines](/docs/correlation/trendlines/).

## LayerSpec

Overlay multiple chart types on shared scales. Source: `core/src/types/spec.ts`.

| Field          | Type                         | Default     | Description                                                                                   |
| -------------- | ---------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `layer`        | `(ChartSpec \| LayerSpec)[]` | (required)  | Array of child chart specs. Nesting is supported.                                             |
| `data`         | `DataRow[]`                  | `undefined` | Shared data inherited by children that don't define their own.                                |
| `encoding`     | `Encoding`                   | `undefined` | Shared encoding inherited by children. Child channels override parent channels.               |
| `transform`    | `Transform[]`                | `undefined` | Shared transforms. Parent transforms run before child transforms.                             |
| `chrome`       | `Chrome`                     | `undefined` | Editorial text (title, subtitle, source, etc.) for the layered view.                          |
| `annotations`  | `Annotation[]`               | `undefined` | Annotations on the layered view.                                                              |
| `labels` | `LabelSpec` | `undefined` | Figure label configuration; explicit composed `content` propagates to bar/range leaves without child labels. |
| `display` | `'full' \| 'sparkline'` | first leaf, then `'full'` | Shared display defaults, including layered compact cells. |
| `a11y` | `A11yConfig` | first leaf | Figure name, live table and visibility. |
| `frame` | `FrameConfig` | first leaf, then automatic | Shared fixed plot margins. |
| `endpointLabels` | `boolean \| EndpointLabelsConfig` | inherited/automatic | Propagates to children that omit it. See [Endpoint labels](./chrome.md#endpoint-labels). |
| `legend`       | `LegendConfig`               | `undefined` | Legend display configuration.                                                                 |
| `responsive`   | `boolean \| ResponsiveConfig` | `undefined` | Same as `ChartSpec.responsive`. When omitted, the first leaf's value applies.                 |
| `theme`        | `ThemeConfig`                | `undefined` | Theme overrides.                                                                              |
| `watermark`    | `boolean`                    | `true`      | Whether to show the watermark. Defaults to `true`; auto-hides when the container is under 200px tall unless explicitly set. |
| `resolve`      | `ResolveConfig`              | `undefined` | Resolution strategy for shared vs. independent scales/axes/legends.                           |
| `hiddenSeries` | `string[]`                   | `undefined` | Series names to hide from rendering.                                                          |
| `animation`    | `AnimationSpec`              | on | Animation configuration. On by default; `false` disables it. See [Animation](./animation.md#animation-1). |

**Figure inheritance:** `display`, `a11y` and `frame` flow through nested layers to leaves that omit them. A child can replace each inherited value; these objects are not merged property by property. The composed figure uses its root value, falling back to the first flattened leaf. Root `labels` likewise controls the composed figure. A parent labels object with explicit `content` is inherited only by bar and range leaves without their own `labels`; interval peers such as ticks do not inherit inapplicable composed-label options. Other parent labels configurations are not copied to every leaf. Child `labels` wins as a whole.

**Scale behavior:** All layers share scales by default. The engine unions data from all layers to compute a single scale domain, so marks from different layers are positioned on the same coordinate system.

**Encoding inheritance:** Parent `encoding` channels are merged into child layers. A child channel overrides the parent on the same key, so you can share `x` across layers while varying `y` and `mark`.

```ts
const spec = {
  layer: [
    {
      mark: 'area',
      data: revenueData,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    },
    {
      mark: 'line',
      data: targetData,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'target', type: 'quantitative' },
      },
    },
  ],
  chrome: { title: 'Revenue vs target' },
};
```
