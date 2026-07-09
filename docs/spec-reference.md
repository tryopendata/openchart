# Spec reference

The definitive field-by-field reference for every type in `VizSpec`. Cross-referenced against the TypeScript source in `@opendata-ai/openchart-core/src/types/`.

All types are importable from `@opendata-ai/openchart-core` or from the convenience re-exports in `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`, and `@opendata-ai/openchart-engine`.

## Contents

- [VizSpec](#vizspec) (top-level union type)
- [ChartSpec](#chartspec) (line, area, bar, column, pie, donut, dot, scatter)
  - [Mark properties](#mark-properties) (fill, gradient, point, interpolate, opacity)
- [LayerSpec](#layerspec) (overlay multiple chart types)
- [Encoding](#encoding) (x, y, color, size, detail channels)
- [Annotations](#annotations) (refline, text, range)
- [Labels](#labels) (density, format, position)
- [Chrome](#chrome) (title, subtitle, source, byline, footer)
- [ThemeConfig](#themeconfig) (colors, fonts, spacing)
- [DarkMode](#darkmode) (auto, force, off)
- [TableSpec](#tablespec) (data tables with visual features)
- [ColumnConfig](#columnconfig) (column definitions and visual types)
- [Event handlers](#event-handlers) (chart and table interaction callbacks)
- [GraphSpec](#graphspec) (network/relationship visualizations)
- [SankeySpec](#sankeyspec) (flow diagrams)
- [Spec builder functions](#spec-builder-functions) (lineChart, barChart, etc.)
- [Validation](#validation) (validateSpec, error codes)

## VizSpec

The top-level type is a discriminated union on the `type` field:

```ts
type VizSpec = ChartSpec | LayerSpec | TableSpec | GraphSpec | SankeySpec;
```

Use `type` to select which spec shape you're building:

- Chart types (`line`, `area`, `bar`, `column`, `pie`, `donut`, `dot`, `scatter`) produce a `ChartSpec`
- `table` produces a `TableSpec`
- `graph` produces a `GraphSpec`
- `sankey` produces a `SankeySpec`

Type guards are available: `isChartSpec(spec)`, `isTableSpec(spec)`, `isGraphSpec(spec)`, `isSankeySpec(spec)`.

---

## ChartSpec

The primary input for standard chart types. Source: `core/src/types/spec.ts`.

| Field         | Type           | Default     | Description                                                                                   |
| ------------- | -------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `type`        | `ChartType`    | (required)  | Chart type: `'line'`, `'area'`, `'bar'`, `'column'`, `'pie'`, `'donut'`, `'dot'`, `'scatter'` |
| `data`        | `DataRow[]`    | (required)  | Array of data rows. Each row is a `Record<string, unknown>`. Must be non-empty.               |
| `encoding`    | `Encoding`     | (required)  | Maps data fields to visual channels. See [Encoding](#encoding).                               |
| `chrome`      | `Chrome`       | `undefined` | Editorial text: title, subtitle, source, byline, footer. See [Chrome](#chrome).               |
| `annotations` | `Annotation[]` | `undefined` | Text callouts, highlighted ranges, reference lines. See [Annotations](#annotations).          |
| `labels`      | `LabelConfig`  | `undefined` | Data label display controls. See [Labels](#labels).                                           |
| `responsive`  | `boolean`      | `true`      | Whether the chart adapts to container width via ResizeObserver.                               |
| `theme`       | `ThemeConfig`  | `undefined` | Theme overrides. Deep-merged onto the default theme. See [ThemeConfig](#themeconfig).         |
| `darkMode`    | `DarkMode`     | `'off'`     | Dark mode behavior. See [DarkMode](#darkmode).                                                |
| `watermark`   | `boolean`      | `true`      | Whether to show the tryOpenData.ai watermark. Spec-level value takes precedence over mount/compile options; if neither is set, defaults to `true`. |
| `animation`   | `AnimationSpec`| `undefined` | Animation configuration. `true` enables entrance + update/exit animations. See [Animation](#animation). |

### DataRow

```ts
type DataRow = Record<string, unknown>;
```

A plain object with string keys. Values can be numbers, strings, dates, nulls, arrays (for sparklines), or booleans. The engine inspects values at runtime to validate encoding types.

### Mark properties

The `type` field on ChartSpec accepts either a string (`'line'`) or an object with additional mark configuration. In LayerSpec children, this field is called `mark`.

```ts
// String shorthand
{ type: 'area', data: [...], encoding: {...} }

// Object form with mark properties
{
  type: { type: 'area', point: true, fill: { gradient: 'linear', ... } },
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
| `cornerRadius` | `number`                | `0`         | bar, arc       | Corner rounding in pixels. |
| `filled`       | `boolean`               | `true`      | all            | Whether the mark is filled vs stroked only. |
| `opacity`      | `number`                | `1`         | all            | Overall mark opacity (0-1). |
| `fill`         | `string \| GradientDef` | theme color | all            | Fill color or gradient. See [Gradients](#gradients). |
| `stroke`       | `string`                | `undefined` | all            | Stroke color. |
| `strokeWidth`  | `number`                | varies      | all            | Stroke width in pixels. |
| `tooltip`      | `boolean \| null`       | `true`      | all            | Tooltip behavior. `null` disables tooltips. |
| `clip`         | `boolean`               | `false`     | all            | Clip marks to the chart area. |

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

**Area chart fill behavior:** Multi-series area charts default to **overlap** mode — a translucent per-series gradient fill (top stop ~0.04 opacity, fading to 0) so all series stay readable on a shared baseline. Single-series area charts apply a default `fillOpacity` of 0.15. Opting into stacked mode (`stack: 'zero' | true | 'normalize' | 'center'`) switches to the higher-opacity stacked gradient. The gradient stop `opacity` values multiply with the per-series default, so a stop at `opacity: 1` with the overlap default produces an effective opacity of ~0.04. Design gradient stops accordingly, or use a LayerSpec with separate line and area marks for full control.

---

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
| `labels`       | `LabelConfig`                | `undefined` | Label display configuration.                                                                  |
| `legend`       | `LegendConfig`               | `undefined` | Legend display configuration.                                                                 |
| `responsive`   | `boolean`                    | `true`      | Whether the chart adapts to container width.                                                  |
| `theme`        | `ThemeConfig`                | `undefined` | Theme overrides.                                                                              |
| `darkMode`     | `DarkMode`                   | `'off'`     | Dark mode behavior.                                                                           |
| `watermark`    | `boolean`                    | `true`      | Whether to show the watermark.                                                                |
| `resolve`      | `ResolveConfig`              | `undefined` | Resolution strategy for shared vs. independent scales/axes/legends.                           |
| `hiddenSeries` | `string[]`                   | `undefined` | Series names to hide from rendering.                                                          |
| `animation`    | `AnimationSpec`              | `undefined` | Animation configuration. `true` enables entrance + update/exit animations. See [Animation](#animation). |

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

---

## Encoding

Maps data fields to visual channels. Source: `core/src/types/spec.ts`.

```ts
interface Encoding {
  x?: EncodingChannel;
  y?: EncodingChannel;
  color?: EncodingChannel;
  size?: EncodingChannel;
  detail?: EncodingChannel;
}
```

Which channels are required depends on the chart type. See [Encoding by chart type](#encoding-by-chart-type).

### EncodingChannel

| Field       | Type          | Default     | Description                                                                                    |
| ----------- | ------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `field`     | `string`      | (required)  | Data field name. Must match a key in the data rows.                                            |
| `type`      | `FieldType`   | (required)  | How to interpret values: `'quantitative'`, `'temporal'`, `'nominal'`, `'ordinal'`.             |
| `aggregate` | `AggregateOp` | `undefined` | Aggregate applied before encoding: `'count'`, `'sum'`, `'mean'`, `'median'`, `'min'`, `'max'`. |
| `axis`      | `AxisConfig`  | `undefined` | Axis configuration. Only relevant for `x` and `y` channels.                                    |
| `scale`     | `ScaleConfig` | `undefined` | Scale configuration (domain, type, nice, zero).                                                |
| `stack`     | `boolean \| 'zero' \| 'normalize' \| 'center' \| null` | `'zero'` for bar/column; **non-stacked** (overlap) for area | Stacking behavior for quantitative channels. `null`/`false` disables stacking (grouped/dodged bars). `'normalize'` for 100% stacked. `'center'` for streamgraph. **Note:** multi-series area charts default to overlap mode (translucent gradients on a shared baseline) — pass `stack: 'zero'` (or `true`) to opt into stacked composition. |

### FieldType

| Value          | Meaning              | Scale created   |
| -------------- | -------------------- | --------------- |
| `quantitative` | Continuous numbers   | Linear (or log) |
| `temporal`     | Dates and times      | Time            |
| `nominal`      | Unordered categories | Band/ordinal    |
| `ordinal`      | Ordered categories   | Band/ordinal    |

### AggregateOp

`'count'` | `'sum'` | `'mean'` | `'median'` | `'min'` | `'max'`

Applied to the field values before encoding. Useful when your data has multiple rows per category and you want a single value per mark.

### AxisConfig

| Field       | Type      | Default           | Description                                                                   |
| ----------- | --------- | ----------------- | ----------------------------------------------------------------------------- |
| `label`     | `string`  | field name        | Axis label text displayed along the axis.                                     |
| `format`    | `string`  | auto              | d3-format string for tick labels, e.g. `",.0f"` for comma-separated integers. |
| `tickCount` | `number`  | auto              | Override the number of ticks. Engine picks a sensible default if omitted.     |
| `grid`      | `boolean` | `true` for y-axis | Whether to show gridlines for this axis.                                      |

### ScaleConfig

| Field    | Type                                                                      | Default                 | Description                             |
| -------- | ------------------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| `domain` | `[number, number]` or `string[]`                                          | auto from data          | Explicit domain override.               |
| `type`   | `'linear'` \| `'log'` \| `'time'` \| `'band'` \| `'point'` \| `'ordinal'` | inferred from FieldType | Scale type override.                    |
| `nice`   | `boolean`                                                                 | `true`                  | Round domain to clean tick values.      |
| `zero`   | `boolean`                                                                 | `true` (quantitative)   | Whether the domain should include zero. |

---

## Encoding by chart type

The engine validates encoding channels at runtime using `CHART_ENCODING_RULES`. Source: `core/src/types/encoding.ts`.

**Legend**: (req) = required, (opt) = optional, -- = not applicable

| Chart Type | x                                | y                      | color                  | size               | detail        | Notes                                             |
| ---------- | -------------------------------- | ---------------------- | ---------------------- | ------------------ | ------------- | ------------------------------------------------- |
| `line`     | temporal, ordinal (req)          | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | color splits into multi-series with auto legend   |
| `area`     | temporal, ordinal (req)          | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | Same encoding as line, filled region              |
| `bar`      | quantitative (req)               | nominal, ordinal (req) | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | Horizontal bars. x = values, y = categories       |
| `column`   | nominal, ordinal, temporal (req) | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | Vertical bars. x = categories, y = values         |
| `pie`      | -- (opt, unused)                 | quantitative (req)     | nominal, ordinal (req) | quantitative (opt) | nominal (opt) | color = slice categories, y = slice values        |
| `donut`    | -- (opt, unused)                 | quantitative (req)     | nominal, ordinal (req) | quantitative (opt) | nominal (opt) | Same as pie with inner radius                     |
| `dot`      | quantitative (req)               | nominal, ordinal (req) | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | Dot plot. x = values, y = categories              |
| `scatter`  | quantitative (req)               | quantitative (req)     | nominal, ordinal (opt) | quantitative (opt) | nominal (opt) | Both axes quantitative. size creates bubble chart |

### Channel purpose per chart type

**x channel**: Horizontal position. Temporal/ordinal for time series (line, area), nominal/ordinal for categories (bar, column), quantitative for values (bar, dot, scatter).

**y channel**: Vertical position. Quantitative values for most types. Nominal/ordinal categories for bar and dot (horizontal layout).

**color channel**: Series differentiation. Assigns colors from the categorical palette. Required for pie/donut (defines slices). Optional for all others (creates multi-series with legend).

**size channel**: Mark size. Creates bubble charts when applied to scatter. Maps a quantitative field to the mark radius or area.

**detail channel**: Grouping without visual encoding. Splits data into groups (like color does) but doesn't assign different colors. Useful when you want separate lines per group but all the same color.

---

## Chrome

Editorial text elements. Source: `core/src/types/spec.ts`.

```ts
interface Chrome {
  eyebrow?: string | ChromeText;
  title?: string | ChromeText;
  subtitle?: string | ChromeText;
  source?: string | ChromeText;
  byline?: string | ChromeText;
  footer?: string | ChromeText;
  brand?: string | ChromeText;
}
```

Each field accepts either a plain string or a `ChromeText` object for style overrides.

| Field      | Position                        | Default style                                                |
| ---------- | ------------------------------- | ------------------------------------------------------------ |
| `eyebrow`  | Above title                     | 11px, semibold, uppercase, theme accent — leading accent dot |
| `title`    | Top, above chart                | 22px, bold (700), `#333333`                                  |
| `subtitle` | Below title                     | 15px, normal (400), `#666666`                                |
| `source`   | Below chart area                | 12px, normal (400), `#999999`                                |
| `byline`   | Below source                    | 12px, normal (400), `#999999`                                |
| `footer`   | Below byline                    | 12px, normal (400), `#999999`                                |
| `brand`    | Right-aligned on the source row | 12px — leading accent dot, suppresses the default watermark  |

**KPI metric row** is a separate top-level field on chart specs, not part of `Chrome`. Use `metrics: Metric[]` on the chart spec for a horizontal row of label+value cells rendered between the subtitle and the chart area. Each cell can carry a delta and a secondary value. See `Metric` in `core/src/types/spec.ts` for the full shape.

### ChromeText

When you need to override the default chrome styling:

```ts
interface ChromeText {
  text: string;
  style?: ChromeTextStyle;
}

interface ChromeTextStyle {
  fontSize?: number; // Pixels
  fontWeight?: number; // 400 = normal, 600 = semibold, 700 = bold
  fontFamily?: string; // CSS font family
  color?: string; // CSS color string
}
```

Example:

```ts
chrome: {
  title: { text: 'Revenue by quarter', style: { fontSize: 28, fontWeight: 700 } },
  subtitle: 'FY2024 results',
  source: 'Source: Internal reporting',
}
```

Only the style properties you provide are overridden. Omitted properties use the theme defaults.

---

## Annotations

Data-positioned overlays. Source: `core/src/types/spec.ts`.

Three annotation types are available, discriminated by the `type` field:

### TextAnnotation

A callout label positioned at a data coordinate.

| Field        | Type                 | Default                | Description                                                                                                            |
| ------------ | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `type`       | `'text'`             | (required)             | Discriminant.                                                                                                          |
| `x`          | `string \| number`   | (required)             | X-axis data value or position.                                                                                         |
| `y`          | `string \| number`   | (required)             | Y-axis data value or position.                                                                                         |
| `text`       | `string`             | (required)             | The annotation text.                                                                                                   |
| `subtitle`   | `string`             | `undefined`            | Optional muted second-tone text rendered below `text`. Use for supporting context (methodology, source, etc.).         |
| `dot`        | `boolean \| AnnotationDot` | `undefined`      | When set, draws an open-ring marker at the connector's data-point endpoint. `true` uses default open-ring style; pass an object to override radius, fill, stroke, or strokeWidth. |
| `label`      | `string`             | `undefined`            | Additional label text.                                                                                                 |
| `fontSize`   | `number`             | theme default          | Font size override in pixels.                                                                                          |
| `fontWeight` | `number`             | theme default          | Font weight override.                                                                                                  |
| `offset`     | `AnnotationOffset`   | `undefined`            | Pixel offset from computed position. `{ dx?: number, dy?: number }`.                                                   |
| `anchor`     | `AnnotationAnchor`   | `'auto'`               | Label placement direction: `'top'`, `'bottom'`, `'left'`, `'right'`, `'auto'`.                                         |
| `connector`  | `boolean \| 'curve'` | `true`                 | `true` draws a straight connector line, `'curve'` draws a curved arrow with arrowhead, `false` disables the connector. |
| `background` | `string`             | `undefined`            | Background color behind the text. Renders a masking rect for readability over chart lines.                             |
| `fill`       | `string`             | theme `annotationFill` | Fill color.                                                                                                            |
| `stroke`     | `string`             | theme `annotationText` | Stroke color.                                                                                                          |
| `opacity`    | `number`             | `1`                    | Opacity (0 to 1).                                                                                                      |
| `zIndex`     | `number`             | `0`                    | Render ordering. Higher values render on top.                                                                          |

The `text` field supports `\n` for multi-line annotations. Each line renders as a separate `<tspan>` element, auto-centered within the label.

### RangeAnnotation

A highlighted band or rectangle.

| Field         | Type               | Default                | Description                                                 |
| ------------- | ------------------ | ---------------------- | ----------------------------------------------------------- |
| `type`        | `'range'`          | (required)             | Discriminant.                                               |
| `x1`          | `string \| number` | `undefined`            | Start of the range on x-axis.                               |
| `x2`          | `string \| number` | `undefined`            | End of the range on x-axis.                                 |
| `y1`          | `string \| number` | `undefined`            | Start of the range on y-axis.                               |
| `y2`          | `string \| number` | `undefined`            | End of the range on y-axis.                                 |
| `extendToEdges` | `boolean`        | `true`                 | For ordinal band/point scales, whether the range extends from the data-point center to the band/step edge. Set `false` to anchor at data-point centers. No effect on linear/time scales. |
| `label`       | `string`           | `undefined`            | Range label text.                                           |
| `labelOffset` | `AnnotationOffset` | `undefined`            | Pixel offset for the label. `{ dx?: number, dy?: number }`. |
| `labelAnchor` | `AnnotationAnchor` | `'auto'`               | Label placement direction.                                  |
| `fontSize`    | `number`           | `11`                   | Font size override for the range label (px).                |
| `fontWeight`  | `number`           | `500`                  | Font weight override for the range label.                   |
| `fill`        | `string`           | theme `annotationFill` | Fill color.                                                 |
| `stroke`      | `string`           | `undefined`            | Stroke color.                                               |
| `opacity`     | `number`           | `1`                    | Opacity (0 to 1).                                           |
| `zIndex`      | `number`           | `0`                    | Render ordering.                                            |

Range behavior depends on which bounds are provided:

- `x1`/`x2` only: vertical band (full chart height)
- `y1`/`y2` only: horizontal band (full chart width)
- All four: rectangle

### RefLineAnnotation

A horizontal or vertical reference line.

| Field         | Type                              | Default                | Description                         |
| ------------- | --------------------------------- | ---------------------- | ----------------------------------- |
| `type`        | `'refline'`                       | (required)             | Discriminant.                       |
| `x`           | `string \| number`                | `undefined`            | X-axis value for a vertical line.   |
| `y`           | `string \| number`                | `undefined`            | Y-axis value for a horizontal line. |
| `label`       | `string`                          | `undefined`            | Line label text.                    |
| `style`       | `'solid' \| 'dashed' \| 'dotted'` | `'solid'`              | Line style.                         |
| `strokeWidth` | `number`                          | `1`                    | Line width in pixels.               |
| `labelOffset` | `AnnotationOffset`                | `undefined`            | Pixel offset for the label.         |
| `labelAnchor` | `AnnotationAnchor`                | `'auto'`               | Label placement direction.          |
| `fontSize`    | `number`                          | `11`                   | Font size override for the label (px). |
| `fontWeight`  | `number`                          | `400`                  | Font weight override for the label. |
| `fill`        | `string`                          | `undefined`            | Fill color.                         |
| `stroke`      | `string`                          | theme `annotationText` | Stroke/line color.                  |
| `opacity`     | `number`                          | `1`                    | Opacity (0 to 1).                   |
| `zIndex`      | `number`                          | `0`                    | Render ordering.                    |

Provide `x` for a vertical line or `y` for a horizontal line. Both can be set for a crosshair.

### Annotation example

```ts
annotations: [
  // Horizontal threshold line
  { type: "refline", y: 100, label: "Target", style: "dashed", stroke: "#e45" },
  // Highlighted time range
  {
    type: "range",
    x1: "2023-06-01",
    x2: "2023-09-01",
    label: "Q3",
    opacity: 0.08,
  },
  // Text callout with fine-tuned positioning
  {
    type: "text",
    x: "2023-07-15",
    y: 142,
    text: "All-time high",
    anchor: "top",
    offset: { dy: -8 },
    connector: true,
  },
];
```

---

## Labels

Data label display configuration. Source: `core/src/types/spec.ts`.

```ts
interface LabelConfig {
  density?: LabelDensity;
  format?: string;
}
```

| Field     | Type           | Default  | Description                                         |
| --------- | -------------- | -------- | --------------------------------------------------- |
| `density` | `LabelDensity` | `'auto'` | How many data labels to show.                       |
| `format`  | `string`       | auto     | d3-format override for label values, e.g. `",.0f"`. |

### LabelDensity

| Value         | Behavior                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `'all'`       | Show every label. No collision detection. Can overlap.                                                                   |
| `'auto'`      | Show labels with collision detection. Overlapping labels are hidden and only appear in tooltips.                         |
| `'endpoints'` | Show only the first and last label per series. Good for line charts where the trend matters more than individual values. |
| `'none'`      | Hide all labels. Rely on tooltips and the legend for value readout.                                                      |

---

## Animation

Controls entrance animations and data-update transitions. Source: `core/src/types/spec.ts`.

### Quick start

```ts
// Enable all animation phases with defaults
{ animation: true }

// Entrance only (no update/exit transitions)
{ animation: { enter: true, update: false, exit: false } }

// Full control
{
  animation: {
    enter: { duration: 500, ease: 'smooth', stagger: true },
    update: { duration: 500, ease: 'smooth' },
    exit: { duration: 300, ease: 'smooth' },
    annotationDelay: 200,
  }
}
```

### AnimationSpec

`boolean | AnimationConfig`

- `true`: enables entrance animation with sensible defaults. When `animation: true`, all three phases (enter, update, exit) are enabled.
- `false` / omitted: no animation.
- `AnimationConfig`: per-phase control.

### AnimationConfig

| Field             | Type                              | Default     | Description                                        |
| ----------------- | --------------------------------- | ----------- | -------------------------------------------------- |
| `enter`           | `AnimationPhaseConfig \| boolean` | `true`      | Entrance animation when chart first renders.       |
| `update`          | `AnimationPhaseConfig \| boolean` | `true`      | Transition animation when data updates via `.update()`. |
| `exit`            | `AnimationPhaseConfig \| boolean` | `true`      | Exit animation when marks are removed during updates. |
| `annotationDelay` | `number`                          | `200`       | Delay in ms before annotations animate in after marks. |

### AnimationPhaseConfig

| Field      | Type                          | Default    | Description                                  |
| ---------- | ----------------------------- | ---------- | -------------------------------------------- |
| `duration` | `number`                      | `500`      | Duration in ms.                              |
| `ease`     | `AnimationEase`               | `'smooth'` | Easing preset: `'smooth'`, `'snappy'`, `'linear'`. |
| `stagger`  | `AnimationStagger \| boolean` | `true`     | Stagger config for entrance. `false` = simultaneous. |

### Data-update transitions

When `animation.update` is enabled and `.update(newSpec)` is called, the chart animates marks from their previous positions to the new layout instead of doing an instant swap. The engine matches marks across layouts using keys derived from data values.

**Supported mark types:** bar, line, area, point (scatter/dot).

**What transitions:**
- Rect marks (bars/columns): position + size tween
- Line/area marks: point-matched path morphing with enter/exit interpolation
- Point marks (scatter): cx/cy/r tween
- Axis ticks and gridlines: position slide for updated, fade for enter/exit
- Annotations, endpoint labels, mark labels: delayed crossfade (40% delay, 60% fade-in)

**Fallback to instant swap** when any of these conditions is true:
- Mark type changes between updates
- Encoding fields change (x/y/color field names)
- Dimensions change (container resized)
- Mark count exceeds 500
- `prefers-reduced-motion` is active
- Entrance animation is still in flight
- Chart is a sparkline

**Legend-hidden series:** When series are hidden via legend toggle, they are removed from the data. On the next `.update()` call, those series re-enter with enter animations as new marks.

### encoding.key channel

The `key` channel maps a field that uniquely identifies each datum across updates. It is not visually encoded. When omitted, the engine derives keys from the x-axis value (and color field for grouped charts).

Explicit keys are useful for scatter plots where multiple points can share the same x/y values:

```ts
{
  type: 'scatter',
  data: points,
  encoding: {
    x: { field: 'longitude', type: 'quantitative' },
    y: { field: 'latitude', type: 'quantitative' },
    key: { field: 'stationId' },
  },
  animation: true,
}
```

### Interruption behavior

When `.update()` is called while a previous transition is still running, the new transition retargets from the current interpolated positions rather than snapping to the previous final state. This creates a smooth redirect effect for rapid updates or streaming data.

For line/area marks, mid-morph interruption uses a crossfade from the frozen intermediate path to the new final path, since re-matching interpolated point arrays is intractable.

---

## ThemeConfig

User-facing theme overrides. Source: `core/src/types/spec.ts`.

All fields are optional. The engine deep-merges these onto `DEFAULT_THEME`. You only specify what you want to change.

```ts
interface ThemeConfig {
  colors?: {
    categorical?: string[];
    sequential?: Record<string, string[]>;
    diverging?: Record<string, string[]>;
    background?: string;
    text?: string;
    gridline?: string;
    axis?: string;
  };
  fonts?: {
    family?: string;
    mono?: string;
  };
  spacing?: {
    padding?: number;
    chromeGap?: number;
  };
  borderRadius?: number;
}
```

### Color overrides

| Field                | Type                       | Default                           | Description                                                       |
| -------------------- | -------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `colors.categorical` | `string[]`                 | 8-color palette                   | Categorical palette for nominal data. Array of CSS color strings. |
| `colors.sequential`  | `Record<string, string[]>` | `{ blue, green, orange, purple }` | Sequential palettes keyed by name.                                |
| `colors.diverging`   | `Record<string, string[]>` | `{ redBlue, brownTeal }`          | Diverging palettes keyed by name.                                 |
| `colors.background`  | `string`                   | `'#ffffff'`                       | Visualization background color.                                   |
| `colors.text`        | `string`                   | `'#1d1d1d'`                       | Default text color.                                               |
| `colors.gridline`    | `string`                   | `'#e8e8e8'`                       | Gridline color.                                                   |
| `colors.axis`        | `string`                   | `'#888888'`                       | Axis line and tick color.                                         |

### Font overrides

| Field          | Type     | Default                                   | Description                         |
| -------------- | -------- | ----------------------------------------- | ----------------------------------- |
| `fonts.family` | `string` | `'Inter, -apple-system, ..., sans-serif'` | Primary font family.                |
| `fonts.mono`   | `string` | `'"JetBrains Mono", ..., monospace'`      | Monospace font for tabular numbers. |

### Spacing overrides

| Field               | Type     | Default | Description                              |
| ------------------- | -------- | ------- | ---------------------------------------- |
| `spacing.padding`   | `number` | `12`    | Padding inside the chart container (px). |
| `spacing.chromeGap` | `number` | `4`     | Gap between chrome elements (px).        |

### Other

| Field          | Type     | Default | Description                                              |
| -------------- | -------- | ------- | -------------------------------------------------------- |
| `borderRadius` | `number` | `4`     | Border radius for the chart container and tooltips (px). |

### DEFAULT_THEME reference

The full default theme (from `core/src/theme/defaults.ts`):

| Property                 | Value                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `colors.background`      | `#ffffff`                                                                |
| `colors.text`            | `#1d1d1d`                                                                |
| `colors.gridline`        | `#e8e8e8`                                                                |
| `colors.axis`            | `#888888`                                                                |
| `colors.annotationFill`  | `rgba(0,0,0,0.04)`                                                       |
| `colors.annotationText`  | `#555555`                                                                |
| `fonts.family`           | Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif |
| `fonts.mono`             | "JetBrains Mono", "Fira Code", "Cascadia Code", monospace                |
| `fonts.sizes.title`      | 22                                                                       |
| `fonts.sizes.subtitle`   | 15                                                                       |
| `fonts.sizes.body`       | 13                                                                       |
| `fonts.sizes.small`      | 11                                                                       |
| `fonts.sizes.axisTick`   | 11                                                                       |
| `fonts.weights.normal`   | 400                                                                      |
| `fonts.weights.medium`   | 500                                                                      |
| `fonts.weights.semibold` | 600                                                                      |
| `fonts.weights.bold`     | 700                                                                      |
| `spacing.padding`        | 12                                                                       |
| `spacing.chromeGap`      | 4                                                                        |
| `spacing.chromeToChart`  | 8                                                                        |
| `spacing.chartToFooter`  | 8                                                                        |
| `spacing.axisMargin`     | 6                                                                        |
| `borderRadius`           | 4                                                                        |
| `chrome.title`           | 22px, 700 weight, `#333333`, 1.3 line-height                             |
| `chrome.subtitle`        | 15px, 400 weight, `#666666`, 1.4 line-height                             |
| `chrome.source`          | 12px, 400 weight, `#999999`, 1.3 line-height                             |
| `chrome.byline`          | 12px, 400 weight, `#999999`, 1.3 line-height                             |
| `chrome.footer`          | 12px, 400 weight, `#999999`, 1.3 line-height                             |

---

## DarkMode

Controls dark mode rendering. Source: `core/src/types/spec.ts`.

```ts
type DarkMode = "auto" | "force" | "off";
```

| Value     | Behavior                                                                                 |
| --------- | ---------------------------------------------------------------------------------------- |
| `'auto'`  | Checks `window.matchMedia('(prefers-color-scheme: dark)')`. Adapts to system preference. |
| `'force'` | Always render in dark mode.                                                              |
| `'off'`   | Always render in light mode. This is the default.                                        |

Dark mode resolution happens in the adapter layer (vanilla/React), not the engine. The adapter resolves the `DarkMode` union to a boolean and passes `darkMode: true/false` to the engine's `CompileOptions`. The engine then calls `adaptTheme()` to transform colors: swap background/text, adjust palette brightness, lighten gridlines.

You don't need to define a separate dark theme. The engine handles the color transformations automatically.

---

## TableSpec

Input for data table visualizations. Source: `core/src/types/spec.ts`.

| Field               | Type                              | Default        | Description                                                                       |
| ------------------- | --------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `type`              | `'table'`                         | (required)     | Discriminant. Always `'table'`.                                                   |
| `data`              | `DataRow[]`                       | (required)     | Array of data rows. Must be non-empty.                                            |
| `columns`           | `ColumnConfig[]`                  | (required)     | Column definitions. See [ColumnConfig](#columnconfig).                            |
| `rowKey`            | `string`                          | auto-generated | Field to use as a unique row identifier.                                          |
| `chrome`            | `Chrome`                          | `undefined`    | Editorial text (title, subtitle, source, etc.).                                   |
| `theme`             | `ThemeConfig`                     | `undefined`    | Theme overrides.                                                                  |
| `darkMode`          | `DarkMode`                        | `'off'`        | Dark mode behavior.                                                               |
| `search`            | `boolean`                         | `false`        | Enable client-side search/filter bar.                                             |
| `pagination`        | `boolean \| { pageSize: number }` | `false`        | Enable pagination. `true` uses default page size. Object sets explicit page size. |
| `stickyFirstColumn` | `boolean`                         | `false`        | Freeze the first column during horizontal scroll.                                 |
| `compact`           | `boolean`                         | `false`        | Reduced padding and font sizes.                                                   |
| `responsive`        | `boolean`                         | `true`         | Whether the table adapts to container width.                                      |
| `watermark`         | `boolean`                         | `true`         | Whether to show the tryOpenData.ai watermark. Spec-level value takes precedence over mount/compile options. |

### ColumnConfig

Configuration for a single table column. Source: `core/src/types/table.ts`.

| Field      | Type                            | Default                                   | Description                                                                            |
| ---------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `key`      | `string`                        | (required)                                | Data field key. Must match a key in the data rows.                                     |
| `label`    | `string`                        | same as `key`                             | Display label for the column header.                                                   |
| `sortable` | `boolean`                       | `true`                                    | Whether this column is sortable.                                                       |
| `align`    | `'left' \| 'center' \| 'right'` | `'right'` for numbers, `'left'` otherwise | Text alignment.                                                                        |
| `width`    | `string`                        | auto-sized                                | CSS width like `'200px'` or `'20%'`.                                                   |
| `format`   | `string`                        | none                                      | d3-format or d3-time-format string. e.g. `',.0f'` for numbers, `'%Y-%m-%d'` for dates. |

### Column visual types

Each column can have at most one visual feature. If multiple are set, precedence is: sparkline > bar > heatmap > image > flag > categoryColors.

| Feature         | Config field     | Config type              | Description                                   |
| --------------- | ---------------- | ------------------------ | --------------------------------------------- |
| Heatmap         | `heatmap`        | `HeatmapColumnConfig`    | Color cell background based on numeric value. |
| Inline bar      | `bar`            | `BarColumnConfig`        | Proportional bar in the cell.                 |
| Sparkline       | `sparkline`      | `SparklineColumnConfig`  | Mini line/bar chart from array data.          |
| Image           | `image`          | `ImageColumnConfig`      | Render cell value as an image.                |
| Flag            | `flag`           | `boolean`                | Render cell value as a country flag.          |
| Category colors | `categoryColors` | `Record<string, string>` | Color-code cells by categorical value.        |

#### HeatmapColumnConfig

| Field          | Type                 | Default          | Description                                                                        |
| -------------- | -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `palette`      | `string \| string[]` | theme sequential | Palette name (e.g. `'blue'`, `'redBlue'`) or array of color stops.                 |
| `domain`       | `[number, number]`   | auto from data   | Explicit min/max for the color scale.                                              |
| `colorByField` | `string`             | same column      | Use a different field's values for coloring while displaying this column's values. |

#### BarColumnConfig

| Field      | Type     | Default                 | Description                      |
| ---------- | -------- | ----------------------- | -------------------------------- |
| `maxValue` | `number` | auto from data          | Maximum value for the bar scale. |
| `color`    | `string` | first categorical color | Bar fill color.                  |

#### SparklineColumnConfig

| Field         | Type                          | Default                 | Description                                   |
| ------------- | ----------------------------- | ----------------------- | --------------------------------------------- |
| `type`        | `'line' \| 'bar' \| 'column'` | `'line'`                | Sparkline chart type.                         |
| `valuesField` | `string`                      | same column             | Field containing the array of values to plot. |
| `color`       | `string`                      | first categorical color | Sparkline color.                              |

#### ImageColumnConfig

| Field     | Type      | Default | Description                              |
| --------- | --------- | ------- | ---------------------------------------- |
| `width`   | `number`  | `24`    | Image width in pixels.                   |
| `height`  | `number`  | `24`    | Image height in pixels.                  |
| `rounded` | `boolean` | `false` | Apply border-radius for circular images. |

#### CategoryColorsConfig

```ts
type CategoryColorsConfig = Record<string, string>;
```

Maps category string values to CSS color strings. Only values with an explicit entry in the map get colored. Unmapped values are left unstyled by default.

To highlight specific values (e.g., 3 of 8 rows):

```ts
categoryColors: {
  'Active': '#2a9d8f',
  'Warning': '#f4a261',
  'Critical': '#e76f51',
}
// Other values like 'Inactive', 'Pending', etc. remain unstyled
```

To auto-assign palette colors to all values (including unmapped ones), set `autoAssign: true` on the column config:

```ts
columns: [
  {
    key: 'status',
    categoryColors: { 'Active': '#2a9d8f' },
    autoAssign: true,  // unmapped values get colors from the theme palette
  },
]
```

---

## Event handlers

Interaction callbacks. Source: `core/src/types/events.ts`.

Pass these through `MountOptions` (vanilla) or `ChartProps` (React).

### ChartEventHandlers

| Handler             | Signature                                             | When it fires                                     |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `onMarkClick`       | `(event: MarkEvent) => void`                          | User clicks a data mark (bar, point, line, arc).  |
| `onMarkHover`       | `(event: MarkEvent) => void`                          | Mouse enters a data mark.                         |
| `onMarkLeave`       | `() => void`                                          | Mouse leaves a data mark.                         |
| `onLegendToggle`    | `(series: string, visible: boolean) => void`          | User clicks a legend entry to show/hide a series. |
| `onAnnotationClick` | `(annotation: Annotation, event: MouseEvent) => void` | User clicks an annotation element.                |

### MarkEvent

| Field      | Type                       | Description                                                                                      |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `datum`    | `DataRow`                  | The data row associated with the mark. For line/area marks, this is the first row of the series. |
| `series`   | `string \| undefined`      | Series identifier for multi-series charts. Matches the color encoding field value.               |
| `position` | `{ x: number, y: number }` | Click/hover position relative to the chart container.                                            |
| `event`    | `MouseEvent`               | The raw browser MouseEvent.                                                                      |

### Table event handlers

Table events are passed through `TableMountOptions` (vanilla) or `DataTableProps` (React).

| Handler          | Signature                                | When it fires                                         |
| ---------------- | ---------------------------------------- | ----------------------------------------------------- |
| `onRowClick`     | `(row: Record<string, unknown>) => void` | User clicks a table row.                              |
| `onSortChange`   | `(sort: SortState \| null) => void`      | Sort state changes (React `DataTable` only).          |
| `onSearchChange` | `(query: string) => void`                | Search query changes (React `DataTable` only).        |
| `onPageChange`   | `(page: number) => void`                 | Page changes (React `DataTable` only).                |
| `onStateChange`  | `(state: TableState) => void`            | Any table state changes (vanilla `createTable` only). |

---

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
| `chrome`         | `Chrome`                         | `undefined` | Editorial text.                                                                       |
| `annotations`    | `Annotation[]`                   | `undefined` | Annotations.                                                                          |
| `theme`          | `ThemeConfig`                    | `undefined` | Theme overrides.                                                                      |
| `darkMode`       | `DarkMode`                       | `'off'`     | Dark mode behavior.                                                                   |
| `watermark`      | `boolean`                        | `true`      | Whether to show the tryOpenData.ai watermark. Spec-level value takes precedence over mount/compile options. |

### GraphEncoding

Each channel is a `GraphEncodingChannel` with `field`, optional `type`, and optional `scale` (same `ScaleConfig` as chart encodings). When `scale.domain` and `scale.range` are provided, the engine uses them directly instead of auto-deriving from the data. This is useful for controlling deterministic color assignment.

| Channel     | Field type constraint          | Purpose                                  |
| ----------- | ------------------------------ | ---------------------------------------- |
| `nodeColor` | nominal, ordinal, quantitative | Color mapping for nodes.                 |
| `nodeSize`  | quantitative                   | Size mapping for nodes (3-12px radius).  |
| `edgeColor` | nominal, ordinal, quantitative | Color mapping for edges.                 |
| `edgeWidth` | quantitative                   | Width mapping for edges (0.5-4px).       |
| `edgeStyle` | nominal, ordinal               | Line style mapping (solid/dashed/dotted).|
| `nodeLabel` | any                            | Label field for nodes.                   |

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
| `nodeLabelAlign`| `string`          | `'auto'`    | Label placement: `'auto'`, `'left'`, `'right'`.                                    |
| `valueFormat`   | `string`          | `undefined` | d3-format string for values in tooltips and ARIA labels (e.g. `"$,.0f"`, `"~s"`).  |
| `chrome`        | `Chrome`          | `undefined` | Editorial text (title, subtitle, source, byline, footer).                           |
| `legend`        | `LegendConfig`    | `undefined` | Legend display configuration.                                                       |
| `theme`         | `ThemeConfig`     | `undefined` | Theme overrides.                                                                    |
| `darkMode`      | `DarkMode`        | `'off'`     | Dark mode behavior.                                                                 |
| `watermark`     | `boolean`         | `true`      | Whether to show the tryOpenData.ai watermark.                                       |
| `animation`     | `AnimationSpec`   | `undefined` | Entrance animation configuration. Sankey charts support entrance animations only.   |

### SankeyEncoding

| Channel   | Type                               | Required | Description                           |
| --------- | ---------------------------------- | -------- | ------------------------------------- |
| `source`  | `EncodingChannel`                  | yes      | Source node field (nominal).          |
| `target`  | `EncodingChannel`                  | yes      | Target node field (nominal).          |
| `value`   | `EncodingChannel`                  | yes      | Flow value field (quantitative).      |
| `color`   | `EncodingChannel`                  | no       | Color encoding for nodes/links.       |
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

---

## Complete spec examples

### Line chart

```ts
const spec: ChartSpec = {
  mark: "line",
  data: [
    { date: "2023-01-01", revenue: 42000, region: "North" },
    { date: "2023-04-01", revenue: 58000, region: "North" },
    { date: "2023-07-01", revenue: 63000, region: "North" },
    { date: "2023-01-01", revenue: 31000, region: "South" },
    { date: "2023-04-01", revenue: 44000, region: "South" },
    { date: "2023-07-01", revenue: 52000, region: "South" },
  ],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "revenue",
      type: "quantitative",
      axis: { label: "Revenue ($)", format: ",.0f" },
    },
    color: { field: "region", type: "nominal" },
  },
  chrome: {
    title: "Revenue by region",
    subtitle: "Quarterly results, 2023",
    source: "Source: Finance team",
  },
  labels: { density: "endpoints" },
  annotations: [
    { type: "refline", y: 50000, label: "Target", style: "dashed" },
  ],
};
```

[Live example](https://tryopendata.github.io/openchart/?story=line--multi-series)

### Area chart

```ts
const spec: ChartSpec = {
  mark: "area",
  data: [
    { month: "2024-01", users: 1200 },
    { month: "2024-02", users: 1800 },
    { month: "2024-03", users: 2400 },
    { month: "2024-04", users: 3100 },
  ],
  encoding: {
    x: { field: "month", type: "temporal" },
    y: { field: "users", type: "quantitative" },
  },
  chrome: { title: "User growth" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=line--area-chart)

### Bar chart (horizontal)

```ts
const spec: ChartSpec = {
  mark: "bar",
  data: [
    { language: "Python", popularity: 29 },
    { language: "JavaScript", popularity: 24 },
    { language: "TypeScript", popularity: 17 },
    { language: "Java", popularity: 14 },
    { language: "Go", popularity: 10 },
  ],
  encoding: {
    x: { field: "popularity", type: "quantitative" },
    y: { field: "language", type: "nominal" },
  },
  chrome: { title: "Language popularity" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=bar--simple-bars)

### Column chart (vertical bars)

```ts
const spec: ChartSpec = {
  mark: "bar",
  data: [
    { month: "Jan", sales: 120 },
    { month: "Feb", sales: 180 },
    { month: "Mar", sales: 240 },
    { month: "Apr", sales: 210 },
  ],
  encoding: {
    x: { field: "month", type: "nominal" },
    y: { field: "sales", type: "quantitative" },
  },
  chrome: { title: "Monthly sales" },
  labels: { density: "all", format: ",.0f" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=column--simple-columns)

### Pie chart

```ts
const spec: ChartSpec = {
  mark: "arc",
  data: [
    { category: "Desktop", share: 58 },
    { category: "Mobile", share: 35 },
    { category: "Tablet", share: 7 },
  ],
  encoding: {
    y: { field: "share", type: "quantitative" },
    color: { field: "category", type: "nominal" },
  },
  chrome: { title: "Traffic by device" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=pie--basic-pie)

### Donut chart

```ts
const spec: ChartSpec = {
  mark: { type: "arc", innerRadius: 40 },
  data: [
    { status: "Complete", count: 42 },
    { status: "In Progress", count: 18 },
    { status: "Blocked", count: 5 },
  ],
  encoding: {
    y: { field: "count", type: "quantitative" },
    color: { field: "status", type: "nominal" },
  },
  chrome: { title: "Task status" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=pie--donut-chart)

### Scatter chart

```ts
const spec: ChartSpec = {
  mark: "point",
  data: [
    { gdp: 21400, lifeExp: 78.9, country: "USA", pop: 331 },
    { gdp: 40300, lifeExp: 83.4, country: "Switzerland", pop: 8.6 },
    { gdp: 1900, lifeExp: 69.4, country: "India", pop: 1380 },
    { gdp: 10500, lifeExp: 76.9, country: "China", pop: 1400 },
  ],
  encoding: {
    x: {
      field: "gdp",
      type: "quantitative",
      axis: { label: "GDP per capita ($)" },
    },
    y: {
      field: "lifeExp",
      type: "quantitative",
      axis: { label: "Life expectancy" },
    },
    size: { field: "pop", type: "quantitative" },
    color: { field: "country", type: "nominal" },
  },
  chrome: { title: "GDP vs life expectancy" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=scatter--bubble-chart)

### Dot plot

```ts
const spec: ChartSpec = {
  mark: "circle",
  data: [
    { team: "Engineering", satisfaction: 8.2 },
    { team: "Design", satisfaction: 7.9 },
    { team: "Sales", satisfaction: 6.5 },
    { team: "Support", satisfaction: 7.1 },
  ],
  encoding: {
    x: { field: "satisfaction", type: "quantitative" },
    y: { field: "team", type: "nominal" },
  },
  chrome: { title: "Team satisfaction scores" },
};
```

[Live example](https://tryopendata.github.io/openchart/?story=dot--simple-dot-plot)

### Data table

```ts
const spec: TableSpec = {
  type: "table",
  data: [
    {
      city: "San Francisco",
      temp: 18.2,
      pop: 874961,
      trend: [15, 16, 17, 18, 19, 18],
    },
    {
      city: "New York",
      temp: 12.8,
      pop: 8336817,
      trend: [8, 10, 14, 18, 16, 12],
    },
    {
      city: "Austin",
      temp: 20.5,
      pop: 978908,
      trend: [12, 15, 20, 25, 22, 18],
    },
  ],
  columns: [
    { key: "city", label: "City" },
    {
      key: "temp",
      label: "Avg Temp (C)",
      format: ".1f",
      heatmap: { palette: "redBlue" },
    },
    { key: "pop", label: "Population", format: ",.0f", bar: {} },
    {
      key: "trend",
      label: "6-Month Trend",
      sparkline: { type: "line", valuesField: "trend" },
    },
  ],
  chrome: { title: "City comparison" },
  search: true,
  pagination: { pageSize: 25 },
  stickyFirstColumn: true,
};
```

[Live example](https://tryopendata.github.io/openchart/?story=table-basic--basic)

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
| `darkMode`    | `DarkMode`     | Dark mode behavior.                        |
| `watermark`   | `boolean`      | Whether to show the tryOpenData.ai watermark. Spec-level value takes precedence over mount/compile options; defaults to `true`. |

`FieldRef` is `string | EncodingChannel`. When a string is provided, `inferFieldType()` samples up to 20 data values to determine the encoding type (quantitative, temporal, or nominal).

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

## Validation

The engine validates specs at runtime. Source: `engine/src/compiler/validate.ts`.

```ts
import { validateSpec } from "@opendata-ai/openchart-engine";

const result = validateSpec(spec);
// result.valid: boolean
// result.errors: ValidationError[]
// result.normalized: VizSpec | null
```

### ValidationError

| Field        | Type                  | Description                                                   |
| ------------ | --------------------- | ------------------------------------------------------------- |
| `message`    | `string`              | Human-readable error description.                             |
| `path`       | `string \| undefined` | Dot-path to the field that failed, e.g. `'encoding.x.field'`. |
| `code`       | `ValidationErrorCode` | Machine-readable error code.                                  |
| `suggestion` | `string`              | Actionable fix suggestion.                                    |

### ValidationErrorCode

| Code                 | Meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `INVALID_TYPE`       | Wrong type (expected object, got array, etc.).                                  |
| `MISSING_FIELD`      | Required field is missing.                                                      |
| `INVALID_VALUE`      | Field has an invalid value (bad chart type, bad dark mode string, etc.).        |
| `EMPTY_DATA`         | Data array is empty.                                                            |
| `DATA_FIELD_MISSING` | Encoding references a field that doesn't exist in the data.                     |
| `ENCODING_MISMATCH`  | Encoding type doesn't match the channel requirements or the actual data values. |

---

## Related docs

- [Chart types](chart-types.md) for a visual gallery with boilerplate specs and live examples
- [Tables](tables.md) for data table features (heatmaps, sparklines, flags, and more)
- [Graphs](graphs.md) for network/relationship visualizations
- [Getting started](getting-started.md) for a hands-on tutorial
- [Architecture](architecture.md) for how the packages and compilation pipeline work
- [Integration guide](integration-guide.md) for building apps on top of the library
