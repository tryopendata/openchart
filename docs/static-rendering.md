# Static rendering

Import `renderStaticSVG` from `@opendata-ai/openchart-vanilla/static` for server builds, reports and framework server components. It returns a standalone SVG string without `window`, `document`, `happy-dom`, animation, or a shared render lock. Supported specs are chart, layer, barlist, tilemap and geomap; table, Sankey and graph are not supported.

```ts
import { renderStaticSVG } from '@opendata-ai/openchart-vanilla/static';

const svg = renderStaticSVG(spec, {
  width: 680,
  height: 320,
  idPrefix: 'weekly-light',
  darkMode: 'off',
  precision: 3,
});
```

Options include `width`, `height`, `theme`, `darkMode`, `renderer`, `watermark`, `measureText`, `idPrefix` and `precision`. `precision` is an integer from 0 through 15, or `null` for raw doubles; it defaults to 3. Text, labels, identity values and authored descriptions are not rounded. `measureText` is a per-call compiler text measurer; provide the same font metrics in each build for stable layout. `renderer` does not turn the returned SVG into a canvas.

| Option | Default | Meaning |
| --- | --- | --- |
| `width` | `640` | Compile width in pixels; authored chart/layer dimensions remain authoritative. |
| `height` | `420` | Compile height in pixels; authored chart/layer dimensions remain authoritative. For barlists, an explicit option overrides spec height; omission defaults an omitted spec height to `'auto'`. |
| `theme` | `undefined` | Per-call overrides composed with the spec/default theme. |
| `darkMode` | light | `'force'` selects dark; `'off'`, `'auto'` and omission select light on the server. |
| `renderer` | `'auto'` | Compile renderer selection; the returned artifact is always SVG. |
| `watermark` | spec/default policy | Optional brand override; explicitly authored spec and family precedence still apply. |
| `measureText` | compiler estimate | Per-call font measurement function. |
| `idPrefix` | `undefined` | Stable XML-safe scope prefix; omitted calls use deterministic standalone IDs. |
| `precision` | `3` | Integer 0–15 for geometry, or `null` to retain raw doubles. |

Static output contains no scripts, animation controls, focusable mark navigation, hidden HTML table or per-mark `aria-label`. Its authored mark tooltip is a `<title>`; the figure owns the accessible name.

Use a unique, stable `idPrefix` for each figure in a document. It must start with a letter or underscore and contain only letters, digits, underscores, periods or hyphens. IDs and their references share a per-call scope, so calls can interleave safely. Without `idPrefix`, ids are namespaced `ocs-<hash>-…`, where the hash covers the spec and options, so they never repeat the live charts' `oc-…` ids or those of a different unprefixed figure; identical calls still produce identical ids. The root `id` and map style scoping need an explicit prefix. Identical inputs and options produce identical bytes in the same environment. Temporal scales and date formatting can depend on the host timezone; use a consistent timezone, such as `TZ=UTC`, across builds.

Chart, layer and barlist colors and role styles are serialized as attributes, without CSS variables or a theme stylesheet. Theme them through the `theme` option. Map and tilemap output retains its scoped theme style block. The root carries `data-theme`; a prefixed root also has `id="<idPrefix>-oc-root"`. Serialization escapes XML and adds `xmlns:xlink` when an xlink attribute needs it.

## Two themes and accessible tables

Render once with `darkMode: 'off'` and once with `darkMode: 'force'`, using distinct prefixes. `auto` resolves to light on the server. The host chooses which SVG to display and supplies its own figure caption, theme-switching CSS and HTML data table. Static legends and note markers have no button roles or tab stops.

Use `a11y.description` for the figure's finding. Use `encoding.description: { field: 'rowText' }` for a data mark's authored text, or `{ value: 'Published green rate' }` for a constant description. Static shapes receive a direct `<title>` for pointer inspection, without per-mark `aria-label`; live mounts use mark descriptions for keyboard inspection. A line or area is one path per series: a description field must be constant within that series. For per-observation text, add a point layer and put the row description there.

Primary data shapes carry `data-mark`. Identity attributes such as `data-agent` or `data-day` come from non-quantitative position channels, color, detail and key fields; a series path includes only identities shared by every observation. Identity field names are normalized for attributes; reserved names receive `field-` prefixes. Errorbar caps carry no duplicate identity. Dumbbell heads and lollipop stems retain live labels and keyboard navigation, while provenance attributes belong to their primary connector or point. Isolated published observations in line and ordinary area series render as points; an ungrouped `y`/`y2` area band instead renders an isolated observation as a rule spanning its interval. Missing observations remain gaps.

For a decorative cell inside a host table, use `display: 'sparkline'` and `a11y: { hidden: true }`. Supply the value and interval text in the table itself. Layered sparkline cells share the compact display defaults and reserve space for errorbar caps and point radii.

## Aligned figures

Use identical widths, `frame: { left: 48, right: 96 }`, temporal x domains and annotation dates on both figures. Fixed left and right values set plot margins and win over automatic label reserves; leave enough right margin for endpoint labels and outside reference labels. Neither margin may be negative, and they must leave a usable plot width. Temporal columns can specify `encoding.x.interval: 'week'`. Omission prefers an aligned calendar cadence, then falls back to the smallest positive millisecond gap; spacing that does not align with the chosen interval warns.

For a history figure, use a constant line description, an area interval band, and a point layer with row descriptions. Use the same temporal domain and frame for the weekly column figure below it. The gallery's `static/aligned-pair` demonstrates the shared plot bounds.

Run `bun scripts/static-budget.ts` to measure the consuming page's eight figures and 30 cells of each of three kinds, all in two themes. It reports combined gzip bytes, per-cell gzip bytes and rendering duration, and rejects totals above 80,000 bytes. The host's HTML and stylesheets need their own budget.
