# Spec reference

The definitive field-by-field reference for every type in `VizSpec`. Cross-referenced against the TypeScript source in `@opendata-ai/openchart-core/src/types/`.

All types are importable from `@opendata-ai/openchart-core` or from the convenience re-exports in `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`, and `@opendata-ai/openchart-engine`.

## Contents

- [VizSpec](#vizspec) (top-level union type)
- [ChartSpec](#chartspec) (line, area, bar, column, pie, donut, dot, scatter)
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
- [Spec builder functions](#spec-builder-functions) (lineChart, barChart, etc.)
- [Validation](#validation) (validateSpec, error codes)

## VizSpec

The top-level type is a discriminated union on the `type` field:

```ts
type VizSpec = ChartSpec | TableSpec | GraphSpec;
```

Use `type` to select which spec shape you're building:

- Chart types (`line`, `area`, `bar`, `column`, `pie`, `donut`, `dot`, `scatter`) produce a `ChartSpec`
- `table` produces a `TableSpec`
- `graph` produces a `GraphSpec`

Type guards are available: `isChartSpec(spec)`, `isTableSpec(spec)`, `isGraphSpec(spec)`.

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
| `watermark`   | `boolean`      | `true`      | Whether to show the tryOpenData.ai watermark. Set to `false` to hide it.                     |

### DataRow

```ts
type DataRow = Record<string, unknown>;
```

A plain object with string keys. Values can be numbers, strings, dates, nulls, arrays (for sparklines), or booleans. The engine inspects values at runtime to validate encoding types.

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
  title?: string | ChromeText;
  subtitle?: string | ChromeText;
  source?: string | ChromeText;
  byline?: string | ChromeText;
  footer?: string | ChromeText;
}
```

Each field accepts either a plain string or a `ChromeText` object for style overrides.

| Field      | Position         | Default style                 |
| ---------- | ---------------- | ----------------------------- |
| `title`    | Top, above chart | 22px, bold (700), `#333333`   |
| `subtitle` | Below title      | 15px, normal (400), `#666666` |
| `source`   | Below chart area | 12px, normal (400), `#999999` |
| `byline`   | Below source     | 12px, normal (400), `#999999` |
| `footer`   | Below byline     | 12px, normal (400), `#999999` |

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
| `label`       | `string`           | `undefined`            | Range label text.                                           |
| `labelOffset` | `AnnotationOffset` | `undefined`            | Pixel offset for the label. `{ dx?: number, dy?: number }`. |
| `labelAnchor` | `AnnotationAnchor` | `'auto'`               | Label placement direction.                                  |
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
| `watermark`         | `boolean`                         | `true`         | Whether to show the tryOpenData.ai watermark.                                     |

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

Maps category string values to CSS color strings. Cells with matching values get the assigned color as background.

```ts
categoryColors: {
  'Active': '#2a9d8f',
  'Inactive': '#e76f51',
  'Pending': '#f4a261',
}
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
| `watermark`      | `boolean`                        | `true`      | Whether to show the tryOpenData.ai watermark.                                         |

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
| `watermark`   | `boolean`      | Whether to show the tryOpenData.ai watermark. Defaults to `true`. |

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

- [Getting started](getting-started.md) for a hands-on tutorial
- [Architecture](architecture.md) for how the packages and compilation pipeline work
- [Integration guide](integration-guide.md) for building apps on top of the library
