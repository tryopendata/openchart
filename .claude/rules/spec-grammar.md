---
paths:
  - "**/*"
---

# Spec Grammar and Architecture

OpenChart's declarative spec grammar and compilation pipeline are modeled on the encoding-centric approach pioneered by the academic visualization grammar tradition (Wilkinson's Grammar of Graphics, implemented through Vega-Lite's high-level encoding model and Vega's lower-level runtime).

## Spec Design Principles

**Encoding-centric, not mark-centric.** Users declare *what* data maps to *which* visual channel (x, y, color, size), not *how* to draw shapes. The engine infers mark type, scale type, axis formatting, and legend placement from the encoding + chart type. This is the core insight from the grammar-of-graphics tradition: visualization is a mapping from data space to visual space.

**Sensible defaults, full override.** A minimal spec (type + data + encoding) should produce a publication-ready chart. The engine auto-generates:
- Scale types from field types (quantitative -> linear, temporal -> time, nominal -> band/point)
- Axis tick counts, formats, and labels
- Legend position and entries
- Color palette assignment
- Nice domain rounding

Users override any of these through explicit config on the encoding channel (axis, scale) or top-level spec properties (theme, legend, labels).

**Field types drive everything.** The four field types (quantitative, temporal, nominal, ordinal) determine scale selection, axis formatting, mark encoding, and aggregation behavior. Getting the field type right is the single most important decision in a spec.

## Architecture: The Compilation Pipeline

The engine follows a staged compilation pipeline, similar to how Vega-Lite compiles to Vega, which then compiles to a dataflow graph:

```
ChartSpec (user-authored JSON)
  -> normalize (fill defaults, validate)
  -> compile data (group, aggregate, sort)
  -> resolve scales (data domain -> pixel range)
  -> compute layout (axes, labels, annotations, legend, chrome)
  -> produce ChartLayout (engine output)

ChartLayout (engine output)
  -> SVG renderer (vanilla package)
  -> or React wrapper (react package)
```

Each stage is pure and testable. The engine never touches the DOM. Rendering is a separate concern handled by the vanilla/react packages.

## Key Grammar Concepts

**Encoding channels** map data fields to visual properties:
- Position: `x`, `y` (the primary data mapping)
- Color: `color` (categorical grouping or sequential value)
- Size: `size` (bubble/dot scaling)
- Detail: additional grouping without visual encoding

**Scales** are the bridge between data values and pixel/color values. They're inferred from field type but overridable:
- `linear` for quantitative
- `time` for temporal
- `band` for nominal on bar charts
- `point` for nominal on line/scatter
- `log` for explicit override

**Marks** are the geometric primitives (line, rect, arc, point, area). The chart type selects the mark. Users don't configure marks directly - they configure encodings and the engine produces marks.

**Annotations** are the editorial layer on top of the data layer. They operate in data coordinates (not pixel coordinates) and get resolved to pixels through the same scale system. This keeps annotations stable across responsive resizes.

**Chrome** (title, subtitle, source, byline) is the editorial framing. It's not part of the data visualization grammar proper - it's the publication wrapper.

## When Adding New Features

- New visual properties should be encoding channels, not one-off config
- New chart types should compose from existing mark primitives when possible
- Default behavior should be inferred from field types, not require explicit config
- The spec should read like a description of *what to show*, not *how to render it*
- Keep the spec surface area small: fewer top-level properties, richer inference
