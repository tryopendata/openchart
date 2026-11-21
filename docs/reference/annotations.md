---
title: "Annotations"
description: "Text, range and reference line annotations, with their position, connector and style fields."
section: spec
order: 8
---

# Annotations

Annotations are editorial marks placed at data coordinates: a text callout, a shaded range, a reference line. They live in the spec's `annotations` array and are positioned through the chart's scales, so they stay on their data point when the chart resizes or updates.

See it: [Annotations](/docs/framing/annotations/).

## Annotations

Data-positioned overlays. Source: `core/src/types/spec.ts`.

Use unique annotation `id` values for durable selection and editing. Notes preserve complete primary/subtitle text and rich spans; their numbers follow source text-annotation order before filtering, so gaps are intentional. Notes and markers support linked focus and click/tap emphasis.

Three annotation types are available, discriminated by the `type` field:

### TextAnnotation

A callout label positioned at a data coordinate.

| Field        | Type                 | Default                | Description                                                                                                            |
| ------------ | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `type`       | `'text'`             | (required)             | Discriminant.                                                                                                          |
| `x`          | `string \| number`   | (required)             | X-axis data value or position.                                                                                         |
| `y`          | `string \| number`   | (required)             | Y-axis data value or position.                                                                                         |
| `text`       | `string`             | (required)             | The annotation text. Supports `\n` for line breaks and `**bold**` spans.                                               |
| `subtitle`   | `string`             | `undefined`            | Optional muted second-tone text rendered below `text`. Use for supporting context (methodology, source, etc.). Supports `**bold**` too. |
| `maxWidth` | `number \| null` | `min(240, plotWidth - 2 * padding)`, at least 1px | Positive display wrapping width in pixels; null disables wrapping. |
| `subtitleFontSize` | `number` | `round(fontSize * 12 / 13)` | Optional positive subtitle size in pixels. |
| `dot`        | `boolean \| AnnotationDot` | see below        | Open-ring marker on the data point. Appears by default on non-arrowed connectors. `false` for none, an object to restyle. |
| `fontSize`   | `number`             | `13`                   | Font size override in pixels.                                                                                          |
| `priority` | `number` | source order | Lower values get placement and compact-inline preference; ties retain source order. |
| `responsive` | `boolean` | `true` | `false` pins the annotation inline and exempts it from thinning/count limits. |
| `fontWeight` | `number`             | `400` | Font weight override.                                                                                         |
| `offset`     | `AnnotationOffset`   | `undefined`            | Pixel offset from computed position. `{ dx?: number, dy?: number }`.                                                   |
| `anchor`     | `AnnotationAnchor`   | `'auto'`               | Label placement direction: `'top'`, `'bottom'`, `'left'`, `'right'`, `'auto'`.                                         |
| `connector`  | `boolean \| ConnectorType \| ConnectorConfig` | `true` | `'straight'`, `'curve'`, or `'drop-line'`; `{ type, arrow?, bend? }` for explicit control; `false` disables it.     |
| `connectorOffset` | `{ from?, to? }` | `undefined`            | Per-endpoint pixel offsets for the connector line.                                                                     |
| `background` | `string \| true`     | `undefined`            | Background plate behind the text, for readability over chart lines. `true` follows the theme surface.                  |
| `fill`       | `string`             | theme `annotationFill` | Fill color.                                                                                                            |
| `stroke`     | `string`             | theme `annotationText` | Stroke color. Also overrides the connector and marker stroke.                                                          |
| `opacity`    | `number`             | `1`                    | Opacity (0 to 1).                                                                                                      |
| `zIndex`     | `number`             | `0`                    | Render ordering. Higher values render on top.                                                                          |

#### Text: wrapping, line breaks, and bold spans

Curve connectors accept optional `bend: -1..1`; omitted or zero preserves the
existing automatic curve. Other connector types ignore `bend` with a warning.
An authored `offset` object pins placement even when both values are zero.

`\n` starts a new line. Each line renders as its own `<tspan>`. Multi-line blocks are left-aligned by default, or right-aligned when `anchor: 'left'` puts the block to the left of the point, so the block's facing edge lines up with the leader.

`**bold**` marks an inline bold span in `text` and in `subtitle`. Emphasis belongs on the key phrase, not the whole block:

```ts
{ type: 'text', x: '2022-06', y: 8.5, text: 'Inflation peaked at **8.5%**' }
```

Only matched pairs turn bold. An unmatched `**` (and an empty `****`) renders literally, so specs with stray asterisks aren't mangled. Bold spans are measured at weight 700, so bounds, collision nudging, and connector exits all account for them.

Primary text and subtitles default to weight 400. Set `fontWeight: 700` for a bold primary line or use `**bold**` for selective emphasis; adding a subtitle does not change the primary weight.

#### Connectors

The connector leaves the text block (primary text plus subtitle, treated as one box) on the side facing the data point, with a 6px standoff gap, and stops short of the marker at the other end. A curved connector is shaped to the data point and then pulled back along its end tangent, so the tail still aims at the marker. Two voices:

- **Emphasis.** An explicitly arrowed connector (`{ type: 'curve', arrow: true }`) is drawn in the label's text ink with a small open-V arrowhead, so the gesture reads as part of the sentence.
- **Quiet.** A non-arrowed curve, straight leader, or `'drop-line'` is a gray hairline. It points without competing with the words.

Connectors are dropped when they'd be noise rather than signal: a leader shorter than 8px, or one whose data point sits inside the text block. The marker still renders. A default annotation sits far enough off its point (28px) to draw a real leader without any `offset` authoring; you only lose the line by pulling the label back onto its own marker.

