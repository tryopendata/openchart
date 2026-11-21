---
title: "Theme"
description: "ThemeConfig fields for colors, fonts, spacing and chrome, and the DarkMode setting."
section: spec
order: 10
---

# Theme

`theme` overrides the default colors, fonts, spacing and chrome styles. The same `ThemeConfig` shape is accepted by the spec, the framework theme providers and the mount options, which merge in that order. `DarkMode` chooses between the light and dark palettes.

See it: [Theming and tokens](/docs/style/theming/), [Presets](/docs/style/presets/) and [Dark mode](/docs/style/dark-mode/).

## ThemeConfig

Public authored theme overrides live in `core/src/types/spec.ts`. Every field is optional. Use `ThemeConfig` for input and `ResolvedTheme` for compiled output; the former public `Theme` alias is removed.

`mergeThemeConfig()` deep-merges authored layers before `resolveTheme()` supplies defaults. Component theme props override provider themes; mount/compile options override the spec. In a `LayerSpec`, chrome, axes and legend use the layer theme (falling back to the first leaf's); each leaf's marks use its theme merged over the layer theme. Nested objects merge, arrays and `{ light, dark }` TokenValues replace atomically, and null replaces. `colors: string[]` is shorthand for `colors.categorical`.

```ts
import { broadsheet, mergeThemeConfig } from '@opendata-ai/openchart-core';
import type { ThemeConfig } from '@opendata-ai/openchart-core';

const theme: ThemeConfig = mergeThemeConfig(broadsheet, {
  fonts: { sizes: { small: 12, axisTick: 12 } },
  chrome: { title: { fontSize: 28 } },
  rule: { width: 80 },
});
```

Authored `chrome.<element>.fontSize` takes precedence over propagation from `fonts.sizes`, including across theme layers. Theme chrome values are objects such as `{ color: '#333' }`; string color shorthand is removed. Spec chrome text shorthand (`chrome: { title: 'A title' }`) remains valid.

### Color overrides

Single colors accept `TokenValue` (`string | { light: string; dark: string }`). Palette arrays contain color strings. These are light-mode defaults unless a pair is shown:

| Field | Default | Description |
|---|---|---|
| `colors.categorical` | Six-hue palette | Nominal-series stroke palette |
| `colors.categoricalFill` | Default fill palette; inherits an authored categorical palette when omitted | Quieter fill colors for area-filling marks |
| `colors.sequential` / `diverging` | Named palette maps | Numeric color scales |
| `colors.background` | `transparent` | Visualization background; opaque surfaces derive from the neutral surface |
| `colors.text` | `#09090b` | Main text ink |
| `colors.gridline` | `rgba(0,0,0,0.08)` | Grid lines |
| `colors.hairline` | `rgba(0,0,0,0.14)` | Structural separators |
| `colors.axis` | `#71717a` | Axis lines and tick text |
| `colors.annotationLabel` | `#333333` | Primary callout ink |
| `colors.annotationMuted` | `#6b7280` | Subtitle and note ink |
| `colors.annotationLeader` | `#8f8f8f` | Quiet connector ink |
| `colors.annotationRule` | `#888888` / `#9ca3af` | Reference line ink, light/dark |
| `colors.annotationRangeFill` | `#f0c040` | Range fill before opacity |
| `colors.annotationMarkerFill` / `annotationPlate` | Resolved neutral surface | Marker interior and label plate; explicit colors win |

Generic `annotationFill` and `annotationText` retain their other uses. See [Theming tokens](../theming-tokens.md) for the complete token and dark-mode mapping.

### Fonts, chrome, and spacing

| Field | Default | Description |
|---|---|---|
| `fonts.family` | Inter Variable, Inter, system sans-serif | Primary font family |
| `fonts.mono` | JetBrains Mono, Fira Code, Cascadia Code, monospace | Tabular/monospace family |
| `fonts.sizes.title` / `subtitle` | 26 / 14 | General title sizes |
| `fonts.sizes.body` / `small` / `axisTick` | 13 / 12 / 12 | Body, small, and tick sizes |
| `fonts.sizes.metricLabel` / `metricValue` | 11 / 22 | Metric row sizes |
| `fonts.weights.normal` / `medium` / `semibold` / `bold` | 400 / 500 / 600 / 700 | Weight ladder |
| `chrome.eyebrow` | 11px, 500, `#06b6d4`, 1.4 line-height | Eyebrow style |
| `chrome.title` | 26px, 600, `#09090b`, 1.15 line-height | Title style |
| `chrome.subtitle` | 14px, 400, `#71717a`, 1.45 line-height | Subtitle style |
| `chrome.source` / `byline` / `footer` | 12px, 400, `#71717a`, 1.4 line-height | Attribution styles |
| `spacing.padding` / `chromeGap` | 20 / 6 | Container padding / gap between chrome elements |
| `spacing.chromeToChart` / `chartToFooter` | 16 / 12 | Gaps above and below the chart |
| `spacing.axisMargin` | 6 | Axis margin |
| `borderRadius` | 8 | Containers and tooltips |

### The editorial rule

`rule` draws a short colored bar above top chrome. Omission inherits a preset rule, or draws none on the default theme. `rule: null` removes an inherited rule; partial objects preserve unmodified fields.

| Field | Fallback when a rule is authored without a preset | Description |
|---|---|---|
| `rule.color` | Theme text ink | TokenValue color, including light/dark pairs |
| `rule.width` | 40px | Rule length |
| `rule.thickness` | 3px | Rule height; chrome reserves thickness plus chromeGap |

No top chrome means no rule.

The named presets are `essay`, `wire`, `broadsheet`, and `terminal`. Omit `theme` or pass `{}` for the default; `editorial` is removed. `clarity` is deprecated and contains only its background, axis, and eyebrow colors. `legacyEditorial` retains v8 typography for migration.

Only authored theme overrides and derived values are stamped inline. Omitted CSS tokens remain overridable by host styles, including `--oc-border-radius`; removing an override restores the host's previous inline value. Export captures live token values.

---

## DarkMode

Controls dark mode rendering. Source: `core/src/types/spec.ts`.

```ts
type DarkMode = "auto" | "force" | "off";
```

| Value     | Behavior                                                                                 |
| --------- | ---------------------------------------------------------------------------------------- |
| `'auto'`  | Checks `window.matchMedia('(prefers-color-scheme: dark)')`. Adapts to system preference. |
| `'force'` | Always render in dark mode.                                                              |
| `'off'`   | Always render in light mode. This is the default.                                        |

Dark mode resolution happens in the adapter layer (vanilla/React), not the engine. The adapter resolves the `DarkMode` union to a boolean and passes `darkMode: true/false` to the engine's `CompileOptions`. The engine then calls `adaptTheme()` to transform colors: swap background/text, adjust palette brightness, lighten gridlines.

You don't need to define a separate dark theme. The engine handles the color transformations automatically.
