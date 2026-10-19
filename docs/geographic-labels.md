# Geographic labels and callouts

Maps can show explicitly authored place names and findings. Leaving out `encoding.text`, `points.text`, and `callouts` preserves the existing map layout and adds no label geometry or inventory DOM.

## Place names from data

Add a `text` channel to the feature encoding or point layer:

```ts
const spec: GeoMapSpec = {
  type: 'map',
  geo: { features: topology, projection: 'albersUsa', zoom: true },
  data: [
    { id: '48', place: 'Texas triangle', population: 31, priority: 10 },
    { id: '06', place: 'California coast', population: 39, priority: 8 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'population', type: 'quantitative', title: 'Population (millions)' },
    text: { field: 'place', type: 'nominal' },
    textPriority: { field: 'priority', type: 'quantitative' },
  },
};
```

The topology and data are supplied by the host. A feature's requested text field is read from its joined row, or from the same explicitly named topology property when the row does not provide that property. An explicit null does not become a guessed topology name. Point names come from the point data and require a unique `points.key`.

Higher finite `textPriority` values place first. Point labels otherwise use their size value as priority. Equal priorities use stable tagged identities, so input reordering does not arbitrarily change collision winners. Placement is bounded to 200 text candidates per view; this is a safety limit, not an exact top-N selection feature. All names remain in the inventory even when they cannot be painted.

## Authored findings

Use `callouts` for explanatory text or a coordinate-only place:

```ts
spec.callouts = [
  {
    id: 'texas-growth',
    anchor: { kind: 'feature', id: '48' },
    text: 'The Texas triangle',
    subtitle: 'An explanation that remains available when its label cannot fit.',
    priority: 10,
    maxWidth: 220,
  },
  {
    id: 'austin-detail',
    anchor: { kind: 'coordinate', space: 'geographic', x: -97.7431, y: 30.2672 },
    text: 'Austin',
    minZoom: 3,
  },
];
```

Each callout needs a unique nonblank string ID, an anchor, and plain text. Optional fields are `subtitle`, finite `priority`, `minZoom`, `maxZoom`, `offset: { dx, dy }`, and positive `maxWidth`. Zoom limits are relative to the base map; the upper bound is inclusive. Offsets and widths use screen CSS pixels.

| Anchor | Meaning |
| --- | --- |
| `{ kind: 'feature', id }` | The topology feature ID, using the map's canonical ID matching |
| `{ kind: 'point', id }` | A value of the authored `points.key`, in a separate namespace from feature IDs |
| `{ kind: 'coordinate', space: 'geographic', x, y }` | Longitude/latitude through the map's geographic projection |
| `{ kind: 'coordinate', space: 'source', x, y }` | Coordinates in a preprojected identity map's source system, before fit |

Do not use longitude/latitude on a preprojected identity map or assume source coordinates are geographic. Those mismatches are rejected. Numeric `1` and string `"1"` identify the same key within an entity namespace; ambiguous duplicate keys are rejected when geographic labels need persistent identity. Missing targets retain their exact authored text with an unresolved-anchor explanation.

Callouts place before ordinary place names. Text avoids keys, zoom controls, accepted labels, and point symbols. When a callout cannot fit, it moves to its numbered note slot with a keyed anchor marker when possible. The engine measures complete authored note capacity before fitting the geography; unused slots can leave reserved space. Panning and zooming never change that reserve or refit the map. Visual placement considers at most 128 callouts; additional callouts retain complete note slots and inventory entries. For a fixed-height figure that cannot accommodate its notes, inspect the diagnostic and increase the height or reduce authored content. The complete text remains accessible even when the fixed frame cannot paint it.

These callouts do not participate in Cartesian annotation editing or emit edit transactions.

## Access to every name

Every labeled map has a visually hidden inventory associated with the SVG's accessible description. It includes exact custom names, callout subtitles, coordinates, unresolved targets, and names omitted by collisions or zoom limits. Entries are text rather than hundreds of additional tab stops.

To offer a visible list, supply a separate host-owned container:

```ts
const map = createGeoMap(mapElement, spec, {
  labelInventory: { container: placesElement },
});

// Move or hide the visible disclosure without resetting the camera.
map.setLabelInventory({ container: anotherPlacesElement });
map.setLabelInventory(false);
```

The native “Map places and notes” disclosure works independently of reader comparison. Opening it changes only the host's list area, not the SVG dimensions or projection. React, Vue and Svelte `GeoMap` components accept the same `labelInventory` prop. Omission or `false` hides the visible disclosure while retaining the hidden inventory. The library removes only the list nodes it owns on update or destruction.

## Camera, geometry, and export

Labels keep a constant screen size while the camera moves. During a gesture, accepted identities follow their anchors and boxes leaving the viewport are hidden. At settlement, placement is recomputed from the current camera, viewport, and compiled measurements. Reaching the same view by a different pan/zoom history produces the same settled placement and export.

Feature anchors use proven polygon interiors, including holes and visible multipolygon components. Label geometry comes from the same projection stream as the rendered feature paths; it is not reconstructed from SVG strings. The retained geometry budget is 50,000 vertices per view. Excess candidates use previously validated canonical anchors while those anchors are visible, with a diagnostic describing the inability to switch visible components. Rings and holes are never silently truncated to fit the budget. Topology, ring nesting, and interior-search work are bounded separately. Anchors are checked against the complete feature’s nonzero fill, including overlapping polygon groups; ambiguous or numerically degenerate rings cause conservative omission rather than a label on unfilled space. The same proof applies after camera clipping.

The transient ring collector also has a 100,000-vertex limit per feature. Denser features use a second streaming pass to verify a bounded set of interior probes without retaining rings. If no probe can be proven inside land, the feature label is omitted with an explanation; authored text remains in the inventory. This bounds the label collector, not the host's source topology or the projection library's own buffers. The engine's `compileGeoMap` diagnostic callback reports compile-time limits; pure `resolveGeoOverlay` results also contain camera-dependent diagnostics.

SVG and raster exports include settled place labels, leaders, and notes. SVG descriptions also contain the complete inventory. They do not screenshot the visible HTML disclosure. `renderStaticSVG` also accepts `GeoMapSpec`; supply a stable, distinct `idPrefix` when embedding multiple static figures in one document:

```ts
const first = renderStaticSVG(spec, { width: 960, height: 700, idPrefix: 'map-one' });
const second = renderStaticSVG(otherSpec, { width: 960, height: 700, idPrefix: 'map-two' });
```

Prefixes must start with a letter or underscore and contain only letters, digits, underscores, periods, or hyphens. Without a prefix, each standalone render retains deterministic IDs. Static rendering still uses the existing serialized rendering contract.

The [geographic-label gallery](../examples/src/gallery/geo-labels.stories.tsx) demonstrates place names, zoom-gated callouts, a host-placed disclosure, data replacement, and multiple maps. The [migration guide](migrating-v9.md) separates these opt-ins from v9's approved default visual changes.
