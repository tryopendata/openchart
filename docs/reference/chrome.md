---
title: "Chrome, labels and legends"
description: "Title, subtitle, source, byline and footer fields, plus value labels, endpoint labels and the legend."
section: spec
order: 6
---

# Chrome, labels and legends

Chrome is the text around the plot: eyebrow, title, subtitle, source, byline and footer. This page also covers the text inside and beside it: value labels on marks, endpoint labels at the end of each series, and the legend.

See it: [Title, subtitle and source](https://openchart.steamfield.io/docs/framing/chrome/), [Labels and legends](https://openchart.steamfield.io/docs/framing/labels-legends/) and [Endpoint labels](https://openchart.steamfield.io/docs/framing/endpoint-labels/).

## Chrome

Editorial text elements. Source: `core/src/types/spec.ts`.

```ts
interface Chrome {
  eyebrow?: string | ChromeText;
  title?: string | ChromeText;
  subtitle?: string | ChromeText;
  source?: string | ChromeText;
  byline?: string | ChromeText;
  footer?: string | ChromeText;
  brand?: string | ChromeText;
}
```

Each field accepts either a plain string or a `ChromeText` object for style overrides.

| Field      | Position                        | Default style                                                |
| ---------- | ------------------------------- | ------------------------------------------------------------ |
| `eyebrow`  | Above title                     | 11px, medium (500), uppercase, theme accent, leading accent dot |
| `title`    | Top, above chart                | 26px, semibold (600), `#09090b`                                  |
| `subtitle` | Below title                     | 14px, normal (400), `#71717a`                                |
| `source`   | Below chart area                | 12px, normal (400), `#71717a`                                |
| `byline`   | Below source                    | 12px, normal (400), `#71717a`                                |
| `footer`   | Below byline                    | 12px, normal (400), `#71717a`                                |
| `brand`    | Right-aligned on the source row | 12px, suppresses the default watermark                       |

**KPI metric row** is a separate top-level field on chart specs, not part of `Chrome`. Use `metrics: Metric[]` on the chart spec for a horizontal row of label+value cells rendered between the subtitle and the chart area. Each cell can carry a delta and a secondary value. See `Metric` in `core/src/types/spec.ts` for the full shape.

### ChromeText

When you need to override the default chrome styling:

```ts
interface ChromeText {
  text: string;
  style?: ChromeTextStyle;
}

interface ChromeTextStyle {
  fontSize?: number; // Pixels
  fontWeight?: number; // 400 = normal, 600 = semibold, 700 = bold
  fontFamily?: string; // CSS font family
  color?: string; // CSS color string
  maxLines?: number; // Cap on wrapped line count
}
```

Example:

```ts
chrome: {
  title: { text: 'Revenue by quarter', style: { fontSize: 28, fontWeight: 700 } },
  subtitle: 'FY2024 results',
  source: 'Source: Internal reporting',
}
```

Only the style properties you provide are overridden. Omitted properties use the theme defaults.

### maxLines

Caps how many lines the text wraps to. Extra lines are dropped and the last kept line is truncated with an ellipsis. This bounds the chrome element's contribution to layout height at any container width, which is useful when a long title would otherwise wrap to many lines on a narrow viewport. It applies whether the font size comes from a theme default or an explicit `fontSize` override.

```ts
chrome: {
  title: { text: 'A long headline that would wrap on a phone', style: { maxLines: 2 } },
}
```

`maxLines` caps height only. A single unbreakable word wider than the available width still overflows horizontally, same as without it.

### Chrome layout

The top-level `chromeLayout` property controls how chrome text height interacts with the container height budget.

| Value        | Behavior                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| omitted | Notes and the series summary grow the figure; title, subtitle, source, and other chrome subtract from the container height budget. |
| `'subtract'` | Keep the exact outer height; all chrome and notes subtract from it, shrinking the plot. |
| `'grow'`     | The container height is treated as the plot budget. The rendered SVG grows taller by the measured chrome height, so the plot keeps its full budget (minus axis and padding overhead) no matter how many lines the title wraps to. |

Reach for `'grow'` on fixed-height article or blog charts where a long title on a narrow phone must not compress the plot.

```ts
{
  mark: 'line',
  data: [...],
  encoding: {...},
  chromeLayout: 'grow',
  chrome: { title: 'A long headline that may wrap to several lines on a phone' },
}
```

`chromeLayout: 'grow'` supports faceted charts and layers; engine-added height is counted once. Read `layout.dimensions.height` for the final height and `layout.chrome.grownHeight` for the added height. The default note-growth policy is internal: `'notes'` is not a public spec value. Bar list, Sankey, map, and tilemap also honor the public spec/compile policies.

---

## Labels

Data label display configuration. Source: `core/src/types/spec.ts`.

The semantic format `percent` displays nonzero magnitudes below 0.1 percent as
`<0.1%` (or `>−0.1%` for negative values), while exact zero remains `0%`. This
applies to labels, tooltip fields, and table columns using the semantic keyword,
and to the exported `formatPercent` utility. Fraction-versus-pre-scaled detection
is unchanged. Explicit d3 formats retain their requested precision: use `.4%`
for four decimal places or `.1%` for ordinary rounding. Formatting uses the
library's existing default d3 locale; runtime locale replacement is unsupported.

```ts
interface LabelConfig {
  content?: 'label' | 'value' | 'label value';
  placement?: 'adaptive' | 'inside' | 'outside' | 'column';
  density?: LabelDensity;
  format?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  fontSize?: number;
}
```

| Field     | Type           | Default  | Description                                         |
| --------- | -------------- | -------- | --------------------------------------------------- |
| `content` | `'label' \| 'value' \| 'label value'` | `'value'` | Compose category/series names with formatted values on bar and range marks. |
| `prefix` | `string` | `''` | Literal text before the formatted value, not before the name. |
| `suffix` | `string` | `''` | Literal text after the formatted value. |
| `placement` | `'adaptive' \| 'inside' \| 'outside' \| 'column'` | `'adaptive'` | Bar/column placement; column is for simple horizontal bars. |
| `color` | `string` | fill-derived | Fixed label color. |
| `fontSize` | `number` | mark/theme default | Bar/column value-label size in pixels. |
| `density` | `LabelDensity` | `'auto'` | How many data labels to show.                       |
| `format`  | `string`       | auto     | d3-format override for label values, e.g. `",.0f"`. |

On `stack: 'normalize'`, value labels always show each segment's share of its stack, including when `content` is omitted or `'value'`. Share formatting prefers explicit `labels.format`, then the value channel's `format`, then the inferred `.0%` fallback. There is no raw-value label mode on normalized stacks.

For stacked bars, `label` is the series name; for simple bars it is the category. Range endpoint names come from the corresponding channel title, falling back to its field. For example, `labels: { content: 'label value', suffix: 'm' }` can produce `median 14m` and `p75 26m`. Range marks reserve measured endpoint space when `content` is explicit; fixed `frame` margins remain authoritative. Barlist labels accept only `format`, `prefix` and `suffix`; see [BarListSpec](./barlist-spec.md).

### LabelDensity

| Value         | Behavior                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `'all'`       | Show every label. No collision detection. Can overlap.                                                                   |
| `'auto'`      | Show labels with collision detection. Overlapping labels are hidden and only appear in tooltips.                         |
| `'endpoints'` | Show only the first and last label per series. Good for line charts where the trend matters more than individual values. |
| `'none'`      | Hide all labels. Rely on tooltips and the legend for value readout.                                                      |

---

## Endpoint labels

`ChartSpec.endpointLabels` and `LayerSpec.endpointLabels` accept `boolean | EndpointLabelsConfig`. Omission automatically shows a trailing endpoint column for two through eight identified line or overlapping-area series, normally replacing the traditional legend. Single-series charts have no column by default. Stacked areas and stacked columns require explicit opt-in, such as `endpointLabels: true` or `{ show: true }`. `false` or `{ show: false }` disables the column. An explicit `legend.show: true` can show the legend alongside it; `legend.show: false` keeps the legend hidden.

On stacked columns, each entry uses that series' rightmost available segment, anchors at the segment midpoint, and displays its own segment value rather than the cumulative stack total. A missing final series segment uses its last available segment; differing endpoint dates can qualify entries with dates. Column entries have no ring markers. The value field defaults to `encoding.y.field`.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `show` | `boolean` | automatic | Force the endpoint visibility choice on/off. |
| `maxSeries` | `number` | `8` | Automatic labels yield to a legend above this series count; explicit opt-in overrides the cutoff. This field alone is not opt-in. |
| `ends` | `'end' \| 'both'` | `'end'` | Trailing column only, or leading and trailing columns. |
| `content` | `'label' \| 'value' \| 'label value' \| { leading?: EndpointLabelContent; trailing?: EndpointLabelContent }` | name plus value on two lines | Select one-line composition or independent leading/trailing content. Omitted object sides retain the two-line default. |
| `valueField` | `string` | `encoding.y.field` | Field read from each endpoint observation. |
| `format` | `string` | y-axis format, then y-channel format, then automatic shared precision | Explicit value format. Source observations are not rounded. |
| `width` | `number` | `110` | Maximum series-name wrap width in pixels. |
| `anchor` | `'boundary' \| 'band'` | `'band'` | Stacked-area endpoint at cumulative boundary or band midpoint. |
| `placement` | `'end' \| 'interior'` | `'end'` | Endpoint column or fit-tested stacked-area interior names; entries that cannot fit inside retain end-column identification. |
| `showMarker` | `boolean` | `true` for eligible line endpoints | Draw a ring at the data endpoint; stacked bands and columns omit rings. |
| `markerStyle` | `{ fill?: string; stroke?: string; strokeWidth?: number; radius?: number }` | opaque canvas fill, series stroke, 2px stroke, 4px radius | Ring overrides; transparent fill is supported. |
| `showLeader` | `boolean` | `false` | Connect displaced end-column entries to their line endpoints. Stacked-band leaders remain automatic. |

Display-affecting configuration (such as `content` or `ends`) also counts as explicit opt-in unless `show: false` is set. Compact layouts and automatic width budgeting can demote automatic endpoint columns to the legend. Explicit opt-in survives the normal compact-width suppression, but fixed `frame.right` (and `frame.left` for `ends: 'both'`) remains authoritative: if the measured column and gap cannot fit, the endpoint column is demoted even when requested. The legend can provide identification unless explicitly hidden; fixed gutters do not expand to fit the column.

```ts
endpointLabels: {
  show: true,
  content: 'label value',
  format: ',.0f',
}
```

For a weekly stacked-column/history pair, author the same temporal domain and `frame` on both figures, leaving a right gutter large enough for the measured endpoint labels. See [static rendering](../static-rendering.md#aligned-figures).

---

## Legend

`legend` takes a `LegendConfig` on chart, layer, Sankey, tilemap and map specs. On line charts with two to eight series, endpoint labels normally replace it (see [Endpoint labels](#endpoint-labels)). Source: `core/src/types/spec.ts`.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `show` | `boolean` | `true` | `false` hides the legend. |
| `position` | `'top' \| 'top-left' \| 'right' \| 'bottom' \| 'bottom-right' \| 'inline'` | responsive | Fixed position. Omitted, the layout picks one for the container width. |
| `offset` | `{ dx?, dy? }` | `undefined` | Pixel nudge from the computed position. |
| `columns` | `number` | `undefined` | Column count for a horizontal legend. Overrides the row limit. |
| `maxRows` | `number` | `2` | Rows a top legend may use before it truncates. |
| `symbolLimit` | `number` | `undefined` | Entries shown before the rest collapse into "+N more". |
| `exclude` | `string[]` | `undefined` | Series left out of the legend. They still render. |
