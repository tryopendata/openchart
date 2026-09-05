# Maps

Choropleth and point (bubble) maps compiled from a TopoJSON topology.
This page covers projection inference, the shared class scale between
fills and the legend, legend anatomy, hover semantics, and point layers.
For US state tile grids (not geographic projections), see the tilemap
section at the end of this page.

## Quick start

```tsx
import { GeoMap } from "@opendata-ai/openchart-react";

const spec = {
  type: "map",
  geo: { features: usStatesTopology, idField: "id" },
  data: [
    { state: "06", rate: 4.2 },
    { state: "48", rate: 3.9 },
    // ...
  ],
  encoding: {
    key: { field: "state" },
    color: { field: "rate", type: "quantitative" },
  },
  chrome: { title: "Unemployment rate by state" },
};

<GeoMap spec={spec} />
```

For Vue, import from `@opendata-ai/openchart-vue`. For Svelte, import from
`@opendata-ai/openchart-svelte`. For vanilla JS, use `createGeoMap(container,
spec)` from `@opendata-ai/openchart-vanilla`. See the
[spec reference](spec-reference.md#geomapspec) for every `GeoMapSpec` field.

## Projection

`geo.projection` is optional. When omitted, `resolveDefaultProjection(topology)`
(`packages/engine/src/geo/projections.ts`) infers one from the topology's
bounding box:

- A pre-projected bounding box (values outside the longitude/latitude range —
  the common case for a `us-atlas` topology already projected to pixel space)
  → `identity`. In dev mode (`dev: true`) a `PROJECTION_INFERRED` compile
  warning notes what happened; production compiles stay silent, since identity
  is the only correct answer for an already-projected atlas.
- A longitude span over 200° (a world topology) → `equalEarth`, an
  equal-area projection appropriate for a global choropleth.
- Anything else → `albersUsa`, the historical default (composite projection
  for the continental US plus insets for Alaska and Hawaii).

Set `geo.projection` explicitly to override the inference — `mercator` is
also available. `albersUsa` excludes territories (Puerto Rico, Guam, US
Virgin Islands, American Samoa, Northern Mariana Islands); if your data
includes them, use `mercator` or `equalEarth` instead, or those features
silently drop with a warning.

## Class scale

Fills and the legend swatches share one scale (`buildClassScale`,
`packages/engine/src/legend/continuous.ts`) so a region's fill color and its
legend key always agree — there's no separate legend-side classing that can
drift from the marks.

The default classing is `quantize`: evenly spaced, round-number breaks
computed via d3's `tickStep` (the same 1/2/5-times-a-power-of-ten step an
axis would pick), niced so class boundaries read as round numbers rather
than arbitrary quantile cutoffs. Default class count is 5
(`DEFAULT_BIN_COUNT`). `quantile` and `threshold` classing are available but
only apply when authored explicitly (`scale: { type: 'quantile' }`) — quantile
redistributes colors based on the data's own distribution, which is the
right call for skewed data but not a sensible default, since it moves class
boundaries every time the data changes.

A diverging color scheme over a domain that straddles zero is classed
symmetrically around zero: bin count is forced odd and centered so the
middle class always represents "near zero," with that middle break labeled
explicitly.

## Legend anatomy

The continuous/binned legend carries:

- A **title**, from the color encoding's `title` (falling back to the raw
  field name when none is given — so an encoding on `rate` with no title
  shows "rate" as the legend heading; set `title` explicitly to avoid this).
- Binned swatches at 12px with crisp edges, each stamped `data-bin-index` so
  legend-hover can match it against feature fill.
- A **"No data"** swatch, detached to the side of the color bar, shown
  whenever any joined feature lacks a value for the encoded field. Its fill
  is the neutral fill (see below), not part of the color ramp.

## Fills and borders

Unfilled ("no data") regions use the derived neutral ramp:
`theme.colors.neutral[100]` on light backgrounds, `neutral[800]` on dark.
Individual features carry no per-feature stroke (`stroke: none`) — border
hierarchy is drawn entirely by the shared mesh: an **interior** border
(state/county lines) at `rgba(0,0,0,0.25)` light / `rgba(255,255,255,0.22)`
dark, 0.6px width, and an **outline** border (the map's outer boundary) at
`rgba(0,0,0,0.55)` light / `rgba(255,255,255,0.45)` dark, 1.1px width. Both
widths are drawn with `vector-effect: non-scaling-stroke` so they hold their
weight through zoom.

## Hover

Feature hover is outline-and-raise only, never a sibling dim: toggling
opacity across 3000 county paths on every `mouseenter` is a repaint storm
and produces a visible pulse across the whole map. The hovered feature gets
`oc-map-feature--hover` (a `var(--oc-text)` stroke at 1.5px) and is raised
to the front of paint order via `appendChild`, with the original DOM order
restored (from a `WeakMap`) on `mouseleave`.

Dim-the-rest is reserved for legend-bin hover, where it carries editorial
meaning ("show me where this range appears"): hovering a legend swatch sets
`data-hover` on the features group, and every feature whose `binIndex`
doesn't match dims to `--oc-map-hover-dim` (0.75 — lighter than the chart
default of 0.3, since dimming thousands of regions at 0.3 reads as a
blackout rather than a highlight).

## Points

Point (bubble) layers default to 0.85 fill opacity with a background-color
knockout stroke, so overlapping bubbles read as one layer rather than tinted
glass. Points are sorted descending by radius before rendering, so large
bubbles draw underneath small ones and never hide them — animation index is
reassigned after the sort so entrance stagger still reads left-to-right by
draw order. An optional nested-circle size legend (reusing the scatter
size-legend compute) renders bottom-right with the same backdrop rect the
other legends use.

Source: `packages/engine/src/geo/compile-geo-map.ts`,
`packages/engine/src/geo/projections.ts`,
`packages/engine/src/legend/continuous.ts`,
`packages/vanilla/src/map-renderer.ts`, `packages/vanilla/src/map-mount.ts`.

## TileMap

The US state tile grid (`type: 'tilemap'`) is a separate mark type from
geographic maps — no projection, a fixed per-state grid layout instead.

Tile corner radius is `min(2, round(0.1 × tileSize))`, so small tiles round
less than the fixed 2px ceiling. No-data tiles keep a 1px `--oc-border`
stroke; tiles with data draw no stroke at all. State code label size is
`clamp(round(tileSize × 0.5, 1dp), 7, 12)`; the value label is
`clamp(round(tileSize × 0.42, 1dp), 6.5, 10)`.

Label ink is computed against the tile's **effective** color — the fill
blended onto the surface at its actual opacity
(`interpolateRgb(surface, fill)(fillOpacity)`), not the base fill color —
which is what fixes white text rendering on a near-white low-opacity tile:
the base fill might be a saturated blue, but at 25% opacity on a white
surface the effective color is pale, and the luminance flip needs to run on
that blended result to pick readable ink. No-data tile labels use
`colors.axis`. Fill opacity range is `[0.25, 1]` on light backgrounds,
`[0.3, 1]` on dark. The legend is a square-cornered 10px bar (not a rounded
pill — a 10px pill reads as a UI control, a square-ended bar reads as a
color scale) with a detached "No data" swatch, matching the geographic map
legend's anatomy.

Source: `packages/engine/src/tilemap/compile-tilemap.ts`,
`packages/vanilla/src/tilemap-renderer.ts`,
`packages/vanilla/src/tilemap-mount.ts`.
