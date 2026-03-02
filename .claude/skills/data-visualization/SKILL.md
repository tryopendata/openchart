---
name: data-visualization
description: >
  Generates @opendata-ai chart and table specs from data. Use when creating
  visualizations, building charts, rendering data tables, generating VizSpec JSON,
  or answering questions about @opendata-ai types and encoding rules.
---

# Data Visualization with @opendata-ai

**Core concept:** Write a VizSpec JSON object, render with `<Chart spec={spec} />` (React) or `createChart(container, spec)` (vanilla JS). The engine validates, compiles, and renders. Specs are plain JSON, no imperative drawing.

## Chart Selection Decision Tree

```
Single value to highlight    -> Use chrome.title as a big number display
Temporal x-axis column?      -> 1 series: line | 2-5 series: line + color | 6+: filter to top 5
Categorical + numeric?       -> Ranked list: bar (horizontal) | Periodic (Q1, Jan): column | 2-6 composition: donut
Two numeric columns?         -> scatter (optional size/color for 3rd/4th dims)
Categorical + series + num?  -> stacked bar or stacked column (use color for series)
Distribution/spread?         -> dot (strip plot)
Default                      -> bar
```

## Chart Type Quick Reference

| Type      | Required encoding                            | Optional encoding   | Best for                             |
| --------- | -------------------------------------------- | ------------------- | ------------------------------------ |
| `line`    | x: temporal/ordinal, y: quantitative         | color, size, detail | Trends over time                     |
| `area`    | x: temporal/ordinal, y: quantitative         | color, size, detail | Trends with volume emphasis          |
| `bar`     | x: quantitative, y: nominal/ordinal          | color, size, detail | Rankings, comparisons (horizontal)   |
| `column`  | x: nominal/ordinal/temporal, y: quantitative | color, size, detail | Periodic data, categories (vertical) |
| `pie`     | y: quantitative, color: nominal/ordinal      | size, detail        | Part-to-whole (2-5 categories max)   |
| `donut`   | y: quantitative, color: nominal/ordinal      | size, detail        | Part-to-whole (prefer over pie)      |
| `dot`     | x: quantitative, y: nominal/ordinal          | color, size, detail | Distribution, strip plots            |
| `scatter` | x: quantitative, y: quantitative             | color, size, detail | Correlation between two variables    |

**Bar vs Column:** Bar = horizontal (category on y-axis). Column = vertical (category on x-axis). Use bar for ranked lists (easier to read labels). Use column for time periods.

**Pie vs Donut:** Both use y + color (no x). Donut is preferred. Keep categories under 6.

## ChartSpec Field Reference

```typescript
{
  type: ChartType,           // REQUIRED: "line"|"area"|"bar"|"column"|"pie"|"donut"|"dot"|"scatter"
  data: DataRow[],           // REQUIRED: array of objects, min 1 row
  encoding: {                // REQUIRED: maps data fields to visual channels
    x?: {                    //   position channel
      field: string,         //     REQUIRED: column name in data
      type: FieldType,       //     REQUIRED: "quantitative"|"temporal"|"nominal"|"ordinal"
      aggregate?: AggregateOp, //   "count"|"sum"|"mean"|"median"|"min"|"max"
      axis?: {
        label?: string,      //     axis label (default: field name)
        format?: string,     //     d3-format string, e.g. ",.0f" "$,.2f" ".1%"
        tickCount?: number,  //     override tick count
        grid?: boolean,      //     show gridlines
      },
      scale?: {
        domain?: [number, number] | string[], // explicit domain
        type?: "linear"|"log"|"time"|"band"|"point"|"ordinal",
        nice?: boolean,      //     clean tick values (default: true)
        zero?: boolean,      //     include zero (default: true for quantitative)
      },
    },
    y?: EncodingChannel,     //   same structure as x
    color?: EncodingChannel, //   series differentiation (nominal/ordinal)
    size?: EncodingChannel,  //   bubble size (quantitative)
    detail?: EncodingChannel,//   group without visual mapping
  },
  chrome?: {                 // editorial text elements
    title?: string | { text: string, style?: ChromeTextStyle },
    subtitle?: string | { text: string, style?: ChromeTextStyle },
    source?: string | { text: string, style?: ChromeTextStyle },
    byline?: string | { text: string, style?: ChromeTextStyle },
    footer?: string | { text: string, style?: ChromeTextStyle },
  },
  annotations?: Annotation[],  // see Annotation Reference below
  labels?: {
    density?: "all"|"auto"|"endpoints"|"none",  // default: "auto"
    format?: string,         // d3-format for label values
  },
  responsive?: boolean,      // default: true
  theme?: ThemeConfig,        // see Theme Reference below
  darkMode?: "auto"|"force"|"off",  // default: "off"
}
```

