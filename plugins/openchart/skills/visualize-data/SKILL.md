---
name: visualize-data
description: >
  Generates @opendata-ai chart, table, and graph specs from data, and guides editorial
  design decisions. Use when creating visualizations, building charts, rendering data
  tables, generating VizSpec JSON, creating network graphs, answering questions about
  @opendata-ai types and encoding rules, or making design decisions about chart type
  selection, color strategy, typography, annotations, and editorial framing.
---

# Data Visualization with @opendata-ai

**Core concept:** Write a VizSpec JSON object, render with `<Chart spec={spec} />` / `<DataTable spec={spec} />` / `<Graph spec={spec} />` (React) or `createChart(container, spec)` / `createTable(container, spec)` / `createGraph(container, spec)` (vanilla JS). The engine validates, compiles, and renders. Specs are plain JSON, no imperative drawing.

## Chart Selection Decision Tree

```
Single value to highlight    -> Use chrome.title as a big number display
Temporal x-axis column?      -> 1 series: line | 2-5 series: line + color | 6+: filter to top 5
Categorical + numeric?       -> Ranked list: bar (horizontal) | Periodic (Q1, Jan): column | 2-6 composition: donut
Two numeric columns?         -> scatter (optional size/color for 3rd/4th dims)
Categorical + series + num?  -> stacked bar or stacked column (use color for series)
Distribution/spread?         -> dot (strip plot)
Nodes + edges / network?     -> graph (force/radial/hierarchical layout)
Tabular data overview?       -> table (with sparklines, heatmaps, bars)
Default                      -> bar
```

## Visualization Types

Each type has a detailed reference with full spec, encoding rules, and examples. Load the reference when you need the details.

| Type | Best for | Data model | Reference |
| --- | --- | --- | --- |
| `line` | Trends over time | x: temporal/ordinal, y: quantitative | [references/line.md](references/line.md) |
| `area` | Trends with volume emphasis | x: temporal/ordinal, y: quantitative | [references/area.md](references/area.md) |
| `bar` | Rankings, comparisons (horizontal) | x: quantitative, y: nominal/ordinal | [references/bar.md](references/bar.md) |
| `column` | Periodic data, categories (vertical) | x: nominal/ordinal/temporal, y: quantitative | [references/column.md](references/column.md) |
| `pie` | Part-to-whole (2-5 categories) | y: quantitative, color: nominal/ordinal | [references/pie-donut.md](references/pie-donut.md) |
| `donut` | Part-to-whole (preferred over pie) | y: quantitative, color: nominal/ordinal | [references/pie-donut.md](references/pie-donut.md) |
| `dot` | Distribution, strip plots | x: quantitative, y: nominal/ordinal | [references/dot.md](references/dot.md) |
| `scatter` | Correlation between two variables | x: quantitative, y: quantitative | [references/scatter.md](references/scatter.md) |
| `table` | Data tables with visual features | columns + data rows | [references/table.md](references/table.md) |
| `graph` | Networks, relationships, hierarchies | nodes + edges | [references/graph.md](references/graph.md) |

**Cross-cutting references:**
- [Annotations](references/annotations.md) (spec syntax for text callouts, ranges, reference lines)
- [Theme customization](references/theme.md) (colors, fonts, spacing config)
- [Rendering & APIs](references/rendering.md) (React, Vue, Svelte, Vanilla JS, events, builders)

**Design philosophy references:**

| Designing... | Load | Reference |
| --- | --- | --- |
| Chart type for a story | Story-driven chart selection | [references/chart-selection.md](references/chart-selection.md) |
| Color palette, emphasis | Color as narrative | [references/color-strategy.md](references/color-strategy.md) |
| Titles, subtitles, annotations | Editorial writing | [references/editorial-writing.md](references/editorial-writing.md) |
| Type sizing, hierarchy | Typography | [references/typography.md](references/typography.md) |
| Whether a chart is "done" | Design review | [references/design-review.md](references/design-review.md) |

## Shared Spec Structure

All visualization types share these properties:

```typescript
{
  type: string,              // REQUIRED: discriminant ("line", "table", "graph", etc.)
  chrome?: {                 // editorial text elements
    title?: string | { text: string, style?: ChromeTextStyle },
    subtitle?: string | { text: string, style?: ChromeTextStyle },
    source?: string | { text: string, style?: ChromeTextStyle },
    byline?: string | { text: string, style?: ChromeTextStyle },
    footer?: string | { text: string, style?: ChromeTextStyle },
  },
  theme?: ThemeConfig,       // see references/theme.md
  darkMode?: "auto"|"force"|"off",  // default: "off"
  responsive?: boolean,      // default: true
}
```

**ChromeTextStyle:** `{ fontSize?: number, fontWeight?: number, fontFamily?: string, color?: string }`

## Encoding Channels (Charts Only)

Charts (line, area, bar, column, pie, donut, dot, scatter) use encoding channels to map data fields to visual properties:

```typescript
encoding: {
  x?: EncodingChannel,      // horizontal position
  y?: EncodingChannel,      // vertical position
  color?: EncodingChannel,  // series differentiation
  size?: EncodingChannel,   // bubble/dot scaling (quantitative)
  detail?: EncodingChannel, // grouping without visual mapping
}
```

**EncodingChannel:**
```typescript
{
  field: string,             // REQUIRED: column name in data
  type: FieldType,           // REQUIRED: "quantitative"|"temporal"|"nominal"|"ordinal"
  aggregate?: AggregateOp,   // "count"|"sum"|"mean"|"median"|"min"|"max"
  axis?: {
    label?: string,          // axis label (default: field name)
    format?: string,         // d3-format string, e.g. ",.0f" "$,.2f" ".1%"
    tickCount?: number,      // override tick count
    grid?: boolean,          // show gridlines
  },
  scale?: {
    domain?: [number, number] | string[],  // explicit domain
    type?: "linear"|"log"|"time"|"band"|"point"|"ordinal",
    nice?: boolean,          // clean tick values (default: true)
    zero?: boolean,          // include zero (default: true for quantitative)
  },
}
```

## Legend Configuration (Charts Only)

```typescript
legend?: {
  position?: "top"|"right"|"bottom"|"bottom-right"|"inline",
}
```

Position is responsive by default (the engine picks based on container width). Set explicitly to override.

## Label Density (Charts Only)

```typescript
labels?: {
  density?: "all"|"auto"|"endpoints"|"none",  // default: "auto"
  format?: string,           // d3-format for label values
}
```

| Mode | Behavior | Use when |
| --- | --- | --- |
| `auto` | Show labels with collision detection | Default, most charts |
| `all` | Show every label, no collision detection | Few data points, precise values matter |
| `endpoints` | First and last per series only | Line charts, emphasize start/end |
| `none` | No labels (tooltips + legend only) | Dense data, clean look |

## Spec Anti-Patterns

| Mistake | Fix |
| --- | --- |
| Using `nominal` for numeric field | Use `quantitative` for numbers, `temporal` for dates |
| Using `ordinal` for temporal data | Use `temporal`; ordinal is for ordered categories |
| Huge inline data arrays (500+ rows) | Aggregate or sample before passing to spec |
| Forgetting encoding.color for multi-series | Line/bar with groups needs `color` channel |
| Bar chart for time series | Use line or column for temporal data |
| Using chart for network data | Use `type: "graph"` with nodes + edges |
| Not specifying axis format for currency/pct | Add `axis: { format: "$,.0f" }` or `".1%"` |

For design anti-patterns (titles, color, annotations), see [design review](references/design-review.md).
