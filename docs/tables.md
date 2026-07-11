# Tables

Data tables with built-in sorting, search, pagination, and visual column types. Tables use the `TableSpec` type and render through the `<DataTable>` component (or `createTable` in vanilla JS).

## Quick start

```tsx
import { DataTable } from "@opendata-ai/openchart-react";

const spec = {
  type: "table",
  data: [
    { city: "San Francisco", temp: 18.2, pop: 874961 },
    { city: "New York", temp: 12.8, pop: 8336817 },
    { city: "Austin", temp: 20.5, pop: 978908 },
  ],
  columns: [
    { key: "city", label: "City" },
    { key: "temp", label: "Avg Temp (C)", format: ".1f" },
    { key: "pop", label: "Population", format: ",.0f" },
  ],
  chrome: { title: "City comparison" },
  search: true,
};

<DataTable spec={spec} />
```

For Vue, import from `@opendata-ai/openchart-vue`. For Svelte, import from `@opendata-ai/openchart-svelte`. For vanilla JS, use `createTable(container, spec)` from `@opendata-ai/openchart-vanilla`.

**Live example**: [Basic table](https://tryopendata.github.io/openchart/?story=tables--tables#basic)

---

## Column visual types

Each column can have one visual feature. These turn plain numbers into scannable visual patterns.

### Heatmap

Color cell backgrounds based on numeric values. Good for spotting high/low values at a glance.

```ts
{
  key: "temp",
  label: "Avg Temp (C)",
  format: ".1f",
  heatmap: { palette: "redBlue" },
}
```

| Config field  | Type                 | Default          | Description |
|---------------|----------------------|------------------|-------------|
| `palette`     | `string \| string[]` | theme sequential | Palette name (`'blue'`, `'redBlue'`) or array of color stops |
| `domain`      | `[number, number]`   | auto from data   | Explicit min/max for the color scale |
| `colorByField`| `string`             | same column      | Use a different field's values for coloring |

**Live examples**: [Heatmap table](https://tryopendata.github.io/openchart/?story=tables--tables#heatmap-cells) | [Election results](https://tryopendata.github.io/openchart/?story=tables--tables#heatmap-cells)

### Inline bar

Proportional bars within cells. Makes relative magnitudes immediately visible.

```ts
{
  key: "pop",
  label: "Population",
  format: ",.0f",
  bar: {},
}
```

| Config field | Type     | Default                 | Description |
|-------------|----------|-------------------------|-------------|
| `maxValue`  | `number` | auto from data          | Maximum value for the bar scale |
| `color`     | `string` | first categorical color | Bar fill color |

### Sparkline

Mini charts embedded in cells. Use for showing trends within a row.

```ts
{
  key: "trend",
  label: "6-Month Trend",
  sparkline: { type: "line", valuesField: "trend" },
}
```

The data for sparklines is an array stored in the row: `{ trend: [15, 16, 17, 18, 19, 18] }`.

| Config field  | Type                          | Default                 | Description |
|--------------|-------------------------------|-------------------------|-------------|
| `type`       | `'line' \| 'bar' \| 'column'` | `'line'`                | Sparkline chart type |
| `valuesField`| `string`                      | same column             | Field containing the array of values |
| `color`      | `string`                      | first categorical color | Sparkline color |

**Live examples**: [Stock sparklines](https://tryopendata.github.io/openchart/?story=tables--tables#sparkline-cells) | [Revenue columns](https://tryopendata.github.io/openchart/?story=tables--tables#sparkline-cells)

### Flag

Render country names or codes as flag emojis.

```ts
{
  key: "country",
  label: "Country",
  flag: true,
}
```

**Live examples**: [Flags table](https://tryopendata.github.io/openchart/?story=tables--tables#flag-cells) | [Country comparison](https://tryopendata.github.io/openchart/?story=tables--tables#flag-cells)

### Image

Display cell values as images (URLs).

```ts
{
  key: "avatar",
  label: "Photo",
  image: { width: 32, height: 32, rounded: true },
}
```

| Config field | Type      | Default | Description |
|-------------|-----------|---------|-------------|
| `width`     | `number`  | `24`    | Image width in pixels |
| `height`    | `number`  | `24`    | Image height in pixels |
| `rounded`   | `boolean` | `false` | Circular crop |

### Category colors

Color-code cells by categorical value.

```ts
{
  key: "status",
  label: "Status",
  categoryColors: {
    "Active": "#2a9d8f",
    "Inactive": "#e76f51",
    "Pending": "#f4a261",
  },
}
```

---

## Interactive features

All features are opt-in via top-level `TableSpec` properties.

| Feature | Config | Default | Description |
|---------|--------|---------|-------------|
| Sorting | `columns[].sortable` | `true` | Click column headers to sort. Set `false` on individual columns to disable. |
| Search | `search: true` | `false` | Shows a search/filter bar above the table |
| Pagination | `pagination: { pageSize: 25 }` | `false` | Paginate rows. Use `true` for default page size or an object to set it explicitly. |
| Sticky first column | `stickyFirstColumn: true` | `false` | Freeze the first column during horizontal scroll |
| Compact mode | `compact: true` | `false` | Reduced padding and font sizes for dense data |
| Responsive | `responsive: true` | `true` | Table adapts to container width |

### Full-featured example

```ts
const spec = {
  type: "table",
  data: myData,
  columns: [
    { key: "name", label: "Company", sortable: true },
    { key: "revenue", label: "Revenue", format: "$,.0f", bar: {} },
    { key: "growth", label: "Growth", format: "+.1f%", heatmap: { palette: "redBlue" } },
    { key: "sparkline", label: "12-Month", sparkline: { type: "line", valuesField: "sparkline" } },
  ],
  chrome: { title: "Company performance" },
  search: true,
  pagination: { pageSize: 20 },
  stickyFirstColumn: true,
};
```

---

## Event handling

Tables support interaction callbacks for building drill-down interfaces and controlled components.

| Handler | Signature | When it fires |
|---------|-----------|---------------|
| `onRowClick` | `(row: Record<string, unknown>) => void` | User clicks a table row |
| `onSortChange` | `(sort: SortState \| null) => void` | Sort state changes |
| `onSearchChange` | `(query: string) => void` | Search query changes |
| `onPageChange` | `(page: number) => void` | Page changes |
| `onStateChange` | `(state: TableState) => void` | Any table state changes (vanilla only) |

For controlled component patterns and detailed event handling, see the [integration guide](integration-guide.md).

---

## Related docs

- [Spec reference: TableSpec](spec-reference.md#tablespec) for field-by-field type details
- [Spec reference: ColumnConfig](spec-reference.md#columnconfig) for all column configuration options
- [Chart types](chart-types.md) for standard chart visualizations
- [Graphs](graphs.md) for network visualizations
- [Integration guide](integration-guide.md) for advanced table patterns
