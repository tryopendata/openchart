/**
 * Tick generation: produces raw AxisTick[] from a resolved scale.
 *
 * Pure with respect to layout dimensions — positions come from the scale,
 * not from the chart area. Density thinning lives in ./thinning.ts.
 */

import type { AxisLabelDensity, AxisTick, DataRow } from '@opendata-ai/openchart-core';
import {
  buildD3Formatter,
  buildTemporalFormatter,
  formatDate,
  resolveNumberFormatter,
} from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import { resolveFieldFormatter } from '../../format/field-format';
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
 * Y full is set to 40px/tick (tighter than Observable Plot's 50) because chart areas
 * are measured after chrome subtraction. A 400px container with title+subtitle leaves
 * ~270px of chart area; 55px/tick would only produce 4 ticks. 40px/tick reaches 5-6
 * on typical chart areas (150-300px) and the overlap check acts as a safety net.
 *
 * @internal — these are tuning constants, not part of the configuration API.
 * Consumers should configure tick density through `axis.tickCount` on the spec.
 */
const Y_PX_PER_TICK: Record<AxisLabelDensity, number> = {
  full: 40,
  reduced: 70,
  minimal: 120,
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

interface TickContext {
  step?: number;
  maxAbsTick?: number;
}

/** Format a tick value based on the scale type. */
function formatTickLabel(
  value: unknown,
  resolvedScale: ResolvedScale,
  compact = false,
  tickContext?: TickContext,
): string {
  const axisConfig = resolvedScale.channel.axis || undefined;
  const formatStr = axisConfig?.format;
  const suffix = axisConfig?.labelSuffix ?? '';

  if (TEMPORAL_SCALE_TYPES.has(resolvedScale.type)) {
    // Explicit user axis.format always wins, compact or not.
    const temporalFmt = buildTemporalFormatter(formatStr);
    if (temporalFmt) return temporalFmt(value as Date) + suffix;
    const useUtc = resolvedScale.type === 'utc';
    return formatDate(value as Date, undefined, undefined, useUtc, compact) + suffix;
  }

  if (NUMERIC_SCALE_TYPES.has(resolvedScale.type)) {
    const num = value as number;
    if (formatStr) {
      const ctx = {
        ...resolvedScale.formatContext,
        step: tickContext?.step,
        stepReference: tickContext?.maxAbsTick,
      };
      const fmt = resolveNumberFormatter(formatStr, ctx);
      if (fmt) return fmt(num) + suffix;
      const d3Fmt = buildD3Formatter(formatStr);
      if (d3Fmt) return d3Fmt(num) + suffix;
    }
    const fmt = resolveFieldFormatter({
      channelFormat: resolvedScale.channel.format,
      context: {
        ...resolvedScale.formatContext,
        step: tickContext?.step,
        stepReference: tickContext?.maxAbsTick,
      },
    });
    return fmt(num) + suffix;
  }

  return String(value) + suffix;
}

function computeTickContext(ticks: unknown[]): TickContext | undefined {
  if (ticks.length < 2) return undefined;
  const nums = ticks.filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
  if (nums.length < 2) return undefined;

  const firstGap = Math.abs(nums[1] - nums[0]);
  if (firstGap === 0) return undefined;

  let uniform = true;
  for (let i = 2; i < nums.length; i++) {
    const gap = Math.abs(nums[i] - nums[i - 1]);
    const relDiff = Math.abs(gap - firstGap) / Math.max(firstGap, 1e-15);
    if (relDiff > 1e-9) {
      uniform = false;
      break;
    }
  }

  if (!uniform) return undefined;

  return {
    step: firstGap,
    maxAbsTick: Math.max(Math.abs(nums[0]), Math.abs(nums[nums.length - 1])),
  };
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

  const axCfg = resolvedScale.channel.axis || undefined;
  const count = axCfg?.tickCount ?? targetCount ?? TICK_COUNTS[density];
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
 *
 * `compact` switches temporal labels to the compact format table (bare '%b'
 * months etc.); numeric and string labels ignore it.
 */
export function buildContinuousTicks(
  resolvedScale: ResolvedScale,
  count: number,
  compact = false,
): AxisTick[] {
  const scale = resolvedScale.scale as D3ContinuousScale;
  if (!('ticks' in scale) || typeof scale.ticks !== 'function') {
    return continuousTicks(resolvedScale, 'full');
  }
  const raw: unknown[] = scale.ticks(count);

  // D3 log scales ignore the count hint and return ticks at every sub-power
  // position (e.g. 5, 6, 7, 8, 9, 10, 20, 30... for a domain of [5, 25000]).
  // Filter down to powers of the base only when the raw set overshoots.
  let ticks = raw;
  if (resolvedScale.type === 'log' && raw.length > count) {
    const base = resolvedScale.channel.scale?.base ?? 10;
    const logBase = Math.log(base);
    const powered = raw.filter((v) => {
      const n = v as number;
      if (n <= 0) return false;
      const exp = Math.log(n) / logBase;
      return Math.abs(exp - Math.round(exp)) < 1e-9;
    });
    // Only use the filtered set if it has at least 2 ticks; otherwise fall back
    // to raw ticks. This handles domains like [5, 9] (no powers of 10 at all) or
    // [5, 50] (only one power: 10) where filtering would leave too few meaningful ticks.
    if (powered.length >= 2) {
      ticks = powered;
    }
  }

  const tickCtx = computeTickContext(ticks);

  return ticks.map((value: unknown) => ({
    value,
    position: scale(value as number & Date) as number,
    label: formatTickLabel(value, resolvedScale, compact, tickCtx),
  }));
}

/** True if this scale supports regenerating ticks at an arbitrary count. */
export function scaleSupportsTickCount(resolvedScale: ResolvedScale): boolean {
  const scale = resolvedScale.scale as D3ContinuousScale;
  return 'ticks' in scale && typeof scale.ticks === 'function';
}

/**
 * Generate ticks for a band/point/ordinal scale.
 *
 * For horizontal x-axis band scales, thinning is geometry-aware: if
 * `bandwidth` and `fontSize`/`fontWeight` are provided, labels are only
 * thinned when the estimated label footprint (accounting for `labelAngle`)
 * actually exceeds the bandwidth. When labels are rotated, their horizontal
 * footprint shrinks by |cos(angle)|, so far fewer need to be removed.
 * Falls back to a density-count cap when geometry info is unavailable.
 */
export function categoricalTicks(
  resolvedScale: ResolvedScale,
  density: AxisLabelDensity,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
  subtitleContext?: { data: DataRow[]; fieldName: string; labelField: string },
): AxisTick[] {
  const scale = resolvedScale.scale as D3CategoricalScale;
  const domain: string[] = scale.domain();
  const catAxisCfg = resolvedScale.channel.axis || undefined;
  const explicitTickCount = catAxisCfg?.tickCount;

  let selectedValues = domain;

  if (resolvedScale.type === 'band' && orientation === 'horizontal') {
    // Horizontal band scales delegate thinning to the caller (computeAxes)
    // which knows the effective label angle after auto-rotation. Only apply
    // an explicit tickCount cap here; the angle ladder + stride safety net
    // (see ./rotation) handle collisions downstream.
    if (explicitTickCount && domain.length > explicitTickCount) {
      const step = Math.ceil(domain.length / explicitTickCount);
      selectedValues = domain.filter((_: string, i: number) => i % step === 0);
    }
  } else if (resolvedScale.type !== 'band') {
    // Point/ordinal scales: thin by density count
    const maxTicks = explicitTickCount ?? TICK_COUNTS[density];
    if (domain.length > maxTicks) {
      const step = Math.ceil(domain.length / maxTicks);
      selectedValues = domain.filter((_: string, i: number) => i % step === 0);
    }
  }
  // vertical band scale (horizontal bar y-axis): always show all labels

  let subtitleMap: Map<string, string> | undefined;
  if (subtitleContext) {
    const { data, fieldName, labelField } = subtitleContext;
    if (data.length > 0) {
      subtitleMap = new Map();
      for (const row of data) {
        const key = String(row[fieldName] ?? '');
        if (!subtitleMap.has(key)) {
          const val = row[labelField];
          if (val != null) {
            subtitleMap.set(key, String(val));
          }
        }
      }
    }
  }

  const ticks = selectedValues.map((value: string) => {
    // Band scales: use the center of the band
    const bandScale = resolvedScale.type === 'band' ? (scale as ScaleBand<string>) : null;
    const pos = bandScale
      ? (bandScale(value) ?? 0) + bandScale.bandwidth() / 2
      : ((scale(value) as number | undefined) ?? 0);

    const tick: AxisTick = {
      value,
      position: pos,
      label: value,
    };

    if (subtitleMap) {
      const subtitle = subtitleMap.get(value);
      if (subtitle !== undefined) {
        tick.subtitle = subtitle;
      }
    }

    return tick;
  });

  return ticks;
}

/**
 * Resolve explicit tick values from axis config into positioned ticks.
 *
 * Deliberately never compact: this renders the layout planner's precomputed
 * ticks, and planner/renderer gutter agreement holds only because both sides
 * format identically. Making this compact without making the planner compact
 * recreates the reserved-space divergence bug class behind the 7.9.x saga.
 */
export function resolveExplicitTicks(values: unknown[], resolvedScale: ResolvedScale): AxisTick[] {
  const scale = resolvedScale.scale;
  const tickCtx = computeTickContext(values);
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
      label: formatTickLabel(value, resolvedScale, false, tickCtx),
    };
  });
}
