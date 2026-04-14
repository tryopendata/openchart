/**
 * Tick generation: produces raw AxisTick[] from a resolved scale.
 *
 * Pure with respect to layout dimensions — positions come from the scale,
 * not from the chart area. Density thinning lives in ./thinning.ts.
 */

import type { AxisLabelDensity, AxisTick } from '@opendata-ai/openchart-core';
import {
  abbreviateNumber,
  buildD3Formatter,
  buildTemporalFormatter,
  formatDate,
  formatNumber,
} from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import type { D3CategoricalScale, D3ContinuousScale, ResolvedScale } from '../scales';

/**
 * Target pixels-per-tick for continuous axes. The target count is computed as
 * `axisLength / PX_PER_TICK[density]` and then clamped into the count range.
 *
 * Rationale:
 * - Observable Plot uses 50px/tick on y, 80px/tick on x as its baseline.
 * - ONS editorial guidance recommends 6-10 y-gridlines at desktop, 3-6 mobile.
 * - The Economist / FT / NYT typically show 4-6 labeled y-ticks on finished charts.
 *
 * Y gets tighter spacing than X because vertical label extent is the font height
 * (~14px) versus horizontal label extent which can be 60-100px for dates/abbreviated
 * numbers. X uses wider spacing so labels don't need aggressive rotation or thinning.
 *
 * "full" is the publication-ready default; "reduced" and "minimal" step down as the
 * responsive breakpoint system shifts to smaller containers.
 *
 * @internal — these are tuning constants, not part of the configuration API.
 * Consumers should configure tick density through `axis.tickCount` on the spec.
 */
const Y_PX_PER_TICK: Record<AxisLabelDensity, number> = {
  full: 55,
  reduced: 90,
  minimal: 140,
};

const X_PX_PER_TICK: Record<AxisLabelDensity, number> = {
  full: 110,
  reduced: 160,
  minimal: 220,
};

/**
 * Count clamps per density. The lower bound keeps a chart from collapsing to
 * a single label on very short axes; the upper bound stops tall/wide charts
 * from growing a ladder of ticks past the point of editorial usefulness.
 *
 * The upper bound is deliberately <=6 for y on standard tiers: D3's
 * `scale.ticks(n)` only produces "nice" step sizes (1, 2, 5 × 10^k), and for
 * many domains the jump from step=10 to step=5 happens between count 6 and 7.
 * Requesting 7 can give back 10, which reads as visually dense. Capping at 6
 * keeps the editorial ~5 gridline average regardless of domain shape.
 *
 * @internal — see PX_PER_TICK comment.
 */
const Y_TICK_COUNT_RANGE: Record<AxisLabelDensity, [number, number]> = {
  full: [4, 6],
  reduced: [3, 5],
  minimal: [2, 3],
};

const X_TICK_COUNT_RANGE: Record<AxisLabelDensity, [number, number]> = {
  full: [3, 6],
  reduced: [3, 5],
  minimal: [2, 3],
};

/**
 * Fallback tick counts for callers that don't have an axis length handy
 * (categorical band-scale thinning uses this as a cap, and `continuousTicks`
 * uses it when no `targetCount` is provided).
 *
 * @internal
 */
const TICK_COUNTS: Record<AxisLabelDensity, number> = {
  full: 7,
  reduced: 5,
  minimal: 3,
};

/**
 * Compute a target tick count for a continuous axis from its pixel length and
 * density tier. Uses the Plot-style pixels-per-tick heuristic, then clamps
 * into the density's count range.
 */
export function targetTickCount(
  axisLength: number,
  density: AxisLabelDensity,
  orientation: 'x' | 'y',
): number {
  const pxPerTick = orientation === 'y' ? Y_PX_PER_TICK[density] : X_PX_PER_TICK[density];
  const [min, max] =
    orientation === 'y' ? Y_TICK_COUNT_RANGE[density] : X_TICK_COUNT_RANGE[density];
  const raw = Math.round(axisLength / pxPerTick);
  return Math.max(min, Math.min(max, raw));
}

/** Set of continuous numeric scale types that should format as numbers. */
const NUMERIC_SCALE_TYPES = new Set([
  'linear',
  'log',
  'pow',
  'sqrt',
  'symlog',
  'quantile',
  'quantize',
  'threshold',
]);

/** Set of temporal scale types. */
const TEMPORAL_SCALE_TYPES = new Set(['time', 'utc']);

/** Format a tick value based on the scale type. */
function formatTickLabel(value: unknown, resolvedScale: ResolvedScale): string {
  const formatStr = resolvedScale.channel.axis?.format;

  if (TEMPORAL_SCALE_TYPES.has(resolvedScale.type)) {
    const temporalFmt = buildTemporalFormatter(formatStr);
    if (temporalFmt) return temporalFmt(value as Date);
    const useUtc = resolvedScale.type === 'utc';
    return formatDate(value as Date, undefined, undefined, useUtc);
  }

  if (NUMERIC_SCALE_TYPES.has(resolvedScale.type)) {
    const num = value as number;
    if (formatStr) {
      const fmt = buildD3Formatter(formatStr);
      if (fmt) return fmt(num);
    }
    // Abbreviate large numbers for axis labels
    if (Math.abs(num) >= 1000) return abbreviateNumber(num);
    return formatNumber(num);
  }

  return String(value);
}