**ChromeTextStyle:** `{ fontSize?: number, fontWeight?: number, fontFamily?: string, color?: string }`

## TableSpec Field Reference

```typescript
{
  type: "table",             // REQUIRED
  data: DataRow[],           // REQUIRED: array of objects, min 1 row
  columns: ColumnConfig[],   // REQUIRED: column definitions
  rowKey?: string,           // unique row identifier field
  chrome?: Chrome,           // same as chart chrome
  theme?: ThemeConfig,
  darkMode?: DarkMode,
  search?: boolean,          // enable search/filter
  pagination?: boolean | { pageSize: number },
  stickyFirstColumn?: boolean, // stick first column on horizontal scroll
  compact?: boolean,         // reduced padding and font sizes
  responsive?: boolean,      // default: true
}
```

**ColumnConfig:**

```typescript
{
  key: string,               // REQUIRED: data field name
  label?: string,            // header label (default: key)
  sortable?: boolean,        // default: true
  align?: "left"|"center"|"right",  // default: "left" text, "right" numbers
  width?: string,            // CSS value: "200px" or "20%"
  format?: string,           // d3-format or d3-time-format

  // Visual features (pick ONE per column):
  heatmap?: {
    palette?: string | string[],  // palette name or color stops
    domain?: [number, number],    // explicit min/max
    colorByField?: string,        // color by a different field
  },
  bar?: {
    maxValue?: number,       // bar scale max (auto-derived if omitted)
    color?: string,          // bar fill color
  },
  sparkline?: {
    type?: "line"|"bar"|"column",  // default: "line"
    valuesField?: string,    // field with array of values
    color?: string,
  },
  image?: {
    width?: number,          // default: 24
    height?: number,         // default: 24
    rounded?: boolean,
  },
  flag?: boolean,            // country flag from cell value
  categoryColors?: Record<string, string>,  // value -> CSS color map
}
```

## Annotation Reference

Three types, all with shared base: `label?: string, fill?: string, stroke?: string, opacity?: number, zIndex?: number`

**Text annotation** (callout at a data point):

```typescript
{ type: "text", x: value, y: value, text: "string",
  fontSize?: number, fontWeight?: number,
  offset?: { dx?: number, dy?: number },
  anchor?: "top"|"bottom"|"left"|"right"|"auto",
  connector?: boolean }  // default: true, draws line from label to point
```

**Range annotation** (highlighted region):

```typescript
{ type: "range",
  x1?: value, x2?: value,  // vertical band
  y1?: value, y2?: value,  // horizontal band (or both for rectangle)
  labelOffset?: { dx?: number, dy?: number },
  labelAnchor?: AnnotationAnchor }
```

**Reference line** (horizontal or vertical threshold):

```typescript
{ type: "refline",
  x?: value,               // vertical line
  y?: value,               // horizontal line
  style?: "solid"|"dashed"|"dotted",
  strokeWidth?: number,
  labelOffset?: { dx?: number, dy?: number },
  labelAnchor?: AnnotationAnchor }
```

## Chrome Best Practices

**Title formula:** State the insight, not the chart description.

- Good: "Remote work doubled after 2020"
- Bad: "Line chart of remote work percentage over time"

**Subtitle:** Provide context the title can't. Units, time range, methodology.

- "Share of US workers fully remote, 2015-2024"

