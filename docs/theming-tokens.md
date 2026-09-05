# Migration Guide

## Theming Design Tokens

This release widens `ThemeConfig` to expose every design-decision field and unifies CSS custom properties with the JS theme engine. All changes are backward-compatible. Existing theme configs continue to work without modification.

### What changed

**Before:** `ThemeConfig` covered colors, font family/sizes, 4 spacing fields, border radius, and chrome color (string only). Font weights, chrome typography, semantic colors, and additional spacing fields were hardcoded in `DEFAULT_THEME` with no override path. CSS custom properties in `tokens.css`/`dark.css` were hand-maintained separately from the JS theme.

**After:** `ThemeConfig` covers everything. CSS custom properties are generated from the resolved JS theme at mount time. The static CSS files serve as SSR/pre-mount fallback defaults.

### New ThemeConfig fields

```ts
const theme: ThemeConfig = {
  colors: {
    // Existing fields still work as plain strings
    background: '#ffffff',
    text: '#1a1a1a',

    // New: semantic colors
    positive: '#10b981',
    negative: '#e11d48',
    annotationFill: 'rgba(0,0,0,0.05)',
    annotationText: '#555',

    // New: TokenValue pairs for explicit light/dark control
    background: { light: '#fff1e5', dark: '#1a1311' },
    text: { light: '#33302e', dark: '#f2dfce' },
  },

  fonts: {
    // New: weight scale
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },

  spacing: {
    // Existing
    padding: 16,
    chromeGap: 4,

    // New
    chromeToChart: 8,
    chartToFooter: 12,
    axisMargin: 4,
  },

  // New: per-element chrome typography (was string-only for color)
  chrome: {
    title: { fontWeight: 700, fontSize: 24, lineHeight: 1.2 },
    subtitle: { fontWeight: 400, lineHeight: 1.4 },
    eyebrow: { color: '#e3120b', fontWeight: 700 },

    // Plain strings still work (color-only, backward-compatible)
    source: '#666',
  },

  // New: series color assignment strategy
  seriesStrategy: 'accent-neutral',
};
```

### TokenValue: explicit light/dark colors

Any color field in `ThemeConfig` now accepts `TokenValue`:

```ts
type TokenValue = string | { light: string; dark: string };
```

When you pass a `{ light, dark }` pair, `adaptTheme()` uses your explicit dark value instead of computing one algorithmically. Plain strings still work exactly as before.

```ts
// Before: adaptTheme() guesses a dark version of salmon
{ colors: { background: '#fff1e5' } }

// After: you control both modes
{ colors: { background: { light: '#fff1e5', dark: '#1a1311' } } }
```

### SeriesStrategy

Controls how categorical colors are assigned based on series count. Default is `'palette'`, which preserves current behavior exactly.

```ts
// Editorial convention: accent-only for single series,
// accent + neutral grays for 2-4, full palette for 5+
seriesStrategy: 'accent-neutral'
```

The neutral grays are surface-aware: on light backgrounds the second series gets the darkest gray (strongest contrast first), on dark backgrounds the brightest.

### Named presets

Five presets exported from `@opendata-ai/openchart-core`:

| Preset | Feel |
|--------|------|
| `editorial` | Current default (empty config, zero drift) |
| `essay` | Serif titles, warm background, generous spacing |
| `wire` | Monospace, dense, tight chrome, dashboard feel |
| `broadsheet` | Newspaper editorial: warm paper, red masthead `rule` and eyebrow, 24/700 title, square corners |
| `terminal` | Dense dark product surface, dark in both modes, one cyan accent (`seriesStrategy: 'accent-neutral'`) |

```ts
import { essay, wire } from '@opendata-ai/openchart-core';

// React
<Chart spec={spec} theme={essay} />

// Vanilla
createChart(container, spec, { theme: wire });
```

### categoricalFill and hairline

`ThemeColors` carries two fields beyond `categorical`: `categoricalFill` (the
quieter variant used for area-filling marks — bar, area, arc, waffle,
calendar, rect) and `hairline` (the structural line color for axis lines and
separators, distinct from `gridline`, which is lighter). If you set only
`colors.categorical`, `categoricalFill` is copied from it so a custom palette
never drifts between strokes and fills; set `categoricalFill` explicitly to
control the two independently.

