---
title: "ChartSpec"
description: "Every top-level ChartSpec field and the mark properties, plus the A11yConfig and FrameConfig objects."
section: spec
order: 2
---

# ChartSpec

A `ChartSpec` draws one chart with one mark: a line, bar, area, scatter, pie or any other mark type in the table below. A spec with a `mark` field and no `type` field is a `ChartSpec`. Only `mark`, `data` and `encoding` are required.

See it: [Anatomy of a spec](/docs/the-spec/anatomy/) builds a chart spec one block at a time.

## ChartSpec

The primary input for standard chart types. Source: `core/src/types/spec.ts`.

| Field         | Type           | Default     | Description                                                                                   |
| ------------- | -------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `mark`        | `MarkType \| MarkDef` | (required) | The mark: `'bar'`, `'line'`, `'area'`, `'point'`, `'circle'`, `'arc'`, `'text'`, `'rule'`, `'tick'`, `'rect'`, `'lollipop'`, `'beeswarm'`, `'histogram'`, `'density'`, `'range'`, `'errorbar'`, `'waffle'`, `'calendar'`, `'parliament'`. See [Mark properties](#mark-properties) for the object form. |
| `data`        | `DataRow[]`    | (required)  | Array of data rows. Each row is a `Record<string, unknown>`. Must be non-empty.               |
| `encoding`    | `Encoding`     | (required)  | Maps data fields to visual channels. See [Encoding](./encoding.md#encoding-1).                               |
| `chrome`      | `Chrome`       | `undefined` | Editorial text: title, subtitle, source, byline, footer. See [Chrome](./chrome.md#chrome).               |
| `chromeLayout`| `'subtract' \| 'grow'` | note-band growth | How chrome text interacts with the container height budget. See [Chrome layout](./chrome.md#chrome-layout). |
| `annotations` | `Annotation[]` | `undefined` | Text callouts, highlighted ranges, reference lines. See [Annotations](./annotations.md#annotations-1).          |
| `labels`      | `LabelConfig`  | `undefined` | Data label display controls. See [Labels](./chrome.md#labels).                                           |
| `responsive`  | `boolean \| ResponsiveConfig` | `true` | Layout adaptations at compact sizes; mount `autoResize` controls ResizeObserver.                               |
| `theme`       | `ThemeConfig`  | `undefined` | Theme overrides. Deep-merged onto the default theme. See [ThemeConfig](./theme.md#themeconfig).         |
| `watermark`   | `boolean`      | `true`      | Whether to show the tryOpenData.ai watermark. Mount/compile options take precedence over spec and active breakpoint values. Defaults to `true`; auto-hides when the container is under 200px tall unless explicitly set. |
| `animation`   | `AnimationSpec`| on | Animation configuration. On by default; `false` disables it. See [Animation](./animation.md#animation-1). |
| `description` | `string`       | `undefined` | Alt text for the chart (Vega-Lite aligned). Sugar for `a11y.description`. Auto-generated when absent. See the [accessibility guide](../accessibility.md). |
| `a11y` | `A11yConfig` | `undefined` | Figure name, generated live table and visibility. See [A11yConfig](#a11yconfig). |
| `display` | `'full' \| 'sparkline'` | `'full'` | Compact sparkline defaults omit chrome, axes, legend and watermark. |
| `frame` | `FrameConfig` | automatic gutters | Fixed horizontal plot margins. See [FrameConfig](#frameconfig). |
| `endpointLabels` | `boolean \| EndpointLabelsConfig` | automatic | Series names and last values; see [Endpoint labels](./chrome.md#endpoint-labels). |
| `transform` | `Transform[]` | `undefined` | Data transforms run in order before encoding. See [Transforms](./transforms.md). |
| `fields` | `Record<string, FieldMetadata>` | `undefined` | Per-field type, label, unit, provenance and interval metadata. See [Authoring and reader APIs](./authoring.md#authoring-foundation-additions). |
| `title`, `subtitle` | `string` (`title` also takes `{ text, subtitle? }`) | `undefined` | Shorthand for `chrome.title` and `chrome.subtitle`. The `chrome` value wins when both are set. |
| `width`, `height` | `number` | container size | Fixed render size in pixels. Setting both implies `responsive: false` unless `responsive` is set. |
| `metrics` | `Metric[]` | `undefined` | KPI cells (`label`, `value`, optional `delta`, `deltaTone`, `secondary`) in a row between the subtitle and the plot. Hidden in sparkline mode and when they don't fit. |
| `legend` | `LegendConfig` | automatic | Legend position, visibility and truncation. See [Legend](./chrome.md#legend). |
| `hiddenSeries` | `string[]` | `undefined` | Series hidden by default. Reader legend toggles layer on top and never change it. |
| `seriesStyles` | `Record<string, SeriesStyle>` | `undefined` | Per-series `lineStyle`, `showPoints`, `strokeWidth` and `opacity`, keyed by the color field value. |
| `overrides` | `Partial<Record<'compact' \| 'medium' \| 'full', ChartSpecOverride>>` | `undefined` | Fields shallow-merged into the spec when the container matches that breakpoint. |
| `crosshair` | `boolean` | `false` | Vertical line that follows the nearest point on line and area charts. |
| `seriesSearch` | `boolean \| { placeholder? }` | `undefined` | A search input over the color field's values; picking one adds it to the highlight set. Needs a categorical color encoding. |
| `youDrawIt` | `YouDrawItConfig` | `undefined` | The reader draws the line from `from` onward before the data is revealed. Line marks with one series only. Also takes `prompt`, `revealLabel`, `resetLabel` and `comparisonLine`. |
| `resolve` | `ResolveConfig` | shared | Shared or independent scales and axes across facet panels. See [resolve](./encoding.md#resolve). |
| `zIndex` | `number` | array order | Paint order inside a `LayerSpec`; higher draws on top. Axis assignment still follows array order. |

### DataRow

```ts
type DataRow = Record<string, unknown>;
```

A plain object with string keys. Values can be numbers, strings, dates, nulls, arrays (for sparklines), or booleans. The engine inspects values at runtime to validate encoding types.

### Mark properties

`MarkDef` is a discriminated union: each object accepts only options for its mark type. TypeScript, JSON Schema, and runtime validation enforce the same contract before sugar expansion. Extend it with an intersection type rather than an interface.

The `mark` field on ChartSpec accepts either a string (`'line'`) or an object with additional mark configuration. LayerSpec children are ChartSpecs, so they use `mark` too.

```ts
// String shorthand
{ mark: 'area', data: [...], encoding: {...} }

// Object form with mark properties
{
  mark: { type: 'area', point: true, fill: { gradient: 'linear', ... } },
  data: [...],
  encoding: {...}
}
```

| Field          | Type                    | Default     | Applies to     | Description                                                              |
| -------------- | ----------------------- | ----------- | -------------- | ------------------------------------------------------------------------ |
| `type`         | `MarkType`              | (required)  | all            | Mark type: `'bar'`, `'line'`, `'area'`, `'point'`, `'arc'`, `'text'`, etc. |
| `point`        | `boolean \| 'transparent'` | `false`  | line, area     | Show point markers at data positions. `true` = filled circles. |
| `interpolate`  | `string`                | `'linear'`  | line, area     | Curve: `'linear'`, `'monotone'`, `'step'`, `'step-before'`, `'step-after'`, `'basis'`, `'cardinal'`, `'natural'`. |
| `orient`       | `'horizontal' \| 'vertical'` | auto   | bar            | Explicit orientation override. |
| `innerRadius`  | `number`                | `0`         | arc            | Inner radius. >0 produces a donut. |
| `outerRadius`  | `number`                | auto        | arc            | Outer radius. |
| `cornerRadius` | `number \| 'pill'`      | `0`         | bar, arc       | Corner rounding in pixels. `'pill'` sets `rx` to half the bar thickness. |
| `centerLabel`  | `string \| { text, subtitle? }` | `undefined` | arc    | Donut center stat. A string renders one line; the object form adds a caption under it. Decorative (the number is already in the slices), and only meaningful with an inner radius. |
| `filled`       | `boolean`               | `true`      | all            | Whether the mark is filled vs stroked only. |
| `opacity` | `number` | `0.35` on errorbar; otherwise `1` | applicable marks | Overall mark opacity (0–1). Errorbar field opacity overrides mark opacity. |
| `fillOpacity`  | `number`                | varies      | histogram, density, area, bar | Fill opacity independent of stroke. Defaults to 0.55 on overlapping histogram groups and 0.4 on grouped density curves. On an area it replaces the auto gradient with a flat translucent fill. |
| `fill`         | `string \| GradientDef` | theme color | all            | Fill color or gradient. See [Gradients](#gradients). |
| `stroke`       | `string`                | `undefined` | all            | Stroke color. |
| `strokeWidth` | `number` | `2` on errorbar; otherwise mark-specific | applicable stroked marks | Stroke width in pixels. |
| `ticks` | `boolean` | `false` | errorbar | Draw 6px perpendicular end caps. Cap length is fixed, not an authored option. |
| `tooltip`      | `boolean \| null`       | `true`      | all            | Tooltip behavior. `null` disables tooltips. |
| `clip`         | `boolean`               | `false`     | all            | Clip marks to the chart area. |
| `fillPattern`  | `'auto' \| 'none'`      | `'none'`    | bar, area, arc | `'auto'` layers a per-series SVG pattern (hatch, dots, crosshatch, vertical) over the series color. See the [accessibility guide](../accessibility.md#pattern-fills). |
| `style`        | `'dumbbell' \| 'arrow' \| 'bar'` | `'dumbbell'` | range   | Range mark visual: dot-connector-dot, line with arrowhead at the end, or a plain floating bar. |
| `colorByDirection` | `boolean`           | `false`     | range          | Color range marks by direction of change: increases use the theme `positive` color, decreases `negative`. A field-based `color` encoding takes precedence. |
| `units`        | `number`                | `100`       | waffle         | Total cells in the grid. Categories normalize to this via largest-remainder rounding. |
| `columns`      | `number`                | `10`        | waffle         | Columns per grid. Rows derive from `units / columns`. |
| `other`        | `number \| { threshold, label? }` | `undefined` | waffle | Opt-in "Other" bucketing: categories whose share of the total falls below `threshold` (a fraction, so `0.05` is 5%) merge into one trailing category. Off by default -- bucketing is an editorial decision. Same shape as `SankeySpec.other`. |
| `weekStart`    | `'monday' \| 'sunday'`  | `'monday'`  | calendar       | Weekday on the top row of each year band. |
| `cellRadius`   | `number`                | `2`         | calendar       | Corner radius in pixels for day cells. |
| `shape`        | `'hemicycle'`           | `'hemicycle'` | parliament   | Seat layout shape (currently the only shape). |
| `binCount`     | `number`                | `20`        | histogram      | Number of bins. Desugars to `x.bin.maxbins`. |
| `normalize`    | `boolean`               | `false`     | histogram      | Plot each group's share of its own total instead of a raw count, so differently sized groups are comparable. Formats the y axis as a percentage. |
| `bandwidth`    | `number`                | Silverman   | density        | Gaussian kernel bandwidth. Omitted uses Silverman's rule of thumb. |
| `cumulative`   | `boolean`               | `false`     | density        | Emit a cumulative distribution (CDF) instead of a density. |
| `steps`        | `number`                | `200`       | density        | Evaluation points along the curve. |
| `seatRadius`   | `number \| 'auto'`      | `'auto'`    | parliament     | Seat dot radius in pixels. `'auto'` sizes dots to fill the rings for the seat count. |
| `majorityLine` | `boolean`               | `true`      | parliament     | Draw the majority-threshold line and its "N to win" label. |

For pre-binned histograms, an explicit `encoding.tooltip` replaces the default
numeric range title as well as the tooltip rows. To describe pooled end bins,
include a nominal field such as `{ field: 'rangeLabel', type: 'nominal', title:
'Gift size' }` with values like `Below $1,000` and `$100,000 or more`. Numeric
`x`/`x2` still position the bars; a finite display boundary need not be presented
as the actual upper bound. Without explicit tooltip fields, the bin-edge range
remains the default title.

#### Errorbar

`mark: 'errorbar'` (or `{ type: 'errorbar', ticks: true }`) draws supplied interval bounds. Horizontal intervals require quantitative `x` and `x2` plus a nominal, ordinal or temporal `y`; vertical intervals require quantitative `y` and `y2` plus a nominal, ordinal or temporal `x`. Supply exactly one of `x2` and `y2`. The domain includes both bounds. Missing bounds produce no interval mark. Stroke defaults to the resolved series color, width to 2px and opacity to 0.35; `mark.stroke`, `mark.strokeWidth`, `mark.opacity` and a field opacity encoding override those defaults. Optional caps are 6px long and decorative. OpenChart does not compute intervals from samples or accept an `extent` estimator. Layer a point to show the estimate.

#### Gradients

The `fill` property accepts a `GradientDef` object for linear or radial gradients. Source: `core/src/types/spec.ts`.

```ts
// Linear gradient (top-to-bottom opacity fade)
fill: {
  gradient: 'linear',
  x1: 0, y1: 1,  // start (bottom)
  x2: 0, y2: 0,  // end (top)
  stops: [
    { offset: 0, color: '#38bdf8', opacity: 0 },
    { offset: 1, color: '#38bdf8', opacity: 1 },
  ],
}
```

| Field    | Type             | Default | Description                                    |
| -------- | ---------------- | ------- | ---------------------------------------------- |
| `gradient` | `'linear' \| 'radial'` | (required) | Gradient type.                        |
| `stops`  | `GradientStop[]` | (required) | Color stops with offset (0-1), color, and optional opacity. |
| `x1`, `y1` | `number`      | `0`, `0` | Start point in [0,1] normalized space.        |
| `x2`, `y2` | `number`      | `0`, `1` | End point. Default is top-to-bottom.           |

**Area chart fill behavior:** Multi-series area charts default to **stacked** mode (`stack: 'zero'`), Vega-Lite aligned, with a higher-opacity per-layer gradient (top stop ~0.65 opacity) since each layer sits on solid ground. Single-series area charts apply a default `fillOpacity` of 0.15. Opting out with `stack: null` (or `false`) switches to overlap mode: a translucent per-series gradient fill (top stop ~0.04 opacity, fading to 0) layered on a shared baseline, comparison-first rather than composition-first. The gradient stop `opacity` values multiply with the per-series default, so a stop at `opacity: 1` with the overlap mode produces an effective opacity of ~0.04. Design gradient stops accordingly, or use a LayerSpec with separate line and area marks for full control.

---

## A11yConfig

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | generated figure description | Figure's accessible name; wins over chart top-level `description`. |
| `table` | `boolean` | `true` | Generate the hidden screen-reader table on live chart mounts. `false` leaves keyboard navigation enabled so a host can supply its own table. Static SVG never generates an HTML table, regardless of this value. |
| `hidden` | `boolean` | `false` | Set `aria-hidden`, omit the image role, and suppress the live table and keyboard mark navigation. Use for decorative cells. |

---

## FrameConfig

`frame` defaults to omission: left and right gutters are measured automatically. Each omitted side remains automatic independently.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `left` | `number` | automatic | Fixed left plot margin in CSS pixels. |
| `right` | `number` | automatic | Fixed right plot margin in CSS pixels. |

Values must be finite and non-negative and leave usable plot width. There are no `top` or `bottom` frame fields. Fixed values win over automatic axis, endpoint and outside-reference label reserves. Leave enough room for authored labels; fixed gutters do not expand automatically. Use matching widths, frames and temporal domains for aligned history/column figures. See [static rendering](../static-rendering.md#aligned-figures).
