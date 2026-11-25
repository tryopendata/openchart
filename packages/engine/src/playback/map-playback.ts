/**
 * Map playback compiles: geo maps and tile maps with `encoding.time` (and geo points with
 * `points.time`). One frame compile per size and theme freezes the classes, sizes and legend
 * over every period; frames then read fills, points and the period label from the frozen
 * scales, never compiling per period.
 */
import type {
  CompileOptions,
  GeoMapLayout,
  Rect,
  TileMapLayout,
  TileMapTileMark,
} from '@opendata-ai/openchart-core';
import { compileGeoMapFrame } from '../geo/compile-geo-map';
import { compileTileMapFrame } from '../tilemap/compile-tilemap';
import {
  type GeoPlan,
  geoFrameSpec,
  geoPlaybackContext,
  geoScope,
  planGeoPlayback,
} from './map-geo';
import { geoFillsAt, geoPointsAt } from './map-geo-frames';
import { geoNamedValues, geoTooltipAt } from './map-geo-tooltips';
import { geoPaletteColors, tilePaletteColors } from './map-palette';
import {
  collectWarnings,
  createMapPeriodOverlay,
  describeExtremes,
  type MapRunTiming,
  resolveMapRun,
} from './map-run';
import {
  planTilePlayback,
  type TilePlan,
  tileFillsAt,
  tileFrameSpec,
  tileNamedValues,
  tileScope,
  tileTooltipAt,
} from './map-tile';
import type {
  GeoMapFrozenScales,
  GeoMapPlayback,
  PlaybackOverlayLayout,
  TileMapFrozenTiles,
  TileMapPlayback,
} from './map-types';
import { hasTimeEncoding } from './time-spec';

/** Whether a map spec plays: `encoding.time`, or `points.time` on a geo map. */
export function hasMapTimeEncoding(spec: unknown): boolean {
  if (hasTimeEncoding(spec)) return true;
  if (typeof spec !== 'object' || spec === null) return false;
  const points = (spec as { points?: unknown }).points;
  return (
    typeof points === 'object' && points !== null && (points as { time?: unknown }).time != null
  );
}

/** The frame compile's playhead: `options.playbackT`, else the final period. */
function staticPlayhead(run: MapRunTiming, options: CompileOptions): number {
  return options.playbackT ?? Math.max(0, run.periods.length - 1);
}

/** The period label over a geo map's area, clear of the features it can avoid. */
function geoPeriodOverlay(run: MapRunTiming, layout: GeoMapLayout) {
  const { area } = layout;
  const features = layout.features.map(({ bounds }) => ({
    ...bounds,
    x: bounds.x + area.x,
    y: bounds.y + area.y,
  }));
  return createMapPeriodOverlay(run, area, layout.theme, features);
}

/** The period label over a tile map's grid, clear of the tiles it can avoid. */
function tilePeriodOverlay(run: MapRunTiming, layout: TileMapLayout) {
  const tiles = layout.tiles.map(({ x, y, size }) => ({ x, y, width: size, height: size }));
  return createMapPeriodOverlay(run, tileGridArea(layout.tiles, layout.area), layout.theme, tiles);
}

