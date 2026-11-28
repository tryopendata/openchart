---
title: "GeoMapSpec"
description: "GeoMapSpec fields for choropleth and symbol maps: geography, encoding, point layers, focus and zoom."
section: spec
order: 15
---

# GeoMapSpec

A `GeoMapSpec` (`type: 'map'`) draws TopoJSON geography and fills each feature from a joined data row (a choropleth). A points layer adds circles at latitude and longitude, sized or colored by value (a symbol map).

See it: [Choropleth](https://openchart.steamfield.io/docs/maps/choropleth/), [Symbol map](https://openchart.steamfield.io/docs/maps/symbol-map/) and [Geographic labels](https://openchart.steamfield.io/docs/maps/geographic-labels/).

## GeoMapSpec

Input for choropleth and symbol map visualizations. Source: `core/src/types/spec.ts`.

Maps render TopoJSON geometries as SVG, join tabular data rows to features by id, and fill features by a color encoding. An optional points layer overlays lat/lon symbols above the features. Uses a separate component: `<GeoMap>` (React/Vue/Svelte) or `createGeoMap` (vanilla).

| Field         | Type              | Default     | Description                                                                          |
| ------------- | ----------------- | ----------- | ------------------------------------------------------------------------------------ |
| `type`        | `'map'`           | (required)  | Discriminant. Always `'map'`.                                                        |
| `geo`         | `GeoMapGeo`          | (required)  | TopoJSON features, join key field, projection, and camera focus. See below.          |
| `data`        | `DataRow[]`       | (required)  | Tabular data to join to geo features. Can be `[]` for a basemap-only map (e.g. under a points layer). |
| `encoding`    | `GeoMapEncoding`     | (required)  | Maps data fields to the join key and fill color. See below.                          |
| `points`      | `GeoMapPointsLayer`  | `undefined` | Point/symbol layer rendered above the features. See below.                           |
| `chrome`      | `Chrome`          | `undefined` | Editorial text (title, subtitle, source, byline, footer).                            |
| `legend`      | `LegendConfig`    | `undefined` | Legend display configuration. See [Map legends](#map-legends).                       |
| `theme`       | `ThemeConfig`     | `undefined` | Theme overrides.                                                                     |
| `watermark`   | `boolean`         | `true`      | Whether to show the OpenChart watermark.                                        |
| `animation`   | `AnimationSpec`   | on          | Animation configuration. On by default; `false` disables it.                         |

### GeoMapGeo

| Field        | Type               | Default       | Description                                                                            |
| ------------ | ------------------ | ------------- | -------------------------------------------------------------------------------------- |
| `features`   | TopoJSON topology  | (required)    | The geometry source. Import from `us-atlas`, `world-atlas`, or your own TopoJSON file. Must be a `Topology`, not a GeoJSON FeatureCollection. |
| `idField`    | `string`           | `'id'`        | Field in the TopoJSON feature properties used as the join key.                         |
| `projection` | `GeoMapProjection`    | `'albersUsa'` | `'albersUsa'`, `'mercator'`, `'equalEarth'`, or `'identity'`. Use `'identity'` for pre-projected files like `states-albers-10m.json` (coordinates already in pixel space). |
| `focus`      | `GeoMapFocus \| null` | `undefined`   | Camera focus. See [Focus](#focus). `null` clears focus from a prior story step.        |
| `zoom`       | `boolean \| { maxZoom?, controls? }` | `undefined` (off) | Let readers zoom and pan. See [Reader zoom](#reader-zoom).                   |

### GeoMapEncoding

| Channel   | Type                                   | Required | Description                                                                                     |
| --------- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `key`     | `EncodingChannel`                      | for choropleth | Data field that joins rows to feature ids. Optional in basemap-only mode (empty data plus a points layer). |
| `color`   | `EncodingChannel`                      | for choropleth | Feature fill. Quantitative or nominal (see below). Optional when a points layer is present. |
| `tooltip` | `EncodingChannel \| EncodingChannel[]` | no       | Tooltip field(s) shown on feature hover.                                                        |

**Quantitative color** bins values with a quantile scale into one class per stop of a sequential scheme. `scale.scheme` picks the scheme: `'blue'` (default), `'green'`, `'orange'`, `'purple'`, or `'teal'`. Maps accept only these sequential names -- diverging names and Vega-Lite aliases fail validation here.

**Nominal color** assigns categorical fills. Colors come from `scale.range` (with `scale.domain` for category order), falling back to the theme categorical palette. `scale.scheme` on a categorical map channel fails validation; use `scale.range` instead.

Features with no matching data row render in a neutral fill.

### GeoMapPointsLayer

Symbol overlay projected through the same geo projection as the features. Independent of the choropleth data join.

| Field       | Type                                   | Default     | Description                                                                       |
| ----------- | -------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `data`      | `DataRow[]`                            | (required)  | Tabular point data.                                                               |
| `longitude` | `EncodingChannel`                      | (required)  | Field holding longitude (x coordinate).                                           |
| `latitude`  | `EncodingChannel`                      | (required)  | Field holding latitude (y coordinate).                                            |
| `size`      | `EncodingChannel`                      | `undefined` | Quantitative radius encoding. Area-proportional (r proportional to sqrt of value), default radius range 3-20px. No size legend is rendered; explain the scale in `chrome.subtitle` if needed. |
| `color`     | `EncodingChannel`                      | `undefined` | Nominal (categorical swatches) or quantitative (sequential scheme, same `scale.scheme` names as choropleth). Independent scale from the choropleth color. |
| `tooltip`   | `EncodingChannel \| EncodingChannel[]` | `undefined` | Tooltip field(s) for point hover.                                                 |
| `key`       | `EncodingChannel`                      | `undefined` | Stable id for event callbacks and for matching points across updates, so points tween, enter and exit on `.update()`. |
| `opacity`   | `number`                               | `0.65`      | Fill opacity for point circles (0-1).                                             |

### Focus

`geo.focus` zooms and pans the camera. Features outside the focus set are dimmed. Changing focus via `.update()` (or a scrollytelling story step) animates the camera between states.

| Form                                | Behavior                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `'06'` or `6` (a feature id)        | Fit the camera to that feature.                                                       |
| `['36', '34', '09']`                | Fit the union of those features.                                                      |
| `{ features, padding? }`            | Same, with extra breathing room in pixels.                                            |
| `{ points: true, padding? }`        | Fit the points layer's cluster instead of any feature. Use when points occupy a small part of a large feature. |
| `{ points: { field, value } }`      | Fit only the points where `row[field] === value`, so a story can pan between sub-clusters. |
| `null`                              | Clear focus (back to the full map).                                                   |

### Reader zoom

`geo.zoom` lets readers zoom into dense areas and pan around. It is off by default, so existing maps don't change.

```ts
geo: { features: txCounties, projection: "mercator", zoom: true }
// or tune it:
geo: { features: txCounties, zoom: { maxZoom: 8, controls: true } }
```

| Field      | Type      | Default | Description                                                                 |
| ---------- | --------- | ------- | --------------------------------------------------------------------------- |
| `maxZoom`  | `number`  | `12`    | Zoom ceiling as a multiple of the full map. Readers can never zoom out past the full map (1). |
| `controls` | `boolean` | `true`  | Show the zoom in / zoom out / reset buttons in the map's top-right corner.  |

The gestures follow the cooperative convention used by embedded web maps, so the map never traps page scroll:

| Input | Behavior |
| ----- | -------- |
| Mouse wheel | Ctrl + wheel (⌘ + wheel on macOS) zooms around the cursor. A plain wheel scrolls the page and briefly shows a hint. |
| Trackpad | Pinch zooms around the cursor. Two-finger scroll scrolls the page. |
| Mouse drag | Pans once zoomed in. A drag never fires `onMarkClick`. |
| Double-click | Zooms in 2x at the cursor; shift + double-click zooms out. |
| Touch | Two-finger pinch zooms and pans. One finger scrolls the page at the full view and pans the map once the reader has zoomed in; the reset button hands one-finger scrolling back to the page. |
| Keyboard | The map is focusable: `+`/`-` zoom, arrow keys pan, `0` resets. |

Panning is clamped so the map can't leave its frame, and the map is clipped to its area while zoomed so it doesn't slide under the chrome or legend. Points keep their screen radius and strokes stay hairline at every zoom level, and tooltips track the zoomed geometry. Button, key, and double-click zooms animate; under `prefers-reduced-motion` they snap.

Reader gestures and the imperative camera API (`zoomTo`, `panTo`, `resetView`, `setCamera`) move the same camera. `onCameraChange` (mount option, or the `onCameraChange` prop on `<GeoMap>`) reports every move as `{ cx, cy, k }`.

### Map legends

A quantitative choropleth gets a class legend above the map by default; `legend: { position: 'bottom' }` moves it below. A points-layer color legend renders below the map by default; `legend: { position: 'top-left' }` floats it inside the map area's top-left corner on its own backdrop (useful when vertical space is tight). Other `LegendPosition` values fall back to the default. `legend: { show: false }` hides legends.

### Map events and updates

`onMarkClick` and `onMarkHover` (via `MountOptions`/component props) receive a `GeoMapMarkEvent` discriminated by `kind: 'feature' | 'point'`. Calling `.update()` with new data animates feature fills (recolor transition) and the points layer: points keyed by `encoding.key` move, resize and recolour, entering points fade in and removed points fade out. Both honour `animation.update`.

### Map example

```ts
import { GeoMap } from "@opendata-ai/openchart-react";
import us from "us-atlas/states-albers-10m.json";

const spec: GeoMapSpec = {
  type: "map",
  geo: { features: us, projection: "identity" },
  data: [
    { id: "06", rate: 5.3 },
    { id: "48", rate: 4.3 },
    // ...one row per state, keyed by FIPS id
  ],
  encoding: {
    key: { field: "id", type: "nominal" },
    color: { field: "rate", type: "quantitative", format: ".1f" },
  },
  chrome: {
    title: "Where the Job Market Is Tightest",
    subtitle: "State unemployment rate, seasonally adjusted, %",
    source: "Bureau of Labor Statistics",
  },
  animation: true,
};
```
