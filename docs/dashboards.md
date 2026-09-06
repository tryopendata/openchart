# Dashboards

Patterns for using OpenChart inside product UI: dense grids of small tiles rather than one full-bleed editorial chart. The spec grammar doesn't change — a dashboard tile is the same `ChartSpec` you'd use for a standalone chart, just sized and stripped down for a card.

For field-by-field type details, see the [spec reference](spec-reference.md). For chrome fields specifically, see [Chrome](spec-reference.md#chrome).

---

## Sizing charts in a tile

A chart mounted without an explicit height compiles at a 400px auto-height budget (`FALLBACK_HEIGHT` in the mount's convergence loop), then grows if chrome/legend/metrics need more room. That budget is well above the 200px threshold where the watermark starts auto-hiding, so a tile relying on auto-height won't get the compact treatment described below — it needs a constrained container.

Give a tile an explicit height, either on the mount container or the parent grid cell:

```ts
<div style={{ height: 180 }}>
  <Chart spec={spec} />
</div>
```

Watch out for CSS grid: `align-items` defaults to `stretch`, which sizes auto-height grid items to fill their row. A chart container with no height of its own (or `height: 100%`) inside a stretched grid item inherits whatever the tallest sibling needs, so a tile you meant to keep short can silently compile at 300px+. An explicit pixel height on the chart's own container is respected regardless of stretch — put the height there, not on the grid track, if you're depending on it to trigger the watermark auto-hide below.

## KPI cards: `display: 'sparkline'`

For a tiny trend indicator inside a stat card, set `display: 'sparkline'` on the chart spec. It strips chrome, axes, legend, and watermark entirely — the engine assumes a sparkline is decoration next to a number you're rendering yourself, not a chart that needs a source line.

```ts
const spec = {
  mark: 'area',
  data: series, // [{ t: 0, value: 42 }, ...]
  encoding: {
    x: { field: 't', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
  },
  display: 'sparkline',
};
```

Mount it in a small fixed-height box (36–56px is typical; the gallery tiles run 36) next to a headline number and delta you render as plain HTML:

```tsx
<div style={{ height: 36 }}>
  <Chart spec={spec} />
</div>
```

When the tile is live and the spec keeps `animation: true`, a finished data update flashes the sparkline's terminator dot (`mark: { type: 'line', point: 'last' }`) for 600ms via the `oc-pulse` class. On a wall of tiles that is what tells the reader which number just moved. It is off under `prefers-reduced-motion`.

## KPI tile anatomy

The gallery tiles (`examples/src/gallery/dashboards.layouts.tsx`) all follow one order, top to bottom, and it is worth copying:

1. **Label** — 11px, weight 500, `--oc-text-muted`.
2. **Value** — 30px, weight 600, `-0.02em` tracking, tabular figures. The only thing at display size.
3. **Delta chip** — 12px, weight 500, on a 10% tint of its own semantic color (`--oc-positive-tint` / `--oc-negative-tint`) at `--oc-radius-md`. A chip, not a second number competing with the value.
4. **Timeframe** — 11px, `--oc-text-faint`. Optional.

Surfaces: `--oc-card` background, a 1px `--oc-border` hairline, `--oc-radius-lg`, no shadow. Put `oc-root` (plus `oc-dark` in dark mode) on the dashboard's root element and every one of those tokens resolves for free — the same cascade the charts inside the tiles already run on. Don't hard-code a slate palette next to the library's.

## Metrics pills vs HTML stat cards

Two ways to show a row of headline numbers, and they solve different problems:

- **`metrics` on a chart spec** ties the numbers to the chart below them. It's a `Metric[]` array that renders a horizontal row of label/value cells (each with an optional delta and secondary value) between the subtitle and the plot area — one chart, one set of stats about that chart. See `Metric` in `spec-reference.md` for the shape.
- **Plain HTML stat cards** are the right call for a KPI strip that isn't attached to any single chart — four independent numbers (MRR, active users, churn, NRR) with their own layout and typography. Render those yourself; don't force them through a chart spec.

Use `metrics` when the numbers summarize the chart underneath them. Reach for HTML cards when the numbers are the dashboard's headline and any chart is secondary.

## Chrome economy

Small containers drop chrome automatically, on a ladder:

| Container | What the engine drops by default |
|---|---|
| height < 150px | gridlines |
| height < 200px | axes (which takes the gridlines with them) |
| width < 400px | x-axis tick labels capped at 3 (first, last, one between) |

Every drop is a *default*. An explicit `axis` on the encoding channel keeps the axis (`encoding.y.axis: { tickCount: 3 }`), and an explicit `axis.grid` keeps the grid, at any size. The rules live in `resolveChromeEconomy` (`packages/core/src/responsive/breakpoints.ts`) if you need the exact thresholds.

This is a change from 8.3: a 300x140 tile used to draw a full axis pair and five gridlines behind a shape 100px tall. If you were relying on that, add the explicit `axis` config.

Chrome mode follows a separate, narrower ladder than the gridline/axis drops above: below 100px chrome is `hidden` entirely (no title); from 100-199px chrome is `compact` — a title renders (at a smaller size than a full-size compact title, so it fits under the min-chart-height guardrail) but subtitle, source, byline, and footer stay dropped, same as at 200-350px. A tile in the 100-199px range with a `metrics` row won't render it: the metric bar is sized for full tiles and doesn't fit that height, so it's gated off the same as it is when chrome is `hidden`.

A dashboard is mostly tiles, and every pixel spent on chrome per tile is a pixel not spent on data. `computeChrome` reserves zero top space when a chart has no title, subtitle, or eyebrow authored, and zero bottom space when it has no source, byline, or footer and the watermark is off — an unauthored text field costs nothing, but on a tile 200px or taller the default watermark still reserves its brand band unless you set `watermark: false` (see the next section).

The convention: give one hero chart per dashboard the full treatment (`chrome: { title, subtitle, source }`), and keep every other tile terse. A one-line `chrome: { title }` is often enough to label a supporting tile. Tiles with their own HTML label (a stat card header, a custom panel title) should skip `chrome` entirely and let the chart reserve no space for it.

## Watermark rules

Charts default to showing the watermark, but it auto-hides under 200px unless you explicitly set `watermark` (top-level or on the active breakpoint override). Below 100px chrome is forced to `hidden` entirely; from 100-199px chrome renders a compact title (see [Chrome economy](#chrome-economy) below) but the watermark still auto-hides in that range — there isn't room to spare for the brand band on a tile that small. This only fires when the tile's height is actually constrained below 200px — see [Sizing charts in a tile](#sizing-charts-in-a-tile) above; the 400px auto-height default never triggers it on its own.

If you do set `watermark: true` explicitly on a chart under 200px, the engine reserves a compact brand band at the bottom instead of painting the brand over the plot.

Convention for a composed dashboard: **one watermark per dashboard**. Give the hero tile the default (`watermark` unset, so it shows) and set `watermark: false` explicitly on every other chart tile 200px or taller. Tiles under 200px and sparklines don't need the explicit flag — auto-hide (or the sparkline display mode) already takes care of it.

The auto-hide is chart-only. Sankey, tilemap, graph, geo-map, and table specs resolve `watermark` independently and are not affected by container height — set `watermark: false` explicitly on those in a dashboard tile.

One SSR note: `renderStaticSVG` defaults to a compile height of 420px, above the 200px threshold. If you server-render a tile and hydrate it into a container under 200px tall, the watermark (and chrome) will flip off at hydration — the same class of layout shift `chromeMode` already causes at that boundary. Size the SSR call to match the eventual container height to avoid the flip.

## Grid composition

The gallery's [Dashboards](https://tryopendata.github.io/openchart/?story=dashboards--dashboards) page has four composed layouts under "Layouts" — a SaaS analytics overview, an ops/monitoring board, a finance/markets overview, and a marketing funnel — each combining stat cards, sparklines, a hero chart, and supporting tiles in a CSS grid that collapses to one column on narrow screens. Use them as starting points for grid structure, tile sizing, and the watermark/chrome conventions above rather than building a layout from scratch.

## BarList and DataTable in tiles

`BarListSpec` (`type: 'barlist'`) is the densest way to show a ranked leaderboard in a card — inline proportional bars, no axes:

```ts
const spec: BarListSpec = {
  type: 'barlist',
  data: topPages,
  encoding: {
    label: { field: 'page', type: 'nominal' },
    value: { field: 'views', type: 'quantitative' },
  },
  valueFormat: '.1f',
  barHeight: 8,
  chrome: { title: 'Top pages' },
  watermark: false,
};
```

`TableSpec` tiles should set `density: 'condensed'` for reduced padding and font size (40px rows instead of 48px), and keep row counts small enough that the tile doesn't grow a second scrollbar inside a dashboard card. `compact: true` still works as an alias but warns — prefer `density` directly. Tables resolve `watermark` on their own (see [Watermark rules](#watermark-rules) above), so set it explicitly:

```ts
const spec: TableSpec = {
  type: 'table',
  data: accounts,
  columns: [
    { key: 'account', label: 'Account' },
    { key: 'plan', label: 'Plan' },
    { key: 'mrr', label: 'MRR', format: '$,.0f' },
    { key: 'trend', label: '6-Month Trend', sparkline: { type: 'line', valuesField: 'trend' } },
  ],
  density: 'condensed',
  watermark: false,
};
```

See [Tables](tables.md) for the full column feature set (heatmaps, inline bars, sparkline cells, flags).

## Related docs

- [Spec reference](spec-reference.md) for field-by-field type details
- [Tables](tables.md) for `TableSpec` column features
- [Theming tokens](theming-tokens.md) for dashboard surface theming
