/**
 * Axis computation: tick positions, labels, and axis lines.
 *
 * Generates ticks manually (no d3-axis) so we have full control over
 * responsive tick density and formatting.
 */

import type {
  AxisLabelDensity,
  AxisLayout,
  AxisTick,
  Gridline,
  LayoutStrategy,
  MeasureTextFn,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import {
  abbreviateNumber,
  buildD3Formatter,
  buildTemporalFormatter,
  estimateTextWidth,
  formatDate,
  formatNumber,
} from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import type {
  D3CategoricalScale,
  D3ContinuousScale,
  ResolvedScale,
  ResolvedScales,
} from './scales';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base tick counts by axis label density. */
const TICK_COUNTS: Record<AxisLabelDensity, number> = {
  full: 8,
  reduced: 5,
  minimal: 3,
};

/**
 * Height thresholds for reducing y-axis tick density.
 * Below these pixel heights, we step down the density regardless of the
 * width-based strategy. This prevents overlapping y-axis labels in short
 * containers like thumbnail previews.
 */
const HEIGHT_MINIMAL_THRESHOLD = 120;
const HEIGHT_REDUCED_THRESHOLD = 200;

/**
 * Width thresholds for reducing x-axis tick density.
 * Mirrors the height logic for the x-axis: narrow containers get fewer ticks.
 */
const WIDTH_MINIMAL_THRESHOLD = 150;
const WIDTH_REDUCED_THRESHOLD = 300;

/**
 * Minimum gap between adjacent tick labels as a multiple of font size.
 * At the default 12px axis font, this yields ~12px of breathing room.
 */
const MIN_TICK_GAP_FACTOR = 1.0;

/** Always show at least this many ticks, even if they overlap. */
const MIN_TICK_COUNT = 2;

/** Ordered densities from most to fewest ticks. */
const DENSITY_ORDER: AxisLabelDensity[] = ['full', 'reduced', 'minimal'];

/**
 * Compute effective axis tick density by considering available space.
 *
 * The width-based breakpoint system sets a base density, but it doesn't know
 * about the actual chart area dimensions (which shrink after chrome/legend
 * allocation). This function steps density down further when the axis
 * dimension is too small for the requested tick count.
 *
 * @param baseDensity - The density from the responsive layout strategy.
 * @param axisLength - Available pixels along this axis (height for y, width for x).
 * @param minimalThreshold - Below this pixel size, force minimal density.
 * @param reducedThreshold - Below this pixel size, cap at reduced density.
 * @returns The effective density, never looser than the base.
 */
export function effectiveDensity(
  baseDensity: AxisLabelDensity,
  axisLength: number,
  minimalThreshold: number,
  reducedThreshold: number,
): AxisLabelDensity {
  let density = baseDensity;

  if (axisLength < minimalThreshold) {
    density = 'minimal';
  } else if (axisLength < reducedThreshold) {
    // Don't increase density beyond what the base strategy allows.
    // If base is already 'minimal', keep it.
    const baseIdx = DENSITY_ORDER.indexOf(baseDensity);
    const reducedIdx = DENSITY_ORDER.indexOf('reduced');
    density = DENSITY_ORDER[Math.max(baseIdx, reducedIdx)];
  }

  return density;
}

// ---------------------------------------------------------------------------
// Label overlap detection and thinning
// ---------------------------------------------------------------------------

/** Measure a single label's width using real measurement or heuristic fallback. */
function measureLabel(
  text: string,
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): number {
  return measureText
    ? measureText(text, fontSize, fontWeight).width
    : estimateTextWidth(text, fontSize, fontWeight);
}

/** Check whether any adjacent tick labels overlap horizontally. */
export function ticksOverlap(
  ticks: AxisTick[],
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): boolean {
  if (ticks.length < 2) return false;
  const minGap = fontSize * MIN_TICK_GAP_FACTOR;
  for (let i = 0; i < ticks.length - 1; i++) {
    const aWidth = measureLabel(ticks[i].label, fontSize, fontWeight, measureText);
    const bWidth = measureLabel(ticks[i + 1].label, fontSize, fontWeight, measureText);
    const aRight = ticks[i].position + aWidth / 2;
    const bLeft = ticks[i + 1].position - bWidth / 2;
    if (aRight + minGap > bLeft) return true;
  }
  return false;
}

/**
 * Thin a tick array by removing every other tick until labels don't overlap.
 * Always keeps first and last tick. O(log n) iterations max.
 * Returns the original array if no thinning is needed.
 */
export function thinTicksUntilFit(
  ticks: AxisTick[],
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): AxisTick[] {
  if (!ticksOverlap(ticks, fontSize, fontWeight, measureText)) return ticks;

  let current = ticks;
  while (current.length > MIN_TICK_COUNT) {
    // Keep first, last, and every other tick in between
    const thinned = [current[0]];
    for (let i = 2; i < current.length - 1; i += 2) {
      thinned.push(current[i]);
    }
    if (current.length > 1) thinned.push(current[current.length - 1]);
    current = thinned;

    if (!ticksOverlap(current, fontSize, fontWeight, measureText)) break;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Tick generation
// ---------------------------------------------------------------------------

/** Generate ticks for a continuous scale (linear, time, log, pow, sqrt, symlog). */
function continuousTicks(resolvedScale: ResolvedScale, density: AxisLabelDensity): AxisTick[] {
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
function categoricalTicks(resolvedScale: ResolvedScale, density: AxisLabelDensity): AxisTick[] {
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

/** Resolve explicit tick values from axis config into positioned ticks. */
function resolveExplicitTicks(values: unknown[], resolvedScale: ResolvedScale): AxisTick[] {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Output of computeAxes. */
export interface AxesResult {
  x?: AxisLayout;
  y?: AxisLayout;
}

/**
 * Compute axis layouts with tick positions, labels, and axis lines.
 *
 * @param scales - Resolved scales from computeScales.
 * @param chartArea - The chart drawing area.
 * @param strategy - Responsive layout strategy.
 * @param theme - Resolved theme for styling.
 * @param measureText - Optional real text measurement from the adapter.
 */
export function computeAxes(
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
): AxesResult {
  const result: AxesResult = {};
  const baseDensity = strategy.axisLabelDensity;

  // Compute per-axis density based on available space.
  // Y-axis density adapts to chart height; X-axis density adapts to chart width.
  const yDensity = effectiveDensity(
    baseDensity,
    chartArea.height,
    HEIGHT_MINIMAL_THRESHOLD,
    HEIGHT_REDUCED_THRESHOLD,
  );
  const xDensity = effectiveDensity(
    baseDensity,
    chartArea.width,
    WIDTH_MINIMAL_THRESHOLD,
    WIDTH_REDUCED_THRESHOLD,
  );

  const tickLabelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.axisTick,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.axis,
    lineHeight: 1.2,
    fontVariant: 'tabular-nums',
  };

  const axisLabelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.body,
    fontWeight: theme.fonts.weights.medium,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };

  const { fontSize } = tickLabelStyle;
  const { fontWeight } = tickLabelStyle;

  if (scales.x) {
    const axisConfig = scales.x.channel.axis;

    // Use explicit tick values from axis config if provided
    let allTicks: AxisTick[];
    if (axisConfig?.values) {
      allTicks = resolveExplicitTicks(axisConfig.values, scales.x);
    } else if (
      scales.x.type === 'band' ||
      scales.x.type === 'point' ||
      scales.x.type === 'ordinal'
    ) {
      allTicks = categoricalTicks(scales.x, xDensity);
    } else {
      allTicks = continuousTicks(scales.x, xDensity);
    }

    // Gridlines use the full tick set so they remain visible even when labels
    // are thinned to prevent overlap.
    const gridlines: Gridline[] = allTicks.map((t) => ({
      position: t.position,
      major: true,
    }));

    // Thin tick labels to prevent overlap (skip for band scales which use
    // auto-rotation, and when the user set an explicit tickCount or values).
    const shouldThin = scales.x.type !== 'band' && !axisConfig?.tickCount && !axisConfig?.values;
    const ticks = shouldThin
      ? thinTicksUntilFit(allTicks, fontSize, fontWeight, measureText)
      : allTicks;

    // Auto-rotate labels when band scale labels would overlap.
    // Uses max label width (not average) since one long label is enough to overlap.
    // Prefer labelAngle over deprecated tickAngle
    let tickAngle = axisConfig?.labelAngle ?? axisConfig?.tickAngle;
    if (tickAngle === undefined && scales.x.type === 'band' && ticks.length > 1) {
      const bandwidth = (scales.x.scale as ScaleBand<string>).bandwidth();
      let maxLabelWidth = 0;
      for (const t of ticks) {
        const w = measureLabel(t.label, fontSize, fontWeight, measureText);
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
      // If the widest label exceeds 85% of the bandwidth, rotate to avoid overlap
      if (maxLabelWidth > bandwidth * 0.85) {
        tickAngle = -45;
      }
    }

    // Prefer title over deprecated label
    const axisTitle = axisConfig?.title ?? axisConfig?.label;

    result.x = {
      ticks,
      gridlines: axisConfig?.grid ? gridlines : [],
      label: axisTitle,
      labelStyle: axisLabelStyle,
      tickLabelStyle,
      tickAngle,
      start: { x: chartArea.x, y: chartArea.y + chartArea.height },
      end: { x: chartArea.x + chartArea.width, y: chartArea.y + chartArea.height },
      orient: axisConfig?.orient,
      domainLine: axisConfig?.domain,
      tickMarks: axisConfig?.ticks,
      offset: axisConfig?.offset,
      titlePadding: axisConfig?.titlePadding,
      labelPadding: axisConfig?.labelPadding,
      labelOverlap: axisConfig?.labelOverlap,
      labelFlush: axisConfig?.labelFlush,
    };
  }

  if (scales.y) {
    const axisConfig = scales.y.channel.axis;

    // Use explicit tick values from axis config if provided
    let allTicks: AxisTick[];
    if (axisConfig?.values) {
      allTicks = resolveExplicitTicks(axisConfig.values, scales.y);
    } else if (
      scales.y.type === 'band' ||
      scales.y.type === 'point' ||
      scales.y.type === 'ordinal'
    ) {
      allTicks = categoricalTicks(scales.y, yDensity);
    } else {
      allTicks = continuousTicks(scales.y, yDensity);
    }

    // Gridlines use the full tick set (label thinning shouldn't remove gridlines).
    const gridlines: Gridline[] = allTicks.map((t) => ({
      position: t.position,
      major: true,
    }));

    // Thin tick labels to prevent overlap (skip for band scales, explicit tickCount, and values).
    const shouldThin = scales.y.type !== 'band' && !axisConfig?.tickCount && !axisConfig?.values;
    const ticks = shouldThin
      ? thinTicksUntilFit(allTicks, fontSize, fontWeight, measureText)
      : allTicks;

    // Prefer title over deprecated label, labelAngle over deprecated tickAngle
    const axisTitle = axisConfig?.title ?? axisConfig?.label;
    const tickAngle = axisConfig?.labelAngle ?? axisConfig?.tickAngle;

    result.y = {
      ticks,
      // Y-axis gridlines are shown by default (standard editorial practice)
      gridlines,
      label: axisTitle,
      labelStyle: axisLabelStyle,
      tickLabelStyle,
      tickAngle,
      start: { x: chartArea.x, y: chartArea.y },
      end: { x: chartArea.x, y: chartArea.y + chartArea.height },
      orient: axisConfig?.orient,
      domainLine: axisConfig?.domain,
      tickMarks: axisConfig?.ticks,
      offset: axisConfig?.offset,
      titlePadding: axisConfig?.titlePadding,
      labelPadding: axisConfig?.labelPadding,
      labelOverlap: axisConfig?.labelOverlap,
      labelFlush: axisConfig?.labelFlush,
    };
  }

  return result;
}