**Source:** Always include for credibility. Format: "Source: Organization Name"

## Label Density

| Mode        | Behavior                                 | Use when                               |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `auto`      | Show labels with collision detection     | Default, most charts                   |
| `all`       | Show every label, no collision detection | Few data points, precise values matter |
| `endpoints` | First and last per series only           | Line charts, emphasize start/end       |
| `none`      | No labels (tooltips + legend only)       | Dense data, clean look                 |

## Theme Customization

```typescript
theme: {
  colors: {
    categorical: ["#1b7fa3", "#c44e52", ...],  // 10 color palette
    sequential: { blue: [...], green: [...], orange: [...], purple: [...] },
    diverging: { redBlue: [...], brownTeal: [...] },
    background: "#ffffff",
    text: "#1d1d1d",
    gridline: "#e8e8e8",
    axis: "#888888",
  },
  fonts: {
    family: "Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  spacing: {
    padding: 12,     // chart container padding
    chromeGap: 4,    // gap between chrome elements
  },
  borderRadius: 4,
}
```

## Rendering

**React:**

```tsx
import { Chart, DataTable, VizThemeProvider } from '@opendata-ai/react';

<Chart spec={chartSpec} darkMode="auto" />
<DataTable spec={tableSpec} onRowClick={(row) => console.log(row)} />

// Theme all descendants:
<VizThemeProvider theme={myTheme}>
  <Chart spec={spec1} />
  <Chart spec={spec2} />
</VizThemeProvider>
```

**Vanilla JS:**

```typescript
import { createChart } from "@opendata-ai/vanilla";

const chart = createChart(container, spec, {
  darkMode: "auto",
  responsive: true,
});
chart.update(newSpec); // re-render with new spec
const svg = chart.export("svg"); // export as SVG string
const blob = await chart.export("png"); // export as PNG blob
chart.destroy(); // cleanup
```

## Event Handlers

Charts support these callbacks (pass as props in React, or in MountOptions for vanilla):

| Handler             | Signature                                             | Fires when               |
| ------------------- | ----------------------------------------------------- | ------------------------ |
| `onMarkClick`       | `(event: MarkEvent) => void`                          | User clicks a data mark  |
| `onMarkHover`       | `(event: MarkEvent) => void`                          | Mouse enters a data mark |
| `onMarkLeave`       | `() => void`                                          | Mouse leaves a data mark |
| `onLegendToggle`    | `(series: string, visible: boolean) => void`          | Legend entry toggled     |
| `onAnnotationClick` | `(annotation: Annotation, event: MouseEvent) => void` | Annotation clicked       |

**MarkEvent:** `{ datum: DataRow, series?: string, position: { x, y }, event: MouseEvent }`

Tables support: `onRowClick`, `onSortChange`, `onSearchChange`, `onPageChange`

## Builder Functions

Shorthand for common chart specs. Import from `@opendata-ai/core`.

```typescript
import {
  lineChart,
  barChart,
  columnChart,
  pieChart,
  scatterChart,
  dataTable,
} from "@opendata-ai/core";

// Field names auto-infer types from data values
const spec = lineChart(data, "date", "revenue", {
  color: "region",
  chrome: { title: "Revenue by region" },
});

// Or pass full EncodingChannel objects for control
const spec = barChart(
  data,
  { field: "category", type: "nominal" },
  { field: "value", type: "quantitative", axis: { format: "$,.0f" } },
);

// dataTable auto-generates columns if omitted
const spec = dataTable(data, { search: true, pagination: { pageSize: 20 } });
```

## Examples

### Line chart (trend)

```json
{
  "type": "line",
  "data": [
    { "year": "2020", "rate": 5.4 },
    { "year": "2021", "rate": 8.1 },
    { "year": "2022", "rate": 14.2 },
    { "year": "2023", "rate": 19.7 },
    { "year": "2024", "rate": 23.1 }
  ],
  "encoding": {
    "x": { "field": "year", "type": "temporal" },
    "y": {
      "field": "rate",
      "type": "quantitative",
      "axis": { "format": ".1f", "label": "Adoption rate (%)" }
    }
  },
  "chrome": {
    "title": "EV adoption accelerated sharply after 2021",
    "subtitle": "Percentage of new car sales that are electric, US market",
    "source": "Source: Bureau of Transportation Statistics"
  },
  "labels": { "density": "endpoints" }
}
```