```ts
theme: {
  colors: {
    categorical: ['#1d5f8a', '#e3120b', '#7fb0d3'],
    categoricalFill: ['#3b7097', '#ee493a', '#97c2e2'],
    hairline: 'rgba(0,0,0,0.14)',
  },
}
```

A domain with more series than the palette carries (six by default) extends
from a secondary six-slot ramp and emits a warning — six categorical series is
already the point where a chart should bucket the tail, facet, or
direct-label instead of adding a seventh hue.

### The derived neutral ramp

Every secondary gray in the system — `--oc-gray-100` through `-800`,
`--oc-text-secondary`, `--oc-text-faint`, `--oc-border` — is computed by
mixing the theme's `text` color toward its `background`, not read from a
fixed zinc ladder. A warm or cool custom theme gets warm or cool grays for
free instead of zinc showing up uninvited beside the palette. The ramp lives
on `ResolvedTheme.colors.neutral` (`100`/`200`/`300`/`400`/`600`/`800`, plus
`secondary` = `800`, `faint` = `300`, `border` = `100`, plus `surface`) and is
computed once in `resolveTheme`/`adaptTheme`; mounts stamp the CSS tokens from
it. `surface` is the opaque color the theme paints on — the background itself
when it is opaque, otherwise the mode's `--oc-bg` token — and is the single
source for knockout rings, stacked-segment seams, table cell fills, graph node
rings and the stamped `--oc-bg`. When the
background is transparent (the default) the ramp falls back to the static
token defaults, which is why the default theme and the generated `tokens.css`
never disagree.

### Radius ladder and hover tokens

| Token | Default | Used for |
|---|---|---|
| `--oc-radius-sm` | 2px | mark corners (bars, calendar/waffle cells), legend swatches, focus rings |
| `--oc-radius-md` | 6px | inputs, buttons, delta chips |
| `--oc-radius-lg` | `var(--oc-border-radius)` (8px) | tooltip, listbox, panels, graph legend/search |
| `--oc-radius-full` | 999px | pill-shaped chips |
| `--oc-hover-dim` | 0.3 | opacity the rest of a series/legend drops to on hover |
| `--oc-hover-duration` | 140ms | hover fade transition |
| `--oc-map-hover-dim` | 0.75 | map-local override; dimming 3000 county paths at 0.3 reads as a blackout, so maps use a lighter dim and only on legend-bin hover, never on feature hover |
| `--oc-positive-tint` / `--oc-negative-tint` | 10% color-mix toward `--oc-bg` | delta chip backgrounds |

`--oc-border-radius` (8px) is the one users typically override; it drives
containers and tooltips. Mark geometry uses the fixed `--oc-radius-sm`
regardless, so a theme with `borderRadius: 0` still draws a 2px bar-end
radius.

`--oc-positive`/`--oc-negative` are generated to match
`DEFAULT_THEME.colors.positive`/`.negative` exactly in both modes — a
`token-theme-parity` test asserts this, along with the four weight tokens,
`--oc-gridline`, `--oc-axis`, `--oc-border-radius`, `colors.neutral`, and
`--oc-animation-stagger`, so the JS theme and the generated CSS tokens can't
drift apart the way they did before this release.

### The editorial rule

`ThemeConfig.rule` draws a short colored bar above the chrome block — the
Economist/FT masthead device. It is `null` on every theme but `broadsheet`.

```ts
theme: {
  rule: { color: { light: '#e3120b', dark: '#f4463f' }, width: 40, thickness: 3 },
}
```

`color` accepts a `TokenValue`, so it goes through the same light/dark pairing
as `chrome.*.color` and needs no dark-mode branch. `computeChrome` reserves
`thickness + chromeGap` above the eyebrow/title and the renderer draws it as
`<rect class="oc-chrome-rule">`. No top chrome means no rule.

### CSS custom properties

`--oc-*` custom properties are now stamped on each `.oc-root` container from the resolved JS theme at mount time. This means:

- **Two charts with different themes on the same page** each get correct `--oc-*` values (per-container scoping).
- **`tokens.css` and `dark.css` are fallback defaults**, not the source of truth. They still work for SSR, static HTML, and pre-mount styling.
- **If you were reading `--oc-*` values from CSS** to style surrounding UI, those values now reflect the actual resolved theme rather than the hardcoded defaults. This is almost certainly what you wanted, but worth noting.

No action required. If you import `tokens.css`/`dark.css`, keep doing so. The JS-stamped properties take precedence via inline style specificity.
