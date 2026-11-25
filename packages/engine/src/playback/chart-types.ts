/**
 * Shared types for chart playback: the frozen frame compiled once per size and theme, and
 * the per-frame values `compileChartPlayback` hands to the vanilla frame writer.
 */
import type {
  ChartLayout,
  LayoutStrategy,
  Mark,
  Point,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { BarLabelPlan } from '../charts/bar/label-plan';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import type { ResolvedPlayback } from './options';
import type { PlaybackPeriod } from './periods';

/**
 * Everything that stays still for a playback run, from one compile of the envelope spec
 * (every present, gap-filled cell across all periods).
 */
export interface FrozenChartFrame {
  /** Chrome, axes, gridlines, legend, annotations. `marks` is always empty. */
  layout: ChartLayout;
  /** Scales from the envelope: all-period extents with nice rounding, every color category. */
  scales: ResolvedScales;
  /** Plot area the renderer draws into. */
  chartArea: Rect;
  /** Bar label plan sized for the widest label over all periods. */
  labelPlan?: BarLabelPlan;
  theme: ResolvedTheme;
  /** Scatter fill opacity chosen once from the largest per-period key count. */
  pointOpacity: number;
  /** One formatter per data field, resolved over all matrix values. */
  formatters: Record<string, (value: number) => string>;
  /** The envelope's normalized render spec; frames replace its `data` and keep the rest. */
  spec: NormalizedChartSpec;
  /** Responsive strategy the envelope compiled with; passed to the renderer each frame. */
  strategy: LayoutStrategy;
}

/** One base key's mark at a playhead. */
export interface FrameMark {
  /** Identity: `encoding.key` for points, `color|category` for bars. */
  key: string;
  /** The renderer's mark for this key's interpolated values, with `key` set. */
  mark: Mark;
  /** Fade multiplier, 0..1, applied on top of the mark's own opacity. */
  presence: number;
}

/** A key's values at the nearest period, for tooltips. */
export interface ObservedValues {
  /** Label of the nearest period, e.g. "1987". */
  periodLabel: string;
  /** True when that period's values were filled by the gap policy rather than observed. */
  filled: boolean;
  /** Field name to value formatted with the frozen formatter (nominal fields as-is). */
  values: Record<string, string>;
}

/** A key's past positions up to the playhead, in frozen pixel space. */
export interface TrailPath {
  key: string;
  /** Positions at each period up to and including floor(t) where the key has values. */
  points: Point[];
  /** Interpolated position at t. */
  head: Point;
}

/** A compiled playback chart: the frozen frame plus pure functions of the playhead `t`. */
export interface ChartPlayback {
  frame: FrozenChartFrame;
  /**
   * The layout the DOM is built from: the frozen layout with one mark per key in the union
   * of all periods, drawn at the final period, ordered by maximum size so small marks draw
   * on top. The period label comes before those marks and the name labels after them.
   */
  base: ChartLayout;
  /** Periods in playback order. */
  periods: PlaybackPeriod[];
  /** Display label per period. */
  periodLabels: string[];
  timing: ResolvedPlayback;
  /** Base keys in base mark order. */
  keys: string[];
  /** Advisory warnings found while building the playback (also sent to `onWarn`). */
  warnings: string[];
  /** One entry per base key, in base order. `t` is a continuous period index, clamped. */
  marksAt(t: number): FrameMark[];
  /**
   * Text marks drawn over the run at `t`: the period label (key `oc-playback-period`, absent
   * when `playback.period` is false) first, then one name label per `playback.labels` key
   * (key `oc-playback-label|<key>`) beside its point, with the point's presence.
   */
  overlaysAt(t: number): FrameMark[];
  /** Trails for the keys `playback.trails` names; empty when trails are off. */
  trailsAt(t: number): TrailPath[];
  /** The key's values at the period nearest `t`, or null when the key has none there. */
  observedAt(key: string, t: number): ObservedValues | null;
  /** One-line summary of the frame at `t` for the live region. */
  describe(t: number): string;
}
