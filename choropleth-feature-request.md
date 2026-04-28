# Feature Request: US State Tile Grid Choropleth

## Context

Extracted from the OpenData feature request (`feature-request.md`, items B1/B2). This is scoped separately because it's a fundamentally different visualization paradigm from the existing chart pipeline - no axes, no positional encoding, no scales in the grammar-of-graphics sense.

## The Problem

A large number of public datasets (BLS, HUD, Census, state DOTs) are keyed by US state. The standard visualization is a colored map. Hex/tile grids are preferred over true geographic projections at dashboard sizes because:

1. Every state is the same size (small states aren't invisible)
2. Alaska/Hawaii/DC fit naturally without inset maps
3. No projection math or GeoJSON/TopoJSON bundles (~100KB avoided)
4. Better readability at small sizes than true geography

## What Success Looks Like

A consumer passes a record-shaped dataset (state code to value), picks a color scale, and gets a colored tile grid with:
- State codes labeled inside each tile
- Values displayed below the state code
- Sequential color scale mapped to the value
- Continuous color legend at the bottom
- Graceful degradation when data isn't US-shaped (clear feedback like "5 of 87 keys matched US state codes" rather than a half-empty map)

Reference: Image 4 from the OpenData screenshots shows the target output - square tiles in a geographic arrangement, sequential teal color scale, state abbreviation + value inside each tile, gradient legend bar at bottom.

## Design Considerations

This should be a new top-level spec type (like `TableSpec`, `GraphSpec`, `SankeySpec`), not a mark type within `ChartSpec`. Reasons:

- **Data shape is different.** Charts use `DataRow[]` (tabular rows). This uses a record map (`{ "CA": 12000, "TX": 8500 }`) or tabular with a state-code key column.
- **No encoding channels.** There's no x/y positional encoding. Position is determined by a hardcoded tile layout, not data-driven scales.
- **No axes.** The geographic arrangement replaces axes entirely.
- **Color scale is the only data mapping.** Value to color is the entire visualization, unlike charts where x/y position carries most of the information.

Proposed spec type name: `TileMapSpec` or `ChoroplethSpec`.

The implementation would need:
- `compileTileMap()` in the engine
- `createTileMap()` in vanilla
- `<TileMap />` in React/Vue/Svelte wrappers
- Hardcoded US state tile layout (11-column grid, well-established positions)
- Sequential color scale from the existing `packages/core/src/colors/palettes.ts`

## Scope

### Phase 1: US states only
- 50 states + DC
- Square tile grid layout (not hex)
- Sequential color scale
- State code + value labels inside tiles
- Continuous color legend

### Phase 2 (follow-up)
- World by ISO-3166 country code (needs real projection, bigger lift)
- Other US layouts (counties, congressional districts)
- Hex variant of the tile layout

## Scenarios This Unlocks

- "Unemployment rate by state"
- "Median rent by state"
- "Vaccination coverage by state"
- Anything in the BLS/HUD/Census catalog with a `state` column