### Bar chart (ranking)

```json
{
  "type": "bar",
  "data": [
    { "country": "Luxembourg", "gdp": 126598 },
    { "country": "Ireland", "gdp": 106899 },
    { "country": "Switzerland", "gdp": 93720 },
    { "country": "Norway", "gdp": 89154 },
    { "country": "Singapore", "gdp": 82808 }
  ],
  "encoding": {
    "x": {
      "field": "gdp",
      "type": "quantitative",
      "axis": { "format": "$,.0f" }
    },
    "y": { "field": "country", "type": "nominal" }
  },
  "chrome": {
    "title": "Luxembourg leads the world in GDP per capita",
    "subtitle": "Top 5 countries by GDP per capita (PPP), 2024 estimates",
    "source": "Source: IMF World Economic Outlook"
  }
}
```

### Donut chart (composition)

```json
{
  "type": "donut",
  "data": [
    { "source": "Solar", "share": 42 },
    { "source": "Wind", "share": 31 },
    { "source": "Hydro", "share": 18 },
    { "source": "Other", "share": 9 }
  ],
  "encoding": {
    "y": { "field": "share", "type": "quantitative" },
    "color": { "field": "source", "type": "nominal" }
  },
  "chrome": {
    "title": "Solar dominates new renewable capacity",
    "subtitle": "Share of new renewable energy installations, 2024",
    "source": "Source: IRENA"
  }
}
```

### Scatter chart (correlation)

```json
{
  "type": "scatter",
  "data": [
    { "country": "US", "spending": 12555, "lifeExp": 77.5, "pop": 331 },
    { "country": "Germany", "spending": 7383, "lifeExp": 81.7, "pop": 83 },
    { "country": "Japan", "spending": 4691, "lifeExp": 84.8, "pop": 125 },
    { "country": "UK", "spending": 5268, "lifeExp": 81.4, "pop": 67 },
    { "country": "Brazil", "spending": 1518, "lifeExp": 75.9, "pop": 214 }
  ],
  "encoding": {
    "x": {
      "field": "spending",
      "type": "quantitative",
      "axis": { "label": "Health spending per capita ($)" }
    },
    "y": {
      "field": "lifeExp",
      "type": "quantitative",
      "axis": { "label": "Life expectancy (years)" }
    },
    "size": { "field": "pop", "type": "quantitative" },
    "color": { "field": "country", "type": "nominal" }
  },
  "chrome": {
    "title": "Higher spending doesn't always mean longer lives",
    "subtitle": "Health expenditure per capita vs life expectancy, selected countries",
    "source": "Source: World Bank"
  }
}
```

### Annotated chart (infographic)

```json
{
  "type": "line",
  "data": [
    { "month": "2023-01", "price": 48200 },
    { "month": "2023-04", "price": 29100 },
    { "month": "2023-07", "price": 30800 },
    { "month": "2023-10", "price": 34500 },
    { "month": "2024-01", "price": 42800 },
    { "month": "2024-04", "price": 63400 },
    { "month": "2024-07", "price": 57200 },
    { "month": "2024-10", "price": 72800 }
  ],
  "encoding": {
    "x": { "field": "month", "type": "temporal" },
    "y": {
      "field": "price",
      "type": "quantitative",
      "axis": { "format": "$,.0f" }
    }
  },
  "chrome": {
    "title": "Bitcoin surged past $70K after spot ETF approvals",
    "subtitle": "Monthly closing price, Jan 2023 - Oct 2024",
    "source": "Source: CoinGecko"
  },
  "annotations": [
    {
      "type": "refline",
      "y": 42800,
      "label": "Jan 2024: ETF approved",
      "style": "dashed",
      "stroke": "#c44e52"
    },
    {
      "type": "range",
      "x1": "2024-01",
      "x2": "2024-04",
      "label": "Post-ETF rally",
      "fill": "#1b7fa3",
      "opacity": 0.1
    },
    {
      "type": "text",
      "x": "2024-10",
      "y": 72800,
      "text": "New ATH",
      "anchor": "left",
      "offset": { "dx": -10, "dy": -5 }
    }
  ]
}
```

