# @opendata-ai/openchart-core

Types, spec builders, formatters, and palettes for the OpenChart visualization library.

This is the foundation package. It has no DOM dependencies and runs in any JavaScript environment. The framework packages (`openchart-react`, `openchart-vue`, `openchart-svelte`) all depend on it.

## Install

```bash
npm install @opendata-ai/openchart-core
```

## Spec builders

Convenience functions that create chart and table specs from data. They infer field types automatically (quantitative, temporal, nominal) by sampling your data, so you don't have to specify types manually.

```typescript
import { lineChart, columnChart, barChart } from '@opendata-ai/openchart-core';

const line = lineChart(data, 'date', 'value');
const columns = columnChart(data, 'month', 'revenue');
const bars = barChart(data, 'category', 'count');
```

All chart builders accept an optional `options` argument for color encoding, annotations, chrome (title/subtitle/source), theme overrides, and dark mode.

```typescript
const spec = lineChart(data, 'date', 'value', {
  color: 'region',
  chrome: { title: 'Sales by Region', subtitle: 'Q1 2025' },
});
```

### Available builders

| Function | Chart type | Params |
|----------|-----------|--------|
| `lineChart(data, x, y, options?)` | Line | x/y position fields |
| `barChart(data, category, value, options?)` | Horizontal bar | category on y-axis, value on x-axis |
| `columnChart(data, x, y, options?)` | Vertical column | x/y position fields |
| `pieChart(data, category, value, options?)` | Pie | category for color, value for size |
| `donutChart(data, category, value, options?)` | Donut | category for color, value for size |
| `areaChart(data, x, y, options?)` | Area | x/y position fields |
| `dotChart(data, x, y, options?)` | Dot/strip | x/y position fields |
| `scatterChart(data, x, y, options?)` | Scatter | x/y position fields |
| `dataTable(data, options?)` | Data table | columns auto-generated if omitted |

Field refs can be a plain string (field name) or a full `EncodingChannel` object when you need control over type, axis, scale, or aggregation.

## dataTable()

The table builder is worth calling out specifically. If you pass data without a `columns` config, it auto-generates column definitions from your data keys. It infers types from the values: numbers get right-aligned, text gets left-aligned.

```typescript
import { dataTable } from '@opendata-ai/openchart-core';

// Columns auto-generated from data keys
const spec = dataTable([
  { name: 'Alice', age: 30, city: 'Portland' },
  { name: 'Bob', age: 25, city: 'Seattle' },
]);
// age column auto-detected as quantitative, right-aligned
// name and city columns detected as nominal, left-aligned
```

For more control, pass explicit column configs:

```typescript
const spec = dataTable(data, {
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age', align: 'right' },
  ],
  search: true,
  pagination: { pageSize: 20 },
});
```

## StoredVizSpec types

When you need to persist specs without bulky data arrays (for storage, serialization, or database records), use the data-stripped type variants:

```typescript
import type {
  StoredVizSpec,
  ChartSpecWithoutData,
  TableSpecWithoutData,
  GraphSpecWithoutData,
} from '@opendata-ai/openchart-core';

// Store the spec shape without data
const stored: ChartSpecWithoutData = {
  type: 'line',
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

// StoredVizSpec is the union of all three
function saveSpec(spec: StoredVizSpec) {
  localStorage.setItem('viz', JSON.stringify(spec));
}
```

## Type guards

Runtime narrowing for `VizSpec` values. Useful when you have a generic spec and need to branch on its type:

```typescript
import { isChartSpec, isTableSpec, isGraphSpec } from '@opendata-ai/openchart-core';
import type { VizSpec } from '@opendata-ai/openchart-core';

function describe(spec: VizSpec): string {
  if (isChartSpec(spec)) return `Chart: ${spec.type}`;
  if (isTableSpec(spec)) return 'Data table';
  if (isGraphSpec(spec)) return 'Network graph';
}
```

## Other exports

Beyond spec builders, this package provides:

- **Theme system** - `DEFAULT_THEME`, `resolveTheme()`, `adaptTheme()` for dark mode adaptation
- **Color palettes** - `CATEGORICAL_PALETTE`, `SEQUENTIAL_PALETTES`, `DIVERGING_PALETTES`
- **Accessibility** - `generateAltText()`, `generateAriaLabels()`, contrast ratio utilities
- **Formatting** - `formatNumber()`, `formatDate()`, `abbreviateNumber()`
- **Layout** - `computeChrome()`, `estimateTextWidth()`, responsive breakpoints
- **Label collision** - `resolveCollisions()` for automatic label placement
