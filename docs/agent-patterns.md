# Visualization patterns cookbook

Visualization patterns organized by data storytelling intent. Each pattern includes when to use it, the data shape it expects, a complete working spec, and annotation examples.

All specs use realistic data with plausible numbers. Copy and adapt.

## Contents

- [1. Trend over time](#1-trend-over-time) (line, area, multi-series)
- [2. Ranking / comparison](#2-ranking--comparison) (horizontal bar, stacked)
- [3. Part-to-whole](#3-part-to-whole) (donut, stacked column)
- [4. Correlation](#4-correlation) (scatter, bubble)
- [5. Periodic comparison](#5-periodic-comparison) (column, year-over-year)
- [6. Distribution](#6-distribution) (dot/strip plot)
- [7. Data table with context](#7-data-table-with-context) (table with visual features)
- [8. Annotated infographic](#8-annotated-infographic) (layered annotations)
- [9. Grouped lines without color](#9-grouped-lines-without-color-detail-channel) (detail channel)
- [10. Aggregation](#10-aggregation) (sum, mean, count)
- [Network graphs](#network-graphs)
- [Spec quality rubric](#spec-quality-rubric)

---

## 1. Trend Over Time

**When to use:** You have a temporal column (dates, months, years) and a numeric measure. The story is about change, growth, or decline over time.

**Data shape:** Each row has a time value and a numeric value. Optionally a category column for multi-series.

**Chart type:** `line` (single or multi-series). Use `area` if you want to emphasize volume.

```json
{
  "type": "line",
  "data": [
    { "date": "2019-01", "rate": 3.6 },
    { "date": "2019-07", "rate": 3.7 },
    { "date": "2020-01", "rate": 3.5 },
    { "date": "2020-04", "rate": 14.7 },
    { "date": "2020-07", "rate": 10.2 },
    { "date": "2020-10", "rate": 6.9 },
    { "date": "2021-01", "rate": 6.7 },
    { "date": "2021-07", "rate": 5.4 },
    { "date": "2022-01", "rate": 4.0 },
    { "date": "2022-07", "rate": 3.5 },
    { "date": "2023-01", "rate": 3.4 },
    { "date": "2023-07", "rate": 3.5 }
  ],
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "rate", "type": "quantitative", "axis": { "label": "Unemployment rate (%)", "format": ".1f" } }
  },
  "chrome": {
    "title": "Unemployment spiked to 14.7% in April 2020 then recovered within two years",
    "subtitle": "US seasonally adjusted unemployment rate, Jan 2019 - Jul 2023",
    "source": "Source: Bureau of Labor Statistics"
  },
  "labels": { "density": "endpoints" },
  "annotations": [
    { "type": "text", "x": "2020-04", "y": 14.7, "text": "COVID peak: 14.7%", "anchor": "right", "offset": { "dx": 8 } },
    { "type": "refline", "y": 5.0, "label": "Pre-pandemic average", "style": "dashed", "stroke": "#999" },
    { "type": "range", "x1": "2020-03", "x2": "2020-06", "label": "Initial lockdowns", "fill": "#c44e52", "opacity": 0.08 }
  ]
}
```

**Multi-series variant:** Add a `color` encoding to split by category. Keep to 5 series max for readability.

```json
{
  "type": "line",
  "data": [
    { "year": "2020", "fuel": "Coal", "twh": 9421 },
    { "year": "2021", "fuel": "Coal", "twh": 10244 },
    { "year": "2022", "fuel": "Coal", "twh": 10186 },
    { "year": "2023", "fuel": "Coal", "twh": 9826 },
    { "year": "2020", "fuel": "Solar", "twh": 855 },
    { "year": "2021", "fuel": "Solar", "twh": 1033 },
    { "year": "2022", "fuel": "Solar", "twh": 1293 },
    { "year": "2023", "fuel": "Solar", "twh": 1631 },
    { "year": "2020", "fuel": "Wind", "twh": 1592 },
    { "year": "2021", "fuel": "Wind", "twh": 1862 },
    { "year": "2022", "fuel": "Wind", "twh": 2105 },
    { "year": "2023", "fuel": "Wind", "twh": 2341 }
  ],
  "encoding": {
    "x": { "field": "year", "type": "temporal" },
    "y": { "field": "twh", "type": "quantitative", "axis": { "label": "Generation (TWh)", "format": ",.0f" } },
    "color": { "field": "fuel", "type": "nominal" }
  },
  "chrome": {
    "title": "Solar and wind are closing the gap on coal",
    "subtitle": "Global electricity generation by source, terawatt-hours",
    "source": "Source: Energy Institute Statistical Review"
  }
}
```

---

## 2. Ranking / Comparison

**When to use:** You're comparing discrete items by a numeric value. The story is about who's on top, or how items rank relative to each other.

**Data shape:** Each row has a category and a numeric value. Pre-sort data by value descending. Show top N (typically 5-10) and optionally group the rest as "Other".

**Chart type:** `bar` (horizontal). Horizontal bars make long category labels easy to read.

```json
{
  "type": "bar",
  "data": [
    { "company": "Apple", "revenue": 383.3 },
    { "company": "Microsoft", "revenue": 227.6 },
    { "company": "Alphabet", "revenue": 307.4 },
    { "company": "Amazon", "revenue": 574.8 },
    { "company": "Meta", "revenue": 134.9 },
    { "company": "Nvidia", "revenue": 60.9 },
    { "company": "Tesla", "revenue": 96.8 }
  ],
  "encoding": {
    "x": { "field": "revenue", "type": "quantitative", "axis": { "format": "$,.0f", "label": "Revenue ($B)" } },
    "y": { "field": "company", "type": "nominal" }
  },
  "chrome": {
    "title": "Amazon leads Big Tech in revenue, nearly double Apple",
    "subtitle": "Annual revenue in billions, fiscal year 2023",
    "source": "Source: Company filings"
  },
  "annotations": [
    { "type": "refline", "x": 200, "label": "$200B threshold", "style": "dashed" }
  ]
}
```

**With grouping (stacked):** Add `color` encoding for a second categorical dimension.

```json
{
  "type": "bar",
  "data": [
    { "country": "China", "source": "Renewable", "gw": 1340 },
    { "country": "China", "source": "Fossil", "gw": 1390 },
    { "country": "US", "source": "Renewable", "gw": 420 },
    { "country": "US", "source": "Fossil", "gw": 860 },
    { "country": "India", "source": "Renewable", "gw": 185 },
    { "country": "India", "source": "Fossil", "gw": 340 },
    { "country": "Germany", "source": "Renewable", "gw": 150 },
    { "country": "Germany", "source": "Fossil", "gw": 90 }
  ],
  "encoding": {
    "x": { "field": "gw", "type": "quantitative", "axis": { "format": ",.0f", "label": "Installed capacity (GW)" } },
    "y": { "field": "country", "type": "nominal" },
    "color": { "field": "source", "type": "nominal" }
  },
  "chrome": {
    "title": "China has nearly matched fossil fuel capacity with renewables",
    "subtitle": "Installed power generation capacity by source, 2023",
    "source": "Source: IRENA Renewable Capacity Statistics"
  }
}
```

---

## 3. Part-to-Whole

**When to use:** You're showing how parts add up to a whole. The story is about composition or share.

**Data shape:** Each row is a category with a numeric share/value. Keep to 2-6 categories. Group small slices into "Other".

**Chart type:** `donut` for up to 6 categories. `column` with `color` (stacked) if comparing composition across groups or time periods.

```json
{
  "type": "donut",
  "data": [
    { "browser": "Chrome", "share": 64.7 },
    { "browser": "Safari", "share": 18.6 },
    { "browser": "Edge", "share": 5.2 },
    { "browser": "Firefox", "share": 3.1 },
    { "browser": "Other", "share": 8.4 }
  ],
  "encoding": {
    "y": { "field": "share", "type": "quantitative" },
    "color": { "field": "browser", "type": "nominal" }
  },
  "chrome": {
    "title": "Chrome commands nearly two-thirds of global browser usage",
    "subtitle": "Desktop browser market share, January 2024",
    "source": "Source: StatCounter Global Stats"
  }
}
```

**Stacked column variant** (composition over time):

```json
{
  "type": "column",
  "data": [
    { "year": "2019", "type": "Remote", "pct": 5.7 },
    { "year": "2019", "type": "Hybrid", "pct": 8.3 },
    { "year": "2019", "type": "Office", "pct": 86.0 },
    { "year": "2021", "type": "Remote", "pct": 27.6 },
    { "year": "2021", "type": "Hybrid", "pct": 18.4 },
    { "year": "2021", "type": "Office", "pct": 54.0 },
    { "year": "2023", "type": "Remote", "pct": 12.7 },
    { "year": "2023", "type": "Hybrid", "pct": 29.4 },
    { "year": "2023", "type": "Office", "pct": 57.9 }
  ],
  "encoding": {
    "x": { "field": "year", "type": "ordinal" },
    "y": { "field": "pct", "type": "quantitative", "axis": { "format": ".0f", "label": "Share (%)" } },
    "color": { "field": "type", "type": "nominal" }
  },
  "chrome": {
    "title": "Hybrid work settled at 29% after the post-pandemic spike in remote",
    "subtitle": "US workforce distribution by work arrangement",
    "source": "Source: Pew Research Center"
  }
}
```

---

## 4. Correlation

**When to use:** You have two numeric variables and want to show their relationship. The story is about whether they move together, inversely, or not at all.

**Data shape:** Each row has two numeric values. Optional category (color) and a third numeric (size) for bubble charts.

**Chart type:** `scatter`. Add `size` encoding for a bubble chart. Add `color` for group differentiation.

```json
{
  "type": "scatter",
  "data": [
    { "country": "US", "gdpPerCapita": 76330, "co2PerCapita": 14.4, "pop": 331 },
    { "country": "China", "gdpPerCapita": 12556, "co2PerCapita": 8.0, "pop": 1412 },
    { "country": "Germany", "gdpPerCapita": 51204, "co2PerCapita": 8.1, "pop": 83 },
    { "country": "India", "gdpPerCapita": 2389, "co2PerCapita": 1.9, "pop": 1408 },
    { "country": "Brazil", "gdpPerCapita": 8918, "co2PerCapita": 2.3, "pop": 214 },
    { "country": "Japan", "gdpPerCapita": 33815, "co2PerCapita": 8.5, "pop": 125 },
    { "country": "UK", "gdpPerCapita": 46125, "co2PerCapita": 5.2, "pop": 67 },
    { "country": "Nigeria", "gdpPerCapita": 2184, "co2PerCapita": 0.6, "pop": 218 },
    { "country": "France", "gdpPerCapita": 43659, "co2PerCapita": 4.6, "pop": 68 },
    { "country": "Australia", "gdpPerCapita": 64964, "co2PerCapita": 15.1, "pop": 26 }
  ],
  "encoding": {
    "x": { "field": "gdpPerCapita", "type": "quantitative", "axis": { "label": "GDP per capita ($)", "format": "$,.0f" } },
    "y": { "field": "co2PerCapita", "type": "quantitative", "axis": { "label": "CO2 emissions per capita (tons)" } },
    "size": { "field": "pop", "type": "quantitative" },
    "color": { "field": "country", "type": "nominal" }
  },
  "chrome": {
    "title": "Wealthier nations tend to emit more CO2 per person",
    "subtitle": "GDP per capita vs CO2 emissions per capita, bubble size = population, 2022",
    "source": "Source: World Bank, Global Carbon Project"
  },
  "annotations": [
    { "type": "text", "x": 76330, "y": 14.4, "text": "US: high income, high emissions", "anchor": "left", "offset": { "dx": -10, "dy": -8 } },
    { "type": "text", "x": 2389, "y": 1.9, "text": "India: low income, low emissions", "anchor": "right", "offset": { "dx": 10, "dy": 5 } },
    { "type": "refline", "y": 6.0, "label": "World average", "style": "dashed", "stroke": "#999" }
  ]
}
```

---

## 5. Periodic Comparison

**When to use:** You're comparing values across regular intervals: months, quarters, weekdays, fiscal years. The axis is ordinal (ordered categories), not truly temporal.

**Data shape:** Each row has a period label and a numeric value. Optionally a group column.

**Chart type:** `column` (vertical). Use ordinal for the x-axis since periods are discrete buckets.

```json
{
  "type": "column",
  "data": [
    { "month": "Jan", "rainfall": 78 },
    { "month": "Feb", "rainfall": 62 },
    { "month": "Mar", "rainfall": 55 },
    { "month": "Apr", "rainfall": 41 },
    { "month": "May", "rainfall": 33 },
    { "month": "Jun", "rainfall": 15 },
    { "month": "Jul", "rainfall": 3 },
    { "month": "Aug", "rainfall": 5 },
    { "month": "Sep", "rainfall": 18 },
    { "month": "Oct", "rainfall": 42 },
    { "month": "Nov", "rainfall": 65 },
    { "month": "Dec", "rainfall": 82 }
  ],
  "encoding": {
    "x": { "field": "month", "type": "ordinal" },
    "y": { "field": "rainfall", "type": "quantitative", "axis": { "label": "Rainfall (mm)", "format": ".0f" } }
  },
  "chrome": {
    "title": "San Diego gets almost no rain from June through August",
    "subtitle": "Average monthly rainfall in millimeters, 1991-2020 normals",
    "source": "Source: NOAA Climate Data"
  },
  "annotations": [
    { "type": "range", "x1": "Jun", "x2": "Aug", "label": "Dry season", "fill": "#d47215", "opacity": 0.08 }
  ]
}
```

**Year-over-year comparison:** Use color to compare the same periods across years.

```json
{
  "type": "column",
  "data": [
    { "quarter": "Q1", "year": "2023", "sales": 4.2 },
    { "quarter": "Q2", "year": "2023", "sales": 5.1 },
    { "quarter": "Q3", "year": "2023", "sales": 4.8 },
    { "quarter": "Q4", "year": "2023", "sales": 6.3 },
    { "quarter": "Q1", "year": "2024", "sales": 5.0 },
    { "quarter": "Q2", "year": "2024", "sales": 6.2 },
    { "quarter": "Q3", "year": "2024", "sales": 5.9 },
    { "quarter": "Q4", "year": "2024", "sales": 7.8 }
  ],
  "encoding": {
    "x": { "field": "quarter", "type": "ordinal" },
    "y": { "field": "sales", "type": "quantitative", "axis": { "format": "$,.1f", "label": "Revenue ($B)" } },
    "color": { "field": "year", "type": "nominal" }
  },
  "chrome": {
    "title": "2024 outperformed 2023 in every quarter",
    "subtitle": "Quarterly revenue comparison in billions",
    "source": "Source: Finance team"
  }
}
```

---

## 6. Distribution

**When to use:** You want to show the spread, range, or density of values across categories. The story is about variability, outliers, or clusters.

**Data shape:** Multiple rows per category, each with a numeric value.

**Chart type:** `dot` (strip plot). Shows individual data points along a numeric axis.

```json
{
  "type": "dot",
  "data": [
    { "dept": "Engineering", "salary": 185000 },
    { "dept": "Engineering", "salary": 162000 },
    { "dept": "Engineering", "salary": 148000 },
    { "dept": "Engineering", "salary": 135000 },
    { "dept": "Engineering", "salary": 128000 },
    { "dept": "Engineering", "salary": 112000 },
    { "dept": "Design", "salary": 142000 },
    { "dept": "Design", "salary": 128000 },
    { "dept": "Design", "salary": 118000 },
    { "dept": "Design", "salary": 105000 },
    { "dept": "Marketing", "salary": 125000 },
    { "dept": "Marketing", "salary": 108000 },
    { "dept": "Marketing", "salary": 95000 },
    { "dept": "Marketing", "salary": 88000 },
    { "dept": "Sales", "salary": 175000 },
    { "dept": "Sales", "salary": 132000 },
    { "dept": "Sales", "salary": 98000 },
    { "dept": "Sales", "salary": 82000 }
  ],
  "encoding": {
    "x": { "field": "salary", "type": "quantitative", "axis": { "format": "$,.0f", "label": "Annual salary" } },
    "y": { "field": "dept", "type": "nominal" }
  },
  "chrome": {
    "title": "Sales has the widest salary range; Engineering clusters higher",
    "subtitle": "Individual salaries by department, 2024 compensation data",
    "source": "Source: HR analytics"
  },
  "annotations": [
    { "type": "refline", "x": 130000, "label": "Company median: $130K", "style": "dashed" }
  ]
}
```

---

## 7. Data Table with Context

**When to use:** You need to show exact values alongside visual context. The story is about comparing multiple dimensions for a set of items. Tables work well when users need to look up specific values, sort, search, or when there are more than 2-3 dimensions.

**Data shape:** Tabular data with multiple columns. Use visual features to add context without losing precision.

```json
{
  "type": "table",
  "data": [
    { "state": "California", "code": "US", "pop": 39538, "growth": 2.3, "income": 91905, "trend": [37254, 37691, 38066, 38965, 39538] },
    { "state": "Texas", "code": "US", "pop": 30029, "growth": 9.8, "income": 67404, "trend": [25146, 27470, 28996, 29528, 30029] },
    { "state": "Florida", "code": "US", "pop": 22245, "growth": 14.6, "income": 63062, "trend": [18801, 19552, 20612, 21538, 22245] },
    { "state": "New York", "code": "US", "pop": 19677, "growth": -1.0, "income": 81386, "trend": [19378, 19453, 19336, 19571, 19677] },
    { "state": "Pennsylvania", "code": "US", "pop": 12972, "growth": 2.4, "income": 69693, "trend": [12702, 12791, 12801, 12964, 12972] },
    { "state": "Illinois", "code": "US", "pop": 12582, "growth": -2.6, "income": 74235, "trend": [12831, 12812, 12671, 12582, 12582] },
    { "state": "Ohio", "code": "US", "pop": 11780, "growth": 1.8, "income": 61938, "trend": [11536, 11614, 11693, 11756, 11780] },
    { "state": "Georgia", "code": "US", "pop": 10912, "growth": 7.8, "income": 65030, "trend": [9688, 10100, 10403, 10711, 10912] }
  ],
  "columns": [
    { "key": "state", "label": "State" },
    { "key": "pop", "label": "Population", "format": ",.0f", "bar": { "color": "#1b7fa3" } },
    { "key": "growth", "label": "Growth %", "format": "+.1f", "heatmap": { "palette": "redBlue", "domain": [-5, 15] } },
    { "key": "income", "label": "Median Income", "format": "$,.0f", "align": "right" },
    { "key": "trend", "label": "Pop 2018-2022", "sparkline": { "type": "line", "color": "#6a9f58" } }
  ],
  "chrome": {
    "title": "Florida's population grew fastest among the largest states",
    "subtitle": "Top 8 US states by population, 2022 Census estimates (population in thousands)",
    "source": "Source: US Census Bureau"
  },
  "search": true,
  "pagination": { "pageSize": 25 },
  "stickyFirstColumn": true
}
```

**Visual feature decision guide:**

| Feature | Use when | Example |
|---------|----------|---------|
| `bar` | Comparing magnitudes across rows | Revenue, population, counts |
| `heatmap` | Showing intensity/density | Temperature, growth rates, percentages |
| `sparkline` | Showing trends within rows | Time series, historical progression |
| `categoryColors` | Color-coding status or type | Status (Active/Inactive), risk level |
| `flag` | Showing country context | Country codes alongside names |
| `image` | Showing logos, avatars | Company logos, profile pictures |

---

## 8. Annotated Infographic

**When to use:** You want to tell a rich data story with multiple annotations. The chart is the visual anchor, and annotations layer in context, thresholds, time periods, and callouts to create an editorial-quality graphic.

**Data shape:** Same as a trend chart, but the annotations carry the narrative weight.

```json
{
  "type": "line",
  "data": [
    { "date": "2019-01", "price": 3714 },
    { "date": "2019-04", "price": 5267 },
    { "date": "2019-07", "price": 9580 },
    { "date": "2019-10", "price": 8319 },
    { "date": "2020-01", "price": 9350 },
    { "date": "2020-04", "price": 8630 },
    { "date": "2020-07", "price": 11351 },
    { "date": "2020-10", "price": 13804 },
    { "date": "2021-01", "price": 33114 },
    { "date": "2021-04", "price": 57750 },
    { "date": "2021-07", "price": 41461 },
    { "date": "2021-10", "price": 61318 },
    { "date": "2022-01", "price": 38483 },
    { "date": "2022-04", "price": 37714 },
    { "date": "2022-07", "price": 23297 },
    { "date": "2022-10", "price": 20495 },
    { "date": "2023-01", "price": 23139 },
    { "date": "2023-04", "price": 29233 },
    { "date": "2023-07", "price": 29230 },
    { "date": "2023-10", "price": 34494 },
    { "date": "2024-01", "price": 42585 },
    { "date": "2024-04", "price": 63504 },
    { "date": "2024-07", "price": 65466 },
    { "date": "2024-10", "price": 72390 }
  ],
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "price", "type": "quantitative", "axis": { "format": "$,.0f", "label": "Price (USD)" }, "scale": { "zero": false } }
  },
  "chrome": {
    "title": "Bitcoin's volatile path to $72K",
    "subtitle": "Monthly closing price, January 2019 through October 2024",
    "source": "Source: CoinGecko",
    "byline": "OpenData Research"
  },
  "annotations": [
    {
      "type": "range",
      "x1": "2020-04",
      "x2": "2020-10",
      "label": "Post-halving rally begins",
      "fill": "#6a9f58",
      "opacity": 0.06,
      "labelAnchor": "top"
    },
    {
      "type": "text",
      "x": "2021-04",
      "y": 57750,
      "text": "First peak: $57.7K",
      "anchor": "bottom",
      "offset": { "dy": 10 }
    },
    {
      "type": "text",
      "x": "2021-10",
      "y": 61318,
      "text": "ATH: $61.3K",
      "anchor": "top",
      "offset": { "dy": -8 }
    },
    {
      "type": "range",
      "x1": "2022-04",
      "x2": "2022-10",
      "label": "Terra/Luna + FTX collapses",
      "fill": "#c44e52",
      "opacity": 0.08,
      "labelAnchor": "bottom"
    },
    {
      "type": "refline",
      "y": 20000,
      "label": "Cycle floor",
      "style": "dotted",
      "stroke": "#c44e52"
    },
    {
      "type": "text",
      "x": "2024-01",
      "y": 42585,
      "text": "Spot ETF approved",
      "anchor": "right",
      "offset": { "dx": 8, "dy": -5 },
      "fontWeight": 600
    },
    {
      "type": "text",
      "x": "2024-10",
      "y": 72390,
      "text": "New ATH: $72.4K",
      "anchor": "left",
      "offset": { "dx": -10, "dy": -8 },
      "fontWeight": 600
    }
  ]
}
```

**Annotation combination guide:**

| Annotation type | Good for | Positioning tips |
|----------------|----------|-----------------|
| `text` | Callouts at specific data points | Use `anchor` to avoid overlapping the line. `offset` for fine-tuning. |
| `range` | Time periods, regions, phases | Use low `opacity` (0.05-0.1) so data is still visible. |
| `refline` | Thresholds, baselines, averages | Use `dashed` or `dotted` style to visually separate from data. |

**Combining annotations:** Layer them. Ranges go behind the data (low opacity). Reference lines mark horizontal/vertical thresholds. Text callouts highlight specific inflection points or notable data values. This layering creates visual depth.

---

## 9. Grouped lines without color (detail channel)

**When to use:** You have multiple series but the grouping is background context, not the main story. All lines should be the same color, but each group gets its own path. Common for showing "all paths trend the same direction" or "spaghetti plot" patterns.

**Data shape:** Same as a multi-series line chart, but instead of a `color` encoding, use `detail`.

**Chart type:** `line`. The `detail` channel groups data into separate paths without assigning different colors.

```json
{
  "type": "line",
  "data": [
    { "date": "2024-01", "price": 185, "ticker": "AAPL" },
    { "date": "2024-04", "price": 170, "ticker": "AAPL" },
    { "date": "2024-07", "price": 195, "ticker": "AAPL" },
    { "date": "2024-10", "price": 220, "ticker": "AAPL" },
    { "date": "2024-01", "price": 375, "ticker": "MSFT" },
    { "date": "2024-04", "price": 420, "ticker": "MSFT" },
    { "date": "2024-07", "price": 435, "ticker": "MSFT" },
    { "date": "2024-10", "price": 460, "ticker": "MSFT" },
    { "date": "2024-01", "price": 140, "ticker": "GOOG" },
    { "date": "2024-04", "price": 172, "ticker": "GOOG" },
    { "date": "2024-07", "price": 180, "ticker": "GOOG" },
    { "date": "2024-10", "price": 188, "ticker": "GOOG" }
  ],
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "price", "type": "quantitative", "axis": { "format": "$,.0f", "label": "Stock price" } },
    "detail": { "field": "ticker", "type": "nominal" }
  },
  "chrome": {
    "title": "All three stocks trended upward through 2024",
    "subtitle": "Quarterly closing prices, Jan-Oct 2024",
    "source": "Source: Market data"
  }
}
```

**When to use `detail` vs `color`:** Use `color` when the audience needs to distinguish between series (which line is Apple? which is Google?). Use `detail` when the individual identity doesn't matter and the overall pattern is the story. If you have more than 5-6 series, `detail` often works better than `color` since too many colored lines are hard to tell apart anyway.

---

## 10. Aggregation

The `aggregate` property on an encoding channel lets the engine summarize data before rendering. This is useful when your data has multiple rows per category and you want a single value per mark.

```json
{
  "type": "bar",
  "data": [
    { "region": "West", "revenue": 42000 },
    { "region": "West", "revenue": 38000 },
    { "region": "East", "revenue": 55000 },
    { "region": "East", "revenue": 48000 },
    { "region": "Central", "revenue": 31000 },
    { "region": "Central", "revenue": 29000 }
  ],
  "encoding": {
    "x": { "field": "revenue", "type": "quantitative", "aggregate": "sum", "axis": { "format": "$,.0f" } },
    "y": { "field": "region", "type": "nominal" }
  },
  "chrome": {
    "title": "East region leads in total revenue",
    "source": "Source: Finance team"
  }
}
```

Available operations: `sum`, `mean`, `median`, `min`, `max`, `count`. Use `sum` for totals, `mean` for averages, `count` when the number of rows is the measure.

---

## Network graphs

For network and relationship data, use `type: 'graph'` with `nodes` and `edges` instead of `data` and `encoding`. Graphs use force-directed layout on canvas. See the [spec reference](spec-reference.md#graphspec) for the full GraphSpec definition and the [integration guide](integration-guide.md#graph-visualization) for interaction patterns.

---

## Spec Quality Rubric

Use this to self-evaluate any spec before outputting it.

| Criterion | Check | Common failure |
|-----------|-------|---------------|
| **Chart type fits intent** | Does the chart type match the data story? | Using pie for comparison, bar for time series |
| **Encoding types correct** | Are numbers `quantitative`, dates `temporal`, categories `nominal`? | Using `nominal` for numeric fields |
| **Field names match data** | Does every `field` in encoding exist as a key in data objects? | Typos, case mismatches |
| **Title states insight** | Does the title tell the reader what they should take away? | "Sales by quarter" instead of "Q4 sales exceeded forecast" |
| **Source included** | Is `chrome.source` populated? | Missing attribution |
| **Category count appropriate** | Pie/donut has 2-6 categories? Bar chart has 5-15 items? | 12-slice pie chart |
| **Axis formatting** | Do currency, percentage, and large number axes have format strings? | Raw numbers like 1234567 without commas |
| **Data volume reasonable** | Under 100 rows for charts? Aggregated if source data is larger? | Passing 5000 rows to a bar chart |
| **Annotations add insight** | Do annotations highlight key findings, not just decorate? | Random reference lines with no label |
| **Label density appropriate** | Is `labels.density` set correctly for the data volume? | All labels on a 50-point line chart |
| **No encoding conflicts** | Bar has category on y (not x)? Pie/donut has no x encoding? | Swapped axes |
| **Color encoding present for multi-series** | Multi-group data has `color` channel? | Multiple series without differentiation |
