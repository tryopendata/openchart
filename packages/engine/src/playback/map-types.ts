/**
 * Shared types for map playback: what the geo and tile map compiles hand the playback layer
 * (the frozen scales a compile resolved), and what a compiled map playback hands the vanilla
 * frame writer (fills, points and overlays at a playhead).
 */
import type {
  DataRow,
  GeoMapLayout,
  TextMarkLayout,
  TileMapLayout,
  TileMapTileMark,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import type { ClassScale } from '../legend/continuous';
import type { ResolvedPlayback } from './options';
import type { PlaybackPeriod } from './periods';

/**
 * A map layout that may carry playback overlays (the period label). Map layouts have no
 * generic mark list, so the overlays ride alongside and the map renderers draw them.
 */
export type PlaybackOverlayLayout = {
  /** Text marks drawn over the map at the compiled playhead, matched by `key`. */
  playbackOverlays?: TextMarkLayout[];
};

/** The scales a geo map compile resolved, read back by the playback for every frame. */
export interface GeoMapFrozenScales {
  /** The choropleth's class scale, null when no feature has a numeric value. */
  classScale: ClassScale | null;
  /** Fill of a feature without a value. */
  neutralFill: string;
  /** Feature id per data key, from joining one row per key that has a value in any period. */
  featureIds: Map<string, string | number>;
  /** Formats a color value the way the legend and tooltips do. */
  formatValue(value: number): string;
  /** Point radius for a size value; the fixed radius when the points have no size channel. */
  pointRadius(size: number | undefined): number;
  /** Point fill for a color value (a number or a category). */
  pointFill(color: unknown): string;
}

/**
 * How a playback run steers one geo map compile: the rows its scales and legends read
 * (every period at once, so classes never change mid-run) and where the resolved scales go.
 */
export interface GeoMapPlaybackScope {
  /** Rows the choropleth's class scale and legend are computed from. */
  colorRows?: DataRow[];
  /** Rows the points layer's size and color scales and legends are computed from. */
  pointRows?: DataRow[];
  /** One row per data key with a value in any period, joined to find each key's feature. */
  keyRows?: DataRow[];
  /** A feature lacks a value in some period, so the legend keeps its "No data" entry. */
  noDataEver?: boolean;
  /** Receives the scales the compile resolved. */
  capture?(scales: GeoMapFrozenScales): void;
}

/** The tile builder a tile map compile resolved, read back by the playback for every frame. */
export interface TileMapFrozenTiles {
  /** The tile for a state at a value (null for no data), styled with the frozen scale. */
  tileAt(stateCode: string, value: number | null): TileMapTileMark;
}

/** How a playback run steers one tile map compile. */
export interface TileMapPlaybackScope {
  /** Rows the opacity scale, legend labels and value formatter are computed from. */
  valueRows?: DataRow[];
  /** A tile lacks a value in some period, so the legend keeps its "No data" entry. */
  noDataEver?: boolean;
  /** Receives the tile builder the compile resolved. */
  capture?(tiles: TileMapFrozenTiles): void;
}

/** One feature's or tile's paint at a playhead, matched to the DOM by `data-key`. */
export interface MapFillFrame {
  /** Geo feature id, or tile state code. */
  key: string;
  fill: string;
  /** True when the feature has no value here and takes the no-data treatment. */
  noData: boolean;
  /** Class index for classed geo fills; absent for no data and on tile maps. */
  binIndex?: number;
  /** Tile maps only: the fill opacity the sequential scale encodes. */
  fillOpacity?: number;
  /** Tile maps only: the tile border. */
  stroke?: string;
  /** Tile maps only: the ink and text of the tile's code and value labels. */
  labels?: { codeFill: string; valueText: string; valueFill: string };
}

/** One map point's size and paint at a playhead, matched by `data-point-key`. */
export interface MapPointFrame {
  key: string;
  r: number;
  fill: string;
  /** Fade multiplier, 0..1, on top of the point's own fill opacity. */
  presence: number;
}

/** A compiled map playback: the base layout plus pure functions of the playhead `t`. */
export interface MapPlayback<Layout> {
  /** The layout the DOM is built from, at the final period. */
  base: Layout & PlaybackOverlayLayout;
  /** Periods in playback order. */
  periods: PlaybackPeriod[];
  /** Display label per period. */
  periodLabels: string[];
  timing: ResolvedPlayback;
  /** Advisory warnings found while building the playback (also sent to `onWarn`). */
  warnings: string[];
  /** One entry per feature or tile with a value in any period. `t` is clamped. */
  fillsAt(t: number): MapFillFrame[];
  /** One entry per point key with a value in any period; empty without `points.time`. */
  pointsAt(t: number): MapPointFrame[];
  /** The period label at `t` (key `oc-playback-period`); empty when `period` is false. */
  overlaysAt(t: number): TextMarkLayout[];
  /**
   * Tooltip for a DOM key (feature id, tile state code or `point:<key>`) with the values of
   * the period nearest `t`, or undefined for keys the playback doesn't drive.
   */
  tooltipAt(domKey: string, t: number): TooltipContent | undefined;
  /** A data key's formatted values at a period index, or null when it has none there. */
  observedAt(key: string, period: number): Record<string, string> | null;
  /** One-line summary of the frame at `t` for the live region. */
  describe(t: number): string;
}

/** A geo map playback. */
export type GeoMapPlayback = MapPlayback<GeoMapLayout>;

/** A tile map playback. */
export type TileMapPlayback = MapPlayback<TileMapLayout>;