/** The bounds of the tile grid, where a tile map's period label sits. */
function tileGridArea(tiles: TileMapTileMark[], fallback: Rect): Rect {
  if (tiles.length === 0) return fallback;
  const left = Math.min(...tiles.map((tile) => tile.x));
  const top = Math.min(...tiles.map((tile) => tile.y));
  const right = Math.max(...tiles.map((tile) => tile.x + tile.size));
  const bottom = Math.max(...tiles.map((tile) => tile.y + tile.size));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Scales for a geo compile that returned its empty layout (no room to draw) before resolving
 * any: no feature is joined and no point is drawn, so every frame is empty.
 */
const UNDRAWN_GEO_SCALES: GeoMapFrozenScales = {
  classScale: null,
  neutralFill: 'none',
  featureIds: new Map(),
  formatValue: String,
  pointRadius: () => 0,
  pointFill: () => 'none',
};

function compileGeoBase(plan: GeoPlan, options: CompileOptions, run: MapRunTiming) {
  let scales: GeoMapFrozenScales | undefined;
  const last = Math.max(0, run.periods.length - 1);
  const layout = compileGeoMapFrame(
    geoFrameSpec(plan, last, true),
    options,
    geoScope(plan, (captured) => {
      scales = captured;
    }),
  );
  return { layout, scales };
}

/**
 * Compile a geo map with `encoding.time` or `points.time` into its playback: the base layout
 * at the final period with every point that ever shows, plus pure functions of `t`.
 *
 * @throws The validation error compile throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 * @throws {RangeError} When `playback.step` overflows over the period count.
 * @throws {Error} When the map has no room to draw at this size.
 */
export function compileGeoMapPlayback(spec: unknown, options: CompileOptions): GeoMapPlayback {
  const collector = collectWarnings(options);
  const plan = planGeoPlayback(spec, collector.warn);
  const run = resolveMapRun(plan.primary, plan.prepared.block, plan.time);
  const { layout, scales: captured } = compileGeoBase(plan, collector.options, run);
  const scales = captured ?? UNDRAWN_GEO_SCALES;
  const overlaysAt = geoPeriodOverlay(run, layout);
  const context = geoPlaybackContext(plan, scales, run.periodLabels, layout);
  const last = Math.max(0, run.periods.length - 1);

  const pointsAt = (t: number) => geoPointsAt(context, t);

  return {
    base: { ...layout, playbackOverlays: overlaysAt(last) },
    periods: run.periods,
    periodLabels: run.periodLabels,
    timing: run.timing,
    warnings: collector.warnings,
    fillsAt: (t) => geoFillsAt(context, t),
    pointsAt,
    overlaysAt,
    tooltipAt: (domKey, t) => geoTooltipAt(context, domKey, t),
    paletteColors: () => geoPaletteColors(scales, run.periods.length, pointsAt),
    describe: (t) => {
      if (run.periods.length === 0) return 'No periods to play.';
      const period = plan.primary.sampler.reachedPeriod(t);
      return describeExtremes(run.periodLabels[period], geoNamedValues(context, period));
    },
  };
}

/**
 * The static compile of a geo map with time: the frame at `options.playbackT`, else the
 * final period, with classes and legend frozen over every period and the period label.
 *
 * @throws What `compileGeoMapPlayback` throws.
 */
export function compileGeoMapAtPlayhead(
  spec: unknown,
  options: CompileOptions,
): GeoMapLayout & PlaybackOverlayLayout {
  const collector = collectWarnings(options);
  const plan = planGeoPlayback(spec, collector.warn);
  const run = resolveMapRun(plan.primary, plan.prepared.block, plan.time);
  const t = staticPlayhead(run, options);
  const layout = compileGeoMapFrame(
    geoFrameSpec(plan, t, false),
    collector.options,
    geoScope(plan),
  );
  return { ...layout, playbackOverlays: geoPeriodOverlay(run, layout)(t) };
}

function compileTileBase(plan: TilePlan, options: CompileOptions, run: MapRunTiming) {
  let tiles: TileMapFrozenTiles | undefined;
  const layout = compileTileMapFrame(
    tileFrameSpec(plan, Math.max(0, run.periods.length - 1)),
    options,
    tileScope(plan, (captured) => {
      tiles = captured;
    }),
  );
  return { layout, tiles };
}

/**
 * Compile a tile map with `encoding.time` into its playback: the base layout at the final
 * period plus pure functions of `t`.
 *
 * @throws The validation error compile throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a state and period.
 * @throws {RangeError} When `playback.step` overflows over the period count.
 * @throws {Error} When the tile map has no room to draw at this size.
 */
export function compileTileMapPlayback(spec: unknown, options: CompileOptions): TileMapPlayback {
  const collector = collectWarnings(options);
  const plan = planTilePlayback(spec, collector.warn);
  const run = resolveMapRun(plan.series, plan.prepared.block, plan.time);
  // A compile with no room to draw returns before building tiles, and every frame is empty.
  const { layout, tiles } = compileTileBase(plan, collector.options, run);
  const overlaysAt = tilePeriodOverlay(run, layout);
  const drawn = new Set(layout.tiles.map((tile) => tile.stateCode));
  const last = Math.max(0, run.periods.length - 1);
  const fillsAt = (t: number) => (tiles ? tileFillsAt(plan.series, tiles, drawn, t) : []);

  return {
    base: { ...layout, playbackOverlays: overlaysAt(last) },
    periods: run.periods,
    periodLabels: run.periodLabels,
    timing: run.timing,
    warnings: collector.warnings,
    fillsAt,
    paletteColors: () => tilePaletteColors(layout.theme, run.periods.length, fillsAt),
    pointsAt: () => [],
    overlaysAt,
    tooltipAt: (stateCode, t) =>
      tiles ? tileTooltipAt(plan, tiles, run.periodLabels, stateCode, t) : undefined,
    describe: (t) => {
      if (run.periods.length === 0) return 'No periods to play.';
      const period = plan.series.sampler.reachedPeriod(t);
      const named = tiles ? tileNamedValues(plan, tiles, period) : [];
      return describeExtremes(run.periodLabels[period], named);
    },
  };
}

/**
 * The static compile of a tile map with time: the frame at `options.playbackT`, else the
 * final period, with the value scale and legend frozen over every period and the period label.
 *
 * @throws What `compileTileMapPlayback` throws.
 */
export function compileTileMapAtPlayhead(
  spec: unknown,
  options: CompileOptions,
): TileMapLayout & PlaybackOverlayLayout {
  const collector = collectWarnings(options);
  const plan = planTilePlayback(spec, collector.warn);
  const run = resolveMapRun(plan.series, plan.prepared.block, plan.time);
  const t = staticPlayhead(run, options);
  const layout = compileTileMapFrame(tileFrameSpec(plan, t), collector.options, tileScope(plan));
  return { ...layout, playbackOverlays: tilePeriodOverlay(run, layout)(t) };
}
