# Accessibility

What openchart does for accessibility automatically, what you can opt into, and how it maps to WCAG 2.1. If you're filling out a procurement checklist, this page is the answer key.

## Contents

- [What's automatic](#whats-automatic)
- [Custom alt text](#custom-alt-text)
- [Hiding a decorative chart](#hiding-a-decorative-chart)
- [Pattern fills](#pattern-fills)
- [Dev-mode contrast warnings](#dev-mode-contrast-warnings)
- [Colorblind-safe palettes](#colorblind-safe-palettes)
- [WCAG mapping](#wcag-mapping)

## What's automatic

Every chart gets these without configuration, in the vanilla adapter and all framework components (React, Vue, Svelte):

- **Alt text**: a generated description of the chart (mark type, title, data range, series, point count) set as `aria-label` on the SVG with `role="img"`.
- **Screen reader data table**: a visually hidden HTML `<table>` with the chart's data rendered alongside the SVG, so screen reader users can read the actual values.
- **Per-mark ARIA labels**: each bar, slice, and point carries a descriptive label for assistive technology.
- **Keyboard navigation**: the chart container is focusable; arrow keys move between marks, Enter/Space shows the tooltip, Escape dismisses it. Focus indicators use the `--oc-focus` token, which has distinct light and dark values so the ring is visible in both modes.
- **Dismissible tooltips**: Escape hides a visible tooltip even while hovering, without moving the pointer (WCAG 1.4.13).
- **Data tables**: semantic HTML (`<table>`, `<th scope="col">`), ARIA grid roles, sort state attributes, and a live region announcing sort/search changes.

## Custom alt text

The generated description is a reasonable default, not an editorial one. Replace it with the top-level `description` field (same convention as Vega-Lite):

```ts
const spec = {
  mark: "line",
  description: "US unemployment fell from 14.7% in April 2020 to 3.4% by January 2023.",
  data,
  encoding: { ... },
};
```

`a11y.description` is the canonical form and wins when both are set:

```ts
const spec = {
  mark: "line",
  a11y: { description: "US unemployment fell from 14.7% to 3.4%." },
  data,
  encoding: { ... },
};
```

When neither is present, auto-generation remains the fallback. Write alt text that states the takeaway, not the chart type; the data table already covers the values.

## Hiding a decorative chart

If a chart is purely decorative or the surrounding text already conveys the same information, opt it out of the accessibility tree:

```ts
const spec = {
  mark: "area",
  a11y: { hidden: true },
  data,
  encoding: { ... },
};
```

This sets `aria-hidden="true"` on the SVG and skips the screen reader table and keyboard navigation (a hidden chart must not be a tab stop). Use sparingly.

## Pattern fills

Color is the only series encoding by default. For readers with color vision deficiency, or output that may be printed in grayscale, opt into per-series SVG patterns on filled marks (bar, area, arc):

```ts
const spec = {
  mark: { type: "bar", fillPattern: "auto" },
  data,
  encoding: {
    x: { field: "quarter", type: "nominal" },
    y: { field: "twh", type: "quantitative", stack: "zero" },
    color: { field: "source", type: "nominal" },
  },
};
```

How `'auto'` behaves:

- Series get patterns in order: diagonal hatch, dots, crosshatch, vertical lines (cycling past four).
- The pattern is layered over the series color: the tile background is the series color and the pattern lines are contrast-picked (white or near-black) per light/dark mode.
- **Minimum-area rule**: marks thinner than 12px in their narrow dimension (thin stacked segments, sub-1% pie slivers) keep their solid fill. A pattern that small reads as noise, and the series is still identifiable from its larger siblings and the legend.
- Assignment is deterministic: the same spec always produces the same patterns, so visual baselines stay stable.

Two limitations to know about: gradient fills are replaced by a solid tile of the gradient's representative color when patterned, and legend swatches stay solid color.

The default is `'none'`. Line strokes don't participate; use `encoding.strokeDash` to differentiate line series without color.

## Dev-mode contrast warnings

Opt into WCAG contrast diagnostics at compile time:

```ts
import { compileChart } from "@opendata-ai/openchart-engine";

compileChart(spec, { width: 800, height: 500, dev: true });
```

With `dev: true`, the engine logs a `console.warn` for:

- **Adjacent series pairs below 3:1** (WCAG 1.4.11) on stacked/grouped filled marks. Series render in domain order, so consecutive series sit next to each other.
- **Series colors below 3:1 against the chart background** (skipped when the background is `transparent`, the default, since the host page's surface is unknown at compile time).
- **Text theme tokens below 4.5:1** against the background (WCAG 1.4.3).

Each warning names both colors, the measured ratio, and the nearest passing color (computed by adjusting lightness while preserving hue). Warnings are advisory: they never throw and never fire without the flag.

The gate is a compile option rather than an environment check on purpose. The engine runs in browsers, Node, and SSR; your host decides what "dev" means:

```ts
// e.g. in a Vite app
compileChart(spec, { width, height, dev: import.meta.env.DEV });
```

## Colorblind-safe palettes

The default categorical palette interleaves hues so adjacent slots stay separated under the common color vision deficiencies. Two tools keep it that way:

- `simulateColorBlindness(color, type)` and `checkPaletteDistinguishability(colors, type)` from `@opendata-ai/openchart-core`, covering `protanopia`, `deuteranopia`, `tritanopia`, and `achromatopsia`.
- The `testing--a11y--colorblind-palette-audit` story renders the default palette through all four simulations and is pinned by the visual regression suite, so palette changes get reviewed against it.

For guaranteed series identification independent of color, combine palettes with [pattern fills](#pattern-fills).

## WCAG mapping

| WCAG 2.1 criterion | Requirement | openchart behavior |
| --- | --- | --- |
| 1.1.1 Non-text Content | Text alternative for graphics | Automatic alt text; author override via `description` / `a11y.description` |
| 1.3.1 Info and Relationships | Structure available to AT | Screen reader data table; semantic table markup; per-mark ARIA labels |
| 1.4.1 Use of Color | Color not the only visual means | Opt-in `fillPattern: 'auto'`; `strokeDash` for lines; labeled marks |
| 1.4.3 Contrast (Minimum) | 4.5:1 for text | Default theme passes; dev-mode warnings flag failing text tokens |
| 1.4.11 Non-text Contrast | 3:1 for graphical objects | Dev-mode warnings flag failing series pairs and series/background combos |
| 1.4.13 Content on Hover or Focus | Dismissible, hoverable, persistent | Tooltips dismiss on Escape without pointer movement |
| 2.1.1 Keyboard | All functionality via keyboard | Arrow-key mark navigation, Enter/Space for tooltip, Escape to dismiss |
| 2.4.7 Focus Visible | Visible focus indicator | `--oc-focus` outline on container and focused marks, light and dark values |

Sonification and VPAT paperwork are out of scope for the library itself.
