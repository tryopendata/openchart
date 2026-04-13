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

/** Base tick counts by axis label density. */
export const TICK_COUNTS: Record<AxisLabelDensity, number> = {
  full: 12,
  reduced: 8,
  minimal: 4,
};

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

/** Generate ticks for a continuous scale (linear, time, log, pow, sqrt, symlog). */
export function continuousTicks(
  resolvedScale: ResolvedScale,
  density: AxisLabelDensity,
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
  const count = explicitCount ?? TICK_COUNTS[density];
  const rawTicks: unknown[] = scale.ticks(count);

  const ticks = rawTicks.map((value: unknown) => ({
    value,
    position: scale(value as number & Date) as number,
    label: formatTickLabel(value, resolvedScale),
  }));

  return ticks;
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