### Rich data table

```json
{
  "type": "table",
  "data": [
    {
      "city": "Tokyo",
      "country": "JP",
      "pop": 37.4,
      "density": 6158,
      "trend": [34.5, 35.2, 36.1, 37.0, 37.4]
    },
    {
      "city": "Delhi",
      "country": "IN",
      "pop": 32.9,
      "density": 11320,
      "trend": [25.7, 28.1, 30.3, 31.8, 32.9]
    },
    {
      "city": "Shanghai",
      "country": "CN",
      "pop": 29.2,
      "density": 3826,
      "trend": [24.2, 25.6, 27.1, 28.5, 29.2]
    },
    {
      "city": "Sao Paulo",
      "country": "BR",
      "pop": 22.6,
      "density": 7523,
      "trend": [20.9, 21.3, 21.8, 22.2, 22.6]
    },
    {
      "city": "Mexico City",
      "country": "MX",
      "pop": 22.1,
      "density": 9544,
      "trend": [20.1, 20.8, 21.3, 21.7, 22.1]
    }
  ],
  "columns": [
    { "key": "city", "label": "City" },
    { "key": "country", "label": "", "flag": true, "width": "48px" },
    {
      "key": "pop",
      "label": "Population (M)",
      "format": ".1f",
      "bar": { "color": "#1b7fa3" }
    },
    {
      "key": "density",
      "label": "Density /km2",
      "format": ",.0f",
      "heatmap": { "palette": "orange" }
    },
    {
      "key": "trend",
      "label": "2020-2024",
      "sparkline": { "type": "line", "color": "#6a9f58" }
    }
  ],
  "chrome": {
    "title": "World's largest metropolitan areas",
    "subtitle": "Population in millions, 2024 estimates",
    "source": "Source: UN World Urbanization Prospects"
  },
  "search": true,
  "pagination": { "pageSize": 10 },
  "stickyFirstColumn": true
}
```

## Anti-Patterns

| Mistake                                           | Fix                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| Title describes chart type ("Bar chart of sales") | Title states the insight ("Q4 sales exceeded targets by 18%")    |
| Pie/donut with 7+ categories                      | Use bar chart, or group small categories into "Other"            |
| Missing source attribution                        | Always include `chrome.source`                                   |
| Using `nominal` type for numeric field            | Use `quantitative` for numbers, `temporal` for dates             |
| Using `ordinal` for temporal data                 | Use `temporal` type for dates; ordinal is for ordered categories |
| Huge inline data arrays (500+ rows)               | Aggregate or sample data before passing to spec                  |
| Forgetting encoding.color for multi-series        | Line/bar with groups needs `color` channel to differentiate      |
| Bar chart for time series                         | Use line or column for temporal data; bar is for categories      |
| Not specifying axis format for currency/pct       | Add `axis: { format: "$,.0f" }` or `".1%"`                       |
| Using pie for comparison across groups            | Pie shows composition of ONE whole; use column for comparison    |

## Quality Checklist

Before finalizing any spec, verify:

1. **Type matches intent:** chart type fits the data story (see decision tree)
2. **Encoding types correct:** quantitative for numbers, temporal for dates, nominal for categories
3. **Field names match data:** every encoding field exists in the data objects
4. **Title states insight:** not a description of the chart
5. **Source included:** `chrome.source` is populated
6. **Category count reasonable:** pie/donut has 2-6 categories
7. **Axis formatted:** currency/percentages/large numbers have format strings
8. **Labels appropriate:** density mode fits the data density
9. **Annotations add value:** if annotations exist, they highlight insights not decoration
10. **Data is minimal:** no unnecessary rows; aggregate if >100 rows for charts
