# Annotations

Annotations are the editorial layer on top of data visualizations. They highlight insights, call out outliers, and provide context. Supported on charts and graphs.

All annotation types share these base properties:

```typescript
{
  label?: string,       // human-readable label
  fill?: string,        // fill color
  stroke?: string,      // stroke color
  opacity?: number,     // 0 to 1
  zIndex?: number,      // render ordering (higher = on top)
}
```

## Text Annotation

Callout at a specific data point.

```typescript
{
  type: "text",
  x: string | number,          // data coordinate
  y: string | number,          // data coordinate
  text: string,                // annotation text (supports \n for multiline)
  fontSize?: number,
  fontWeight?: number,
  offset?: { dx?: number, dy?: number },  // pixel offset from position
  anchor?: "top"|"bottom"|"left"|"right"|"auto",
  connector?: boolean | "curve",  // true: straight line, "curve": curved arrow, false: none
  connectorOffset?: {
    from?: { dx?: number, dy?: number },  // offset at the label end of the connector
    to?: { dx?: number, dy?: number },    // offset at the data point end of the connector
  },
  background?: string,           // background color behind text for readability
}
```

**Tips:**
- Use `\n` in `text` for multi-line annotations
- Set `background` to improve readability over chart lines
- `connector` defaults to `true` (straight line from label to point)
- `"curve"` connector draws a curved arrow with arrowhead
- `anchor: "auto"` lets the engine pick the best position

## Range Annotation

Highlighted region of the chart.

```typescript
{
  type: "range",
  x1?: string | number,        // vertical band start
  x2?: string | number,        // vertical band end
  y1?: string | number,        // horizontal band start
  y2?: string | number,        // horizontal band end
  labelOffset?: { dx?: number, dy?: number },
  labelAnchor?: "top"|"bottom"|"left"|"right"|"auto",
}
```

- Set only `x1`/`x2` for a vertical band
- Set only `y1`/`y2` for a horizontal band
- Set all four for a rectangle
- Use low `opacity` (0.1-0.2) so the data shows through

## Reference Line

Horizontal or vertical threshold/baseline line.

```typescript
{
  type: "refline",
  x?: string | number,         // vertical line at this x value
  y?: string | number,         // horizontal line at this y value
  style?: "solid"|"dashed"|"dotted",
  strokeWidth?: number,
  labelOffset?: { dx?: number, dy?: number },
  labelAnchor?: "top"|"bottom"|"left"|"right"|"auto",
}
```

- Set `x` for a vertical reference line
- Set `y` for a horizontal reference line
- Use `style: "dashed"` for targets/thresholds

## Annotation Editing

Chart elements are draggable when `onEdit` is passed to `<Chart>`. This covers text annotations, connector endpoints, range/refline labels, chrome, series labels, and the legend.

See [editing reference](editing.md) for the full `onEdit` API, `ElementEdit` type, and how to persist each edit back to the spec.

## Example: Annotated Line Chart

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
