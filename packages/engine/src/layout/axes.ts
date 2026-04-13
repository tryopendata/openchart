/**
 * Axis computation: tick positions, labels, and axis lines.
 *
 * Generates ticks manually (no d3-axis) so we have full control over
 * responsive tick density and formatting. Tick generation and label
 * thinning live in sibling modules under ./axes/.
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
import type { ScaleBand } from 'd3-scale';
import { measureLabel, thinTicksUntilFit } from './axes/thinning';
import { categoricalTicks, continuousTicks, resolveExplicitTicks } from './axes/ticks';
import type { ResolvedScales } from './scales';

// Re-export pure helpers so external consumers (and tests) continue to import
// them from './layout/axes'.
export { thinTicksUntilFit, ticksOverlap } from './axes/thinning';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
    let tickAngle = axisConfig?.labelAngle;
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

    const axisTitle = axisConfig?.title;

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

    // Thin tick labels to prevent overlap (skip for band scales, explicit tickCount, and values).
    const shouldThin = scales.y.type !== 'band' && !axisConfig?.tickCount && !axisConfig?.values;
    const ticks = shouldThin
      ? thinTicksUntilFit(allTicks, fontSize, fontWeight, measureText, 'vertical')
      : allTicks;

    // Gridlines match the tick set so every gridline has a label.
    const gridlines: Gridline[] = ticks.map((t) => ({
      position: t.position,
      major: true,
    }));

    const axisTitle = axisConfig?.title;
    const tickAngle = axisConfig?.labelAngle;

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
