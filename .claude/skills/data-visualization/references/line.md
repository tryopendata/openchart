# Line Chart

Trends over time or ordered sequences. Connects data points with lines.

## Encoding Rules

| Channel | Required | Allowed types |
| --- | --- | --- |
| x | Yes | temporal, ordinal |
| y | Yes | quantitative |
| color | No | nominal, ordinal |
| size | No | quantitative |
| detail | No | nominal |

Use `color` to differentiate 2-5 series. For 6+ series, filter to the top 5 or use `detail` to group without color encoding.

## Spec

```typescript
{
  type: "line",
  data: DataRow[],
  encoding: {
    x: { field: string, type: "temporal"|"ordinal", axis?, scale? },
    y: { field: string, type: "quantitative", axis?, scale? },
    color?: { field: string, type: "nominal"|"ordinal" },
    size?: { field: string, type: "quantitative" },
    detail?: { field: string, type: "nominal" },
  },
  chrome?: Chrome,
  annotations?: Annotation[],
  labels?: { density?: "all"|"auto"|"endpoints"|"none", format?: string },
  legend?: { position?: LegendPosition },
  responsive?: boolean,
  theme?: ThemeConfig,
  darkMode?: "auto"|"force"|"off",
}
```

**Tip:** Use `labels: { density: "endpoints" }` for line charts to show only the first and last value per series.

## Builder

```typescript
import { lineChart } from "@opendata-ai/core";

const spec = lineChart(data, "date", "revenue", {
  color: "region",
  chrome: { title: "Revenue trend by region" },
});
```

## Example

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
