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
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { abbreviateNumber, formatDate, formatNumber } from '@opendata-ai/openchart-core';
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
// Tick generation
// ---------------------------------------------------------------------------

/** Generate ticks for a continuous scale (linear, time, log). */
function continuousTicks(resolvedScale: ResolvedScale, density: AxisLabelDensity): AxisTick[] {
  const scale = resolvedScale.scale as D3ContinuousScale;
  const count = resolvedScale.channel.axis?.tickCount ?? TICK_COUNTS[density];
  const ticks: unknown[] = scale.ticks(count);

  return ticks.map((value: unknown) => ({
    value,
    position: scale(value as number & Date) as number,
    label: formatTickLabel(value, resolvedScale),
  }));
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

  return selectedValues.map((value: string) => {
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
}

/** Format a tick value based on the scale type. */
function formatTickLabel(value: unknown, resolvedScale: ResolvedScale): string {
  const formatStr = resolvedScale.channel.axis?.format;

  if (resolvedScale.type === 'time') {
    if (formatStr) return String(value); // Custom format not implemented yet
    return formatDate(value as Date);
  }

  if (resolvedScale.type === 'linear' || resolvedScale.type === 'log') {
    const num = value as number;
    if (formatStr) return formatNumber(num);
    // Abbreviate large numbers for axis labels
    if (Math.abs(num) >= 1000) return abbreviateNumber(num);
    return formatNumber(num);
  }

  return String(value);
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
 */
export function computeAxes(
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
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

  if (scales.x) {
    const ticks =
      scales.x.type === 'band' || scales.x.type === 'point' || scales.x.type === 'ordinal'
        ? categoricalTicks(scales.x, xDensity)
        : continuousTicks(scales.x, xDensity);

    const gridlines: Gridline[] = ticks.map((t) => ({
      position: t.position,
      major: true,
    }));

    result.x = {
      ticks,
      gridlines: scales.x.channel.axis?.grid ? gridlines : [],
      label: scales.x.channel.axis?.label,
      labelStyle: axisLabelStyle,
      tickLabelStyle,
      tickAngle: scales.x.channel.axis?.tickAngle,
      start: { x: chartArea.x, y: chartArea.y + chartArea.height },
      end: { x: chartArea.x + chartArea.width, y: chartArea.y + chartArea.height },
    };
  }

  if (scales.y) {
    const ticks =
      scales.y.type === 'band' || scales.y.type === 'point' || scales.y.type === 'ordinal'
        ? categoricalTicks(scales.y, yDensity)
        : continuousTicks(scales.y, yDensity);

    const gridlines: Gridline[] = ticks.map((t) => ({
      position: t.position,
      major: true,
    }));

    result.y = {
      ticks,
      // Y-axis gridlines are shown by default (standard editorial practice)
      gridlines,
      label: scales.y.channel.axis?.label,
      labelStyle: axisLabelStyle,
      tickLabelStyle,
      tickAngle: scales.y.channel.axis?.tickAngle,
      start: { x: chartArea.x, y: chartArea.y },
      end: { x: chartArea.x, y: chartArea.y + chartArea.height },
    };
  }

  return result;
}