/**
 * Generate ticks for a continuous scale (linear, time, log, pow, sqrt, symlog).
 *
 * `targetCount` lets callers that know the axis pixel length pass a
 * density-appropriate count (see `targetTickCount`). When omitted, falls back
 * to the coarse `TICK_COUNTS` tier, which is only used by tests and callers
 * that don't have an axis length.
 */
export function continuousTicks(
  resolvedScale: ResolvedScale,
  density: AxisLabelDensity,
  targetCount?: number,
): AxisTick[] {
  const scale = resolvedScale.scale as D3ContinuousScale;

  // Discretizing scales (quantile, quantize, threshold) don't have .ticks().
  // Use their domain thresholds as ticks instead.
  if (!('ticks' in scale) || typeof scale.ticks !== 'function') {
    const domain = scale.domain() as unknown[];
    return domain.map((value: unknown) => ({
      value,
      position: (scale as D3ContinuousScale)(value as number & Date) as number,
      label: formatTickLabel(value, resolvedScale),
    }));
  }

  const explicitCount = resolvedScale.channel.axis?.tickCount;
  const count = explicitCount ?? targetCount ?? TICK_COUNTS[density];
  return buildContinuousTicks(resolvedScale, count);
}

/**
 * Build positioned, labeled ticks for a continuous scale at an exact count.
 * Exposed so callers that need to re-request ticks at a lower count (for
 * overlap-driven density adaptation) can regenerate without manual pruning.
 * D3's `scale.ticks(n)` always returns evenly-spaced round values, so
 * requesting a smaller `n` never produces squished neighbors — unlike
 * "keep first+last, drop middle" pruning which can stack the last tick
 * next to an endpoint and cascade to 2 ticks.
 */
export function buildContinuousTicks(resolvedScale: ResolvedScale, count: number): AxisTick[] {
  const scale = resolvedScale.scale as D3ContinuousScale;
  if (!('ticks' in scale) || typeof scale.ticks !== 'function') {
    return continuousTicks(resolvedScale, 'full');
  }
  const raw: unknown[] = scale.ticks(count);
  return raw.map((value: unknown) => ({
    value,
    position: scale(value as number & Date) as number,
    label: formatTickLabel(value, resolvedScale),
  }));
}

/** True if this scale supports regenerating ticks at an arbitrary count. */
export function scaleSupportsTickCount(resolvedScale: ResolvedScale): boolean {
  const scale = resolvedScale.scale as D3ContinuousScale;
  return 'ticks' in scale && typeof scale.ticks === 'function';
}

/** Generate ticks for a band/point/ordinal scale. */
export function categoricalTicks(
  resolvedScale: ResolvedScale,
  density: AxisLabelDensity,
): AxisTick[] {
  const scale = resolvedScale.scale as D3CategoricalScale;
  const domain: string[] = scale.domain();
  const explicitTickCount = resolvedScale.channel.axis?.tickCount;
  const maxTicks = explicitTickCount ?? TICK_COUNTS[density];

  // Band scales (bar charts) show all category labels by default.
  // Only thin when there's an explicit tickCount override or for point/ordinal scales.
  let selectedValues = domain;
  if ((resolvedScale.type !== 'band' || explicitTickCount) && domain.length > maxTicks) {
    const step = Math.ceil(domain.length / maxTicks);
    selectedValues = domain.filter((_: string, i: number) => i % step === 0);
  }

  const ticks = selectedValues.map((value: string) => {
    // Band scales: use the center of the band
    const bandScale = resolvedScale.type === 'band' ? (scale as ScaleBand<string>) : null;
    const pos = bandScale
      ? (bandScale(value) ?? 0) + bandScale.bandwidth() / 2
      : ((scale(value) as number | undefined) ?? 0);

    return {
      value,
      position: pos,
      label: value,
    };
  });

  return ticks;
}

/** Resolve explicit tick values from axis config into positioned ticks. */
export function resolveExplicitTicks(values: unknown[], resolvedScale: ResolvedScale): AxisTick[] {
  const scale = resolvedScale.scale;
  return values.map((value) => {
    let position: number;
    if (TEMPORAL_SCALE_TYPES.has(resolvedScale.type)) {
      const d = value instanceof Date ? value : new Date(String(value));
      position = (scale as D3ContinuousScale)(d as number & Date) as number;
    } else if (
      resolvedScale.type === 'band' ||
      resolvedScale.type === 'point' ||
      resolvedScale.type === 'ordinal'
    ) {
      const s = String(value);
      const bandScale = resolvedScale.type === 'band' ? (scale as ScaleBand<string>) : null;
      position = bandScale
        ? (bandScale(s) ?? 0) + bandScale.bandwidth() / 2
        : ((scale(s as string & number) as number | undefined) ?? 0);
    } else {
      position = (scale as D3ContinuousScale)(value as number & Date) as number;
    }
    return {
      value,
      position,
      label: formatTickLabel(value, resolvedScale),
    };
  });
}