#### Dot marker

| Field         | Type     | Default                     | Description                       |
| ------------- | -------- | --------------------------- | --------------------------------- |
| `radius`      | `number` | `4`                         | Circle radius in pixels.          |
| `fill`        | `string` | theme `annotationMarkerFill` (neutral surface by default)            | Interior fill (the "open ring").  |
| `stroke`      | `string` | the connector's stroke      | Ring color.                       |
| `strokeWidth` | `number` | `1.5`                       | Ring width in pixels.             |

The marker sits on the data point itself, not on the pulled-back connector tip. You get one by default when a connector is enabled and carries no arrowhead, including drop-lines. An arrowed connector gets no marker unless you ask for one, since the arrowhead already marks the spot. `dot: false` is always bare; an explicit `dot` always wins. A default dot that lands on a line's endpoint marker takes the marker's fill and stroke, so the two draw as one ring.

### RangeAnnotation

A highlighted band or rectangle.

| Field         | Type               | Default                | Description                                                 |
| ------------- | ------------------ | ---------------------- | ----------------------------------------------------------- |
| `type`        | `'range'`          | (required)             | Discriminant.                                               |
| `x1`          | `string \| number` | `undefined`            | Start of the range on x-axis.                               |
| `x2`          | `string \| number` | `undefined`            | End of the range on x-axis.                                 |
| `y1`          | `string \| number` | `undefined`            | Start of the range on y-axis.                               |
| `y2`          | `string \| number` | `undefined`            | End of the range on y-axis.                                 |
| `extendToEdges` | `boolean`        | `true`                 | For ordinal band/point scales, whether the range extends from the data-point center to the band/step edge. Set `false` to anchor at data-point centers. No effect on linear/time scales. |
| `label`       | `string`           | `undefined`            | Range label text.                                           |
| `labelOffset` | `AnnotationOffset` | `undefined`            | Pixel offset for the label. `{ dx?: number, dy?: number }`. |
| `labelAnchor` | `AnnotationAnchor` | `'auto'`               | Label placement direction.                                  |
| `fontSize`    | `number`           | theme `small` (12px)                   | Font size override for the range label (px).                |
| `fontWeight`  | `number`           | `500`                  | Font weight override for the range label.                   |
| `fill`        | `string`           | theme `annotationRangeFill` (`#f0c040`) | Fill color.                                                 |
| `stroke`      | `string`           | `undefined`            | Stroke color.                                               |
| `opacity`     | `number`           | `1`                    | Opacity (0 to 1).                                           |
| `zIndex`      | `number`           | `0`                    | Render ordering.                                            |

Range behavior depends on which bounds are provided:

- `x1`/`x2` only: vertical band (full chart height)
- `y1`/`y2` only: horizontal band (full chart width)
- All four: rectangle

### RefLineAnnotation

A horizontal or vertical reference line.

| Field         | Type                              | Default                | Description                         |
| ------------- | --------------------------------- | ---------------------- | ----------------------------------- |
| `type`        | `'refline'`                       | (required)             | Discriminant.                       |
| `x`           | `string \| number`                | `undefined`            | X-axis value for a vertical line.   |
| `y`           | `string \| number`                | `undefined`            | Y-axis value for a horizontal line. |
| `label`       | `string`                          | `undefined`            | Line label text.                    |
| `style`       | `'solid' \| 'dashed' \| 'dotted'` | `'solid'`              | Line style.                         |
| `strokeWidth` | `number`                          | `1`                    | Line width in pixels.               |
| `labelOffset` | `AnnotationOffset`                | `undefined`            | Pixel offset for the label.         |
| `labelAnchor` | `AnnotationAnchor`                | `'auto'`               | Label placement direction.          |
| `labelPlacement` | `'auto' \| 'start' \| 'end' \| 'outside'` | `'auto'` unless `labelAnchor` is authored | Screen-space end selection, automatic containment, or a reserved outside gutter/lane. `labelAnchor` selects the side; an authored offset pins the base. |
| `fontSize`    | `number`                          | theme `small` (12px)                   | Font size override for the label (px). |
| `fontWeight`  | `number`                          | `400`                  | Font weight override for the label. |
| `fill`        | `string`                          | `undefined`            | Fill color.                         |
| `stroke`      | `string`                          | theme `annotationRule` | Stroke/line color.                  |
| `opacity`     | `number`                          | `1`                    | Opacity (0 to 1).                   |
| `zIndex`      | `number`                          | `0`                    | Render ordering.                    |

Provide `x` for a vertical line or `y` for a horizontal line. Both can be set for a crosshair.

With `labelPlacement: 'outside'`, horizontal lines reserve a right lane as wide as the widest wrapped label (capped at 160px or 25% of the width). Vertical lines share a lane above the plot: labels whose extents don't overlap pack into one row, and whole rows are admitted while the lane stays within 25% of the height. A label whose row doesn't fit falls back to automatic placement inside the plot with a warning. The lane shrinks before the title or subtitle does.

### Annotation example

```ts
annotations: [
  // Horizontal threshold line
  { type: "refline", y: 100, label: "Target", style: "dashed", stroke: "#e45" },
  // Highlighted time range
  {
    type: "range",
    x1: "2023-06-01",
    x2: "2023-09-01",
    label: "Q3",
    opacity: 0.08,
  },
  // Text callout with fine-tuned positioning
  {
    type: "text",
    x: "2023-07-15",
    y: 142,
    text: "All-time high",
    anchor: "top",
    offset: { dy: -8 },
    connector: true,
  },
];
```
