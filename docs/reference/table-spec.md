---
title: "TableSpec"
description: "TableSpec and ColumnConfig fields, the column visual types, and a complete data table example."
section: spec
order: 11
---
<!-- phase-4-stub -->

# TableSpec

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
| `search`            | `boolean`                         | `false`        | Enable client-side search/filter bar.                                             |
| `pagination`        | `boolean \| { pageSize: number }` | `false`        | Enable pagination. `true` uses default page size. Object sets explicit page size. |
| `stickyFirstColumn` | `boolean`                         | `false`        | Freeze the first column during horizontal scroll.                                 |
| `density`           | `'condensed' \| 'regular' \| 'relaxed'` | `'regular'` | Row height: condensed 40px, regular 48px, relaxed 56px. An explicit value always wins over the responsive auto-condense. |
| `striped`           | `boolean`                         | `false`        | Zebra striping on body rows. Hairlines only by default.                           |
| `sort`              | `SortState`                       | first inline-bar column, descending | Initial sort applied before the user touches a header. `{ column: string, direction: 'asc' \| 'desc' }`. |
| `totalRow`          | `boolean \| { label?: string }`   | `false`        | Sticky footer summing every quantitative column over the filtered rows (the whole result set, not just the current page). `true` uses the label `'Total'`. |
| `responsive`        | `boolean`                         | `true`         | Whether the table adapts to container width.                                      |
| `watermark`         | `boolean`                         | `true`         | Whether to show the tryOpenData.ai watermark. Mount/compile options take precedence over spec and active breakpoint values. |

### ColumnConfig

Configuration for a single table column. Source: `core/src/types/table.ts`.

| Field      | Type                            | Default                                   | Description                                                                            |
| ---------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `key`      | `string`                        | (required)                                | Data field key. Must match a key in the data rows.                                     |
| `label`    | `string`                        | same as `key`                             | Display label for the column header.                                                   |
| `sortable` | `boolean`                       | `true`                                    | Whether this column is sortable.                                                       |
| `align`    | `'left' \| 'center' \| 'right'` | `'right'` for numbers, `'left'` otherwise | Text alignment.                                                                        |
| `width`    | `string`                        | auto-sized                                | CSS width like `'200px'` or `'20%'` (percent of the table width). An explicit width is fixed, not flex: it is honored as-is and never scaled up to fill the container, and the remaining space is shared by the auto-sized columns. When the explicit widths overflow the space left for them, they are scaled down proportionally (floored at 60px) and the engine emits a `TABLE_WIDTH_OVERFLOW` warning through `onWarn`; if the floor engages the table still overflows. |
| `format`   | `string`                        | none                                      | d3-format or d3-time-format string (e.g. `',.0f'`, `'%Y-%m-%d'`), or a semantic keyword: `'percent'`, `'currency'`, `'ordinal'`, `'compact'`. Tables show full precision by default; `'compact'` opts a column into the chart-surface abbreviation (1.2k, 3.4M). |
| `type`     | `'quantitative' \| 'nominal' \| 'ordinal' \| 'temporal'` | inferred from the data     | Field type, Vega-Lite style. Drives alignment (quantitative right, everything else left) and which columns the total row sums. Number-valued keys that read as identifiers (`id`, `zip`, `postalCode`, `year`, `fips`, in either snake_case or camelCase) infer `nominal`. |
| `priority` | `1 \| 2 \| 3`                   | `1` for the first column, `2` elsewhere   | Mobile priority for cards mode (below 400px): `1` renders first and spans the row, `2` renders as a label/value pair, `3` is hidden. |
| `total`    | `boolean`                       | `true`                                    | Whether this column contributes a sum to the `totalRow` footer. Only quantitative text/bar/heatmap columns are summable in the first place; `false` leaves the total cell blank (e.g. a column of rates or averages, where a sum is nonsense). |

### Column visual types

Each column can have at most one visual feature. If multiple are set, precedence is: sparkline > bar > delta > heatmap > image > flag > categoryColors.

| Feature         | Config field     | Config type              | Description                                   |
| --------------- | ---------------- | ------------------------ | --------------------------------------------- |
| Heatmap         | `heatmap`        | `HeatmapColumnConfig`    | Color cell background based on numeric value. |
| Inline bar      | `bar`            | `BarColumnConfig`        | Proportional bar in the cell.                 |
| Delta chip      | `delta`          | `boolean \| DeltaColumnConfig` | Signed, colored change chip (up 2.4%). |
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
| `domain`      | `'shared' \| 'row' \| [number, number]` | `'shared'`    | Value domain each row is normalized against. `'shared'` computes one extent across every row so heights are comparable down the column; `'row'` normalizes each row against its own min/max (maximises shape, loses comparability); a tuple sets an explicit extent. |

#### DeltaColumnConfig

| Field    | Type      | Default | Description                                                                                     |
| -------- | --------- | ------- | ----------------------------------------------------------------------------------------------- |
| `invert` | `boolean` | `false` | Flip the color valence so negative values read as positive. Use for metrics where down is good (churn, latency, cost). |

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

[Live example](https://tryopendata.github.io/openchart/?story=tables--tables#basic)
