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

## Placement on Dense or Bubble Charts

Scatter/bubble charts create unique annotation challenges because circles are large and clustered. Small offsets (10-20px) almost always land on top of nearby dots. Follow these rules:

**Use large offsets.** On bubble charts, `offset: { dy: -50 }` or more is normal. Think of the annotation as living in the empty quadrant of the chart, not next to its data point. The connector line handles the visual link back.

**Anchor at the data point, offset into empty space.** Always set `x`/`y` to the actual data coordinates so the connector points to the right dot. Then use `offset` to push the text into a clear zone. Don't move the `x`/`y` anchor to approximate the label position (this disconnects the connector from the data).

**Scan for empty quadrants.** Before placing annotations, identify the chart's empty zones. Scatter plots typically have open corners (upper-left for low-x/high-y, lower-right for high-x/low-y). Place labels there with connectors back to their data points.

**Budget for bubble radius.** A dot with 13,000 enrollment and a dot with 400 enrollment have very different radii. The label for the larger dot needs to clear a bigger circle. When in doubt, overshoot the offset and let the connector do the work.

| Mistake | Fix |
| --- | --- |
| Small offset lands on adjacent dots | Use 40-100px offsets into empty chart regions |
| Annotation near chart edge gets clipped | Pull label inward with negative dx or dy |
| Anchor set to approximate position, not data point | Set x/y to actual data coords; use offset for visual position |
| Label in lower-left corner colliding with axes | Move to upper-left or use larger dy to clear axis labels |

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
- **Centering labels:** Use `labelAnchor: "top"`, `"bottom"`, or `"auto"` to center the label horizontally over the range. `"left"` (default) and `"right"` position the label at the corresponding edge.

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
- **Label placement:** `labelAnchor: "top"` (default) places the label above the line; `"bottom"` places it below. Use `labelOffset: { dy: N }` for fine-tuning.

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
