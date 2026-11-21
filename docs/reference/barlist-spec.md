---
title: "BarListSpec"
description: "BarListSpec fields for ranked bar lists: encoding, groups, value domains and reference lines."
section: spec
order: 16
---

# BarListSpec

A `BarListSpec` (`type: 'barlist'`) is a ranked list: one row per item, each with a label, a proportional bar and a value, and no axes. It renders through `<BarList>` or `createBarList`.

See it: [Bar list](/docs/comparison/bar-list/).

## BarListSpec

Ranked rows with proportional tracks and value labels. `type: 'barlist'` selects this spec; it is not a Cartesian `ChartSpec`.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | `'barlist'` | required | Spec discriminant. |
| `data` | `DataRow[]` | required | Source rows. Non-finite value rows do not produce bars. |
| `encoding` | `BarListEncoding` | required | Label, value and optional group/color/description channels below. |
| `sort` | `'descending' \| 'ascending' \| null` | `'descending'` | Sort by numeric value within each group. `null` retains input order within groups. Groups remain in first-seen order. |
| `height` | `number \| 'auto'` | adapter-dependent when omitted | `'auto'` fits all rows admitted by `maxItems`, group headers, annotations and chrome; a number supplies a fixed height. See height behavior below. |
| `maxItems` | `number` | `20` | Maximum rows after grouping/sorting, across all groups. |
| `barHeight` | `number` | `6` | Bar thickness in pixels. |
| `cornerRadius` | `number \| 'pill'` | `'pill'` | Radius in pixels or half the bar height. |
| `annotations` | x-only refline array | `undefined` | Numeric value reference lines; supported subset below. |
| `labels` | `{ format?: string; prefix?: string; suffix?: string }` | `undefined` | Value label formatting, not the full Chart `LabelConfig`. Format defaults to `encoding.value.format`, then automatic; affixes default to empty strings. |
| `a11y` | `A11yConfig` | `undefined` | Accessible figure name and visibility; generated name when omitted. Static output is an image without row listitem roles. |
| `chrome` | `Chrome` | `undefined` | Title, subtitle, source, byline and footer. |
| `theme` | `ThemeConfig` | default theme | Theme overrides. |
| `watermark` | `boolean` | `true` | Show the brand. |
| `animation` | `AnimationSpec` | on | Live entrance animation (`false` disables it); static output never animates. |

### BarListEncoding

| Channel | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `EncodingChannel` (nominal) | required | Row name. Long visible names ellipsize; full text remains available in titles/accessibility. |
| `value` | `EncodingChannel` (quantitative) | required | Bar value and label; `format` is the default value format. |
| `group` | `EncodingChannel` (nominal or ordinal) | `undefined` | Section headings; first-seen group order is retained. |
| `subtitle` | `EncodingChannel` (nominal) | `undefined` | Secondary row text. |
| `color` | `EncodingChannel` (nominal) | row-index color cycle | Category-to-color mapping. |
| `description` | `DescriptionEncoding` | `undefined` | Authored row text; static bars receive titles. |
| `tooltip` | `EncodingChannel \| EncodingChannel[]` | `undefined` | Accepted by the spec; current barlist tooltips still show the default label and formatted value. |

`encoding.value.scale.domain: [lower, upper]` defaults to omission, which scales tracks against the largest absolute admitted value. An explicit domain must contain two finite increasing numbers and provides a shared comparison scale. Track lengths clamp to its bounds; value labels retain the source number. Use `[0, 1]` for rates or `[0, 3]` for lift.

Barlist annotations have type `Array<Omit<RefLineAnnotation, 'x' | 'y'> & { x: number; y?: never }>`: supply `type: 'refline'` and numeric `x`; `y` is not accepted. The renderer uses `stroke` (theme axis by default), `strokeWidth` (1px), `strokeDash` or `style` (solid by default; dashed/dotted supported), plus optional `label`, `fill`, `fontSize` and `fontWeight` for the label. A labeled refline reserves a top lane. References outside the value domain are omitted. This subset does not implement the Cartesian outside-placement or connector layout options.

**Height behavior:** the compiler uses a numeric spec height or the compile height budget when `height` is omitted. It drops rows that cannot fit, but retains the first row whenever there is positive plot area, even if the row is taller than that area. Dropped rows warn only when the spec authors a numeric `height`; an omitted, container-driven height cap stays silent. The live mount derives that budget from its container and can shrink a short list to content. It does not turn omission into unbounded auto height. `renderStaticSVG` instead defaults an omitted barlist height to `'auto'`; its numeric `options.height` overrides the spec. Set `height: 'auto'` explicitly when a live list must fit every admitted row. `maxItems` still limits the row count in every mode.

```ts
const spec: BarListSpec = {
  type: 'barlist',
  data: rows,
  encoding: {
    label: { field: 'step', type: 'nominal' },
    value: { field: 'share', type: 'quantitative', format: 'percent', scale: { domain: [0, 1] } },
    group: { field: 'section', type: 'nominal' },
    description: { field: 'rowText' },
  },
  sort: null,
  height: 'auto',
  annotations: [{ type: 'refline', x: 0.5, label: 'Target', style: 'dashed' }],
  labels: { prefix: '', suffix: '' },
  a11y: { description: 'Half of completed projects reach the target.' },
};
```
