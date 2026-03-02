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
} from '@opendata-ai/core';
import { abbreviateNumber, formatDate, formatNumber } from '@opendata-ai/core';
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
  const maxTicks = TICK_COUNTS[density];

  // Band scales (bar charts) should always show all category labels.
  // Only thin point/ordinal scales used for continuous-like axes (e.g. line charts).
  let selectedValues = domain;
  if (resolvedScale.type !== 'band' && domain.length > maxTicks) {
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
  const density = strategy.axisLabelDensity;

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
        ? categoricalTicks(scales.x, density)
        : continuousTicks(scales.x, density);

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
      start: { x: chartArea.x, y: chartArea.y + chartArea.height },
      end: { x: chartArea.x + chartArea.width, y: chartArea.y + chartArea.height },
    };
  }

  if (scales.y) {
    const ticks =
      scales.y.type === 'band' || scales.y.type === 'point' || scales.y.type === 'ordinal'
        ? categoricalTicks(scales.y, density)
        : continuousTicks(scales.y, density);

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
      start: { x: chartArea.x, y: chartArea.y },
      end: { x: chartArea.x, y: chartArea.y + chartArea.height },
    };
  }

  return result;
}
