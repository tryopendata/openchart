# Scatter Chart

Correlation between two quantitative variables. Optional size and color for 3rd/4th dimensions.

## Encoding Rules

| Channel | Required | Allowed types |
| --- | --- | --- |
| x | Yes | quantitative |
| y | Yes | quantitative |
| color | No | nominal, ordinal |
| size | No | quantitative |
| detail | No | nominal |

## Spec

```typescript
{
  type: "scatter",
  data: DataRow[],
  encoding: {
    x: { field: string, type: "quantitative", axis?, scale? },
    y: { field: string, type: "quantitative", axis?, scale? },
    color?: { field: string, type: "nominal"|"ordinal" },
    size?: { field: string, type: "quantitative" },
  },
  chrome?: Chrome,
  annotations?: Annotation[],
  labels?: LabelConfig,
  legend?: LegendConfig,
  responsive?: boolean,
  theme?: ThemeConfig,
  darkMode?: DarkMode,
}
```

**Tips:**
- Use `size` for bubble charts (3rd quantitative dimension)
- Use `color` to differentiate categories
- Use `labels: { density: "none" }` for dense scatter plots
- Use `scale: { zero: false }` on axes to zoom into the data range when zero is irrelevant

## Builder

```typescript
import { scatterChart } from "@opendata-ai/openchart-core";

const spec = scatterChart(data, "spending", "lifeExp", {
  size: "pop",
  color: "continent",
  chrome: { title: "Health spending vs life expectancy" },
});
```

## Example

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
