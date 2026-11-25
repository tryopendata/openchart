/**
 * The parts of a map playback that geo and tile maps share: reading the time channel and
 * `playback` block off the spec, timing and period labels, the period label overlay, the
 * warnings collector, and the live-region summary.
 */
import type {
  CompileOptions,
  EncodingChannel,
  PlaybackConfig,
  Rect,
  ResolvedTheme,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { compile as compileSpec } from '../compiler/index';
import type { NormalizedSpec } from '../compiler/types';
import { mapPeriodPlacement } from './map-period-placement';
import type { MapSeries, MapSeriesOptions } from './map-series';
import { type ResolvedPlayback, resolvePlayback } from './options';
import { periodLabelMark } from './overlays';
import { formatPeriodLabels } from './period-labels';
import type { PlaybackPeriod, PlaybackTimeType } from './periods';

/** Fewer periods than this and the map renders static, without a period label (RFC 4.4). */
const MIN_PLAYBACK_PERIODS = 2;

/** A spec after sugar expansion, validation and normalization. */
export interface PreparedMapSpec<Normalized extends NormalizedSpec> {
  /** The authored spec after sugar expansion; frame compiles start from it. */
  expanded: Record<string, unknown>;
  normalized: Normalized;
  /** The authored `playback` block (normalization drops it). */
  block: PlaybackConfig | undefined;
}

/** Warnings deduplicated across the playback's own pass and every frame compile. */
export interface WarningCollector {
  warnings: string[];
  warn(message: string): void;
  /** Compile options whose `onWarn` goes through the collector. */
  options: CompileOptions;
}

/** Collect warnings once each, forwarding them to the caller's `onWarn`. */
export function collectWarnings(options: CompileOptions): WarningCollector {
  const warnings: string[] = [];
  const warn = (message: string) => {
    if (warnings.includes(message)) return;
    warnings.push(message);
    emitSpecWarnings([message], options.onWarn);
  };
  return { warnings, warn, options: { ...options, onWarn: warn } };
}

/**
 * Expand, validate and normalize a map spec.
 *
 * @throws The validation error compile throws for an invalid spec.
 */
export function prepareMapSpec<Normalized extends NormalizedSpec>(
  spec: unknown,
): PreparedMapSpec<Normalized> {
  const expanded = expandSpecSugar(spec as Record<string, unknown>, []);
  // Frame compiles emit the normalize warnings; this pass only needs the normalized spec.
  const { spec: normalized } = compileSpec(expanded);
  return {
    expanded,
    normalized: normalized as Normalized,
    block: expanded.playback as PlaybackConfig | undefined,
  };
}

/** The time channel as the matrix reads it; validation guarantees the field and type. */
export function seriesTime(channel: EncodingChannel): MapSeriesOptions['time'] {
  return { ...channel, type: (channel.type ?? 'temporal') as PlaybackTimeType };
}

/** Timing, period labels and the period label text for one run. */
export interface MapRunTiming {
  periods: PlaybackPeriod[];
  periodLabels: string[];
  timing: ResolvedPlayback;
  /** Period label text per period, or null when hidden or there is nothing to play. */
  periodTexts: string[] | null;
}

/**
 * Resolve the run's timing and labels from its primary series.
 *
 * @throws {RangeError} When `playback.step` overflows over the period count.
 */
export function resolveMapRun(
  series: MapSeries,
  block: PlaybackConfig | undefined,
  time: EncodingChannel,
): MapRunTiming {
  const periods = series.sampler.matrix.periods;
  const timing = resolvePlayback(block, periods.length);
  const periodLabels = formatPeriodLabels(periods, time);
  const { period } = timing;
  const periodTexts =
    period === false || periods.length < MIN_PLAYBACK_PERIODS
      ? null
      : period.format
        ? formatPeriodLabels(periods, { ...time, format: period.format })
        : periodLabels;
  return { periods, periodLabels, timing, periodTexts };
}

/**
 * The period label at a playhead, placed once for the run inside `area` (see
 * `mapPeriodPlacement`; `obstacles` are the drawn features or tiles). Returns no marks when
 * the label is hidden or there is nothing to play.
 */
export function createMapPeriodOverlay(
  run: MapRunTiming,
  area: Rect,
  theme: ResolvedTheme,
  obstacles: Rect[],
): (t: number) => TextMarkLayout[] {
  const { periodTexts, timing } = run;
  if (!periodTexts || timing.period === false) return () => [];
  const weight = theme.fonts.weights.bold;
  const placement = mapPeriodPlacement(
    timing.period.position,
    area,
    periodTexts,
    obstacles,
    weight,
  );
  const last = periodTexts.length - 1;
  return (t) => {
    const period = Number.isFinite(t) ? Math.round(Math.min(Math.max(t, 0), last)) : last;
    return [periodLabelMark(periodTexts[period], placement, theme)];
  };
}

/** A named value at one period, for the live-region summary. */
export interface NamedValue {
  name: string;
  text: string;
  value: number;
}

/** "Apr 2020: highest Michigan 22.7, lowest Utah 1.2." from the period's named values. */
export function describeExtremes(periodLabel: string, values: NamedValue[]): string {
  if (values.length === 0) return `${periodLabel}: no values.`;
  let highest = values[0];
  let lowest = values[0];
  for (const entry of values) {
    if (entry.value > highest.value) highest = entry;
    if (entry.value < lowest.value) lowest = entry;
  }
  return `${periodLabel}: highest ${highest.name} ${highest.text}, lowest ${lowest.name} ${lowest.text}.`;
}
