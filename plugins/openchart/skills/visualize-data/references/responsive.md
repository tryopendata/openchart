# Responsive Charts

Charts are responsive by default (`responsive: true`). The engine uses a ResizeObserver to detect container size changes and recompiles the full layout at the new dimensions. No CSS media queries are involved - everything is computed at compile time based on container width.

## Breakpoints

Three breakpoints based on container width:

| Breakpoint | Width | Typical context |
| --- | --- | --- |
| `compact` | < 400px | Mobile, small embeds, sidebar widgets |
| `medium` | 400-700px | Tablet, half-width layouts |
| `full` | > 700px | Desktop, full-width |

## What the Engine Auto-Handles

Each breakpoint applies a **layout strategy** that adjusts these properties automatically:

| Property | Compact | Medium | Full |
| --- | --- | --- | --- |
| Data labels | Hidden | Important only | All shown |
| Legend position | Top | Top | Right |
| Annotations | Tooltip-only | Inline | Inline |
| Axis tick density | Minimal | Reduced | Full |

These are defaults. Explicit spec values (like `legend: { position: "top" }` or `labels: { density: "all" }`) override the responsive strategy.

## Breakpoint Overrides

Use the `overrides` field to provide different chrome, labels, legend, or annotations per breakpoint. Overrides are shallow-merged into the base spec at compile time when the container matches.

```js
{
  type: "line",
  data: [...],
  encoding: { ... },
  chrome: {
    title: "Inflation hit a 40-year high in June 2022",
    subtitle: "CPI year-over-year % change vs federal funds rate, 2010-2026"
  },
  overrides: {
    compact: {
      chrome: {
        title: "Inflation hit a 40-year high",
        subtitle: "CPI YoY % change vs fed funds rate"
      },
      legend: { show: false },
      labels: { density: "none" }
    },
    medium: {
      chrome: {
        title: "Inflation hit a 40-year high in June 2022"
      }
    }
  }
}
```

**Override fields:** `chrome`, `labels`, `legend`, `annotations`. Each is shallow-merged (not deep-merged) with the base spec value. Annotations are replaced entirely, not merged.

**Priority:** If no override exists for the current breakpoint, the base spec is used unchanged.

## Legend Hiding

Set `legend: { show: false }` to suppress the legend entirely. Useful for bar charts where the y-axis already labels each category, making the legend redundant:

```js
{
  type: "bar",
  encoding: {
    x: { field: "value", type: "quantitative" },
    y: { field: "platform", type: "nominal" },
    color: { field: "platform", type: "nominal" }
  },
  legend: { show: false }
}
```

You can also hide the legend only at compact widths via overrides:

```js
overrides: {
  compact: { legend: { show: false } }
}
```

## Chrome Text Wrapping

Long chrome text (titles, subtitles, source) automatically wraps to multiple lines based on container width. The engine uses word-boundary wrapping with the same character-width heuristics used for layout computation.

- Text wraps at word boundaries when it exceeds the available width (container width minus padding)
- Each line becomes a separate `<tspan>` element in the SVG
- The layout system reserves vertical space for wrapped lines

While wrapping works, shorter text is still preferable. Wrapped titles lose the punchy single-line impact that makes charts scannable. Use overrides to provide shorter text at compact widths rather than relying on wrapping.

## What the Engine Does NOT Automatically Do

- Switch chart types (e.g., column to bar) at small sizes
- Reduce data point count for dense series
- Rotate axis labels to fit

## Designing for Multiple Sizes

### Write short titles first

Titles should fit at compact width (~340px usable after padding). Aim for titles under ~25 characters. If a title needs more context at full width, put the detail in the subtitle:

```js
// Good - fits at all sizes
chrome: {
  title: "Inflation hit a 40-year high",
  subtitle: "CPI year-over-year % change vs fed funds rate, 2010-2026"
}

// Bad - truncates at compact
chrome: {
  title: "Inflation hit a 40-year high in June 2022"
}
```

### Choose chart types that work narrow

Horizontal bar charts handle narrow containers better than column charts when you have many categories, because category labels sit on the y-axis where they have room to breathe:

```js
// Good for narrow containers - 7 categories read fine
{ type: "bar", encoding: { x: { field: "value" }, y: { field: "category" } } }

// Problematic narrow - 7 x-axis labels overlap
{ type: "column", encoding: { x: { field: "category" }, y: { field: "value" } } }
```

Column charts work fine with few categories (2-5) or when x-axis labels are short.

### Shorten axis labels

Long category labels on the x-axis of column charts overlap at compact widths. Use abbreviations:

```js
// Good
{ quarter: "Q1 '24" }

// Bad at compact
{ quarter: "Q1 2024" }
```

For temporal x-axes, the engine reduces tick count automatically via `axisLabelDensity`. You rarely need to intervene.

### Mind the legend

The legend auto-positions to "top" at compact/medium and "right" at full. For bar charts where the y-axis already labels each category, hide the legend with `legend: { show: false }` to reclaim vertical space. You can also hide it only at compact widths via `overrides: { compact: { legend: { show: false } } }`.

When color encoding is needed for emphasis (e.g., highlight one bar in red, rest gray), keep series names short to reduce legend clutter.

### Reduce annotation density

At compact, annotations switch to tooltip-only automatically. But explicitly placed annotations (`type: "text"`) may still overlap if positioned for full-width layouts. For charts that will render at compact:

- Use fewer annotations
- Prefer `type: "refline"` (adapts better) over `type: "text"` (fixed position)
- Keep annotation label text short

### Test at 375px

The most common mobile viewport is 375px (iPhone). Before publishing, verify your chart renders cleanly at this width. The three-second test applies double at mobile: if the title clips or labels overlap, the chart fails.

## Spec Properties That Affect Responsiveness

| Property | Effect |
| --- | --- |
| `responsive: true` (default) | Enables ResizeObserver recompilation |
| `responsive: false` | Renders once at initial container size |
| `legend: { show: false }` | Hides legend entirely (saves space) |
| `legend: { position: "top" }` | Overrides responsive legend placement |
| `labels: { density: "none" }` | Forces labels off regardless of breakpoint |
| `labels: { density: "all" }` | Forces labels on regardless of breakpoint (may overlap at compact) |
| `encoding.x.axis.tickCount` | Overrides responsive tick reduction |
| `encoding.x.scale.nice: false` | Prevents padding at axis ends (saves space) |
| `overrides: { compact: { ... } }` | Breakpoint-conditional spec values |

## Known Limitations

1. **Overrides are shallow-merged** - You can override chrome, labels, legend, and annotations per breakpoint, but not encoding or data. Chart type and data are fixed across breakpoints.
2. **No axis label rotation** - Labels that don't fit are dropped, not rotated.
3. **Text wrapping is heuristic** - Word wrapping uses estimated character widths (~0.55× font size). Actual rendered widths may differ slightly from estimates.
