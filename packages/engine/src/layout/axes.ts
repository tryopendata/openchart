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
  DataRow,
  Encoding,
  Gridline,
  LayoutStrategy,
  MeasureTextFn,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import { measureLabel, thinTicksUntilFit, ticksOverlap } from './axes/thinning';
import {
  buildContinuousTicks,
  categoricalTicks,
  continuousTicks,
  resolveExplicitTicks,
  scaleSupportsTickCount,
  targetTickCount,
} from './axes/ticks';
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
 *
 * These thresholds apply to the chart area height (after chrome/margins),
 * not the total container height. A 400px container with title+subtitle
 * leaves ~270px of chart area; a 320px container leaves ~186px. The old
 * HEIGHT_REDUCED_THRESHOLD of 200 kicked in on nearly every common chart
 * size, producing only 3 ticks. Lowering to 100 keeps 'full' density for
 * all but the most compact thumbnail-style containers.
 */
const HEIGHT_MINIMAL_THRESHOLD = 80;
const HEIGHT_REDUCED_THRESHOLD = 100;

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

/**
 * Floor tick count for continuous axes when the axis is long enough to show
 * more than a min/max pair. Keeps the editorial ~5 target when possible.
 * Very short axes bypass this floor and can legitimately fall to 2.
 */
const CONTINUOUS_TICK_FLOOR = 4;

/**
 * How much D3 is allowed to overshoot what we asked for before we treat the
 * output as "too dense" and step down. D3's `scale.ticks(n)` only produces
 * nice step sizes (1, 2, 5 × 10^k, or calendar units for time), so a request
 * for n=6 can come back with 12 quarterly dates or 10 step-5 values. Accepting
 * up to 1.5× target catches the obvious overshoots without trimming acceptable
 * ones.
 *
 * The reference point stays fixed to the initial requested count even as we
 * iterate downward — we're measuring "did this candidate land near the target
 * the caller actually wanted?", not "is the candidate near what we just asked
 * for on this iteration?". If a candidate at n=3 returns 8 ticks, it's still
 * a 1.3× overshoot of the target-6, which is fine.
 */
const OVERSHOOT_TOLERANCE = 1.5;

/**
 * Fit continuous ticks by re-requesting progressively fewer ticks from the
 * scale. D3's `scale.ticks(n)` always returns evenly-spaced round values, so
 * stepping `n` down keeps spacing uniform — unlike middle-pruning which can
 * strand the last tick next to an endpoint and cascade to 2 ticks.
 *
 * Two conditions trigger a step-down:
 *   1. The label heuristic detects overlap at the initial count.
 *   2. D3 overshot the requested count by more than OVERSHOOT_TOLERANCE.
 *      (Time scales jump between calendar units; linear scales jump between
 *      nice step sizes. Either can return 2× what we asked for.)
 *
 * Falls back to overlap-safe thinning on the best-so-far candidate if no
 * count produces a clean fit. The fallback starts from the smallest candidate
 * that still meets the floor, so `thinTicksUntilFit` never receives the
 * overshot initial set (which was the bug this function exists to avoid).
 */
function fitContinuousTicks(
  scale: ResolvedScales['x' | 'y'],
  initialTicks: AxisTick[],
  initialCount: number,
  fontSize: number,
  fontWeight: number,
  axisLength: number,
  orientation: 'horizontal' | 'vertical',
  measureText?: MeasureTextFn,
): AxisTick[] {
  if (!scale || !scaleSupportsTickCount(scale)) return initialTicks;

  const tolerance = initialCount * OVERSHOOT_TOLERANCE;
  const overshoots = initialTicks.length > tolerance;
  const overlaps = ticksOverlap(initialTicks, fontSize, fontWeight, measureText, orientation);
  if (!overshoots && !overlaps) return initialTicks;

  // Enforce the floor only when the axis is long enough to fit that many
  // labels without overlap. Very short axes can fall below.
  const minThreshold =
    orientation === 'vertical' ? HEIGHT_MINIMAL_THRESHOLD : WIDTH_MINIMAL_THRESHOLD;
  const floor = axisLength >= minThreshold ? CONTINUOUS_TICK_FLOOR : 2;

  // Track the smallest candidate that meets the floor. If no candidate fits
  // cleanly, we thin this instead of the overshot `initialTicks` so the
  // fallback doesn't reintroduce the cascading-to-2-ticks bug.
  let bestWithinFloor: AxisTick[] | undefined;
  for (let n = initialCount - 1; n >= 2; n--) {
    const candidate = buildContinuousTicks(scale, n);
    const candidateOvershoots = candidate.length > tolerance;
    const candidateOverlaps = ticksOverlap(
      candidate,
      fontSize,
      fontWeight,
      measureText,
      orientation,
    );
    if (!candidateOvershoots && !candidateOverlaps) {
      return candidate;
    }
    if (candidate.length >= floor) bestWithinFloor = candidate;
  }

  // No candidate fit cleanly. Thin whatever most recently met the floor; if
  // nothing did, synthesize a floor-count set directly from the scale so we
  // never hand the overshot initialTicks to the middle-pruning thinner.
  const fallback = bestWithinFloor ?? buildContinuousTicks(scale, floor);
  return thinTicksUntilFit(fallback, fontSize, fontWeight, measureText, orientation);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Output of computeAxes. */
export interface AxesResult {
  x?: AxisLayout;
  y?: AxisLayout;
}

/** Optional data context for axis computation (enables labelField subtitles). */
export interface AxesDataContext {
  /** The data rows for subtitle lookup. */
  data: DataRow[];
  /** The encoding object to resolve field names. */
  encoding: Encoding;
  /**
   * When true, skip generating ticks/labels/title for the x-axis. Used by
   * sparkline display mode when the user hasn't explicitly opted into axes.
   */
  skipX?: boolean;
  /** Same as skipX, for the y-axis. */
  skipY?: boolean;
  /**
   * The chart's primary mark type. Used to default tickPosition: line and area
   * y-axes default to `'inline'` (labels above gridlines, no gutter); other
   * marks default to `'gutter'`.
   */
  markType?: import('@opendata-ai/openchart-core').MarkType;
}

/**
 * Compute axis layouts with tick positions, labels, and axis lines.
 *
 * @param scales - Resolved scales from computeScales.
 * @param chartArea - The chart drawing area.
 * @param strategy - Responsive layout strategy.
 * @param theme - Resolved theme for styling.
 * @param measureText - Optional real text measurement from the adapter.
 * @param dataContext - Optional data context for labelField subtitle support.
 */
export function computeAxes(
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
  dataContext?: AxesDataContext,
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

  if (scales.x && !dataContext?.skipX && scales.x.channel.axis !== false) {
    const axisConfig = scales.x.channel.axis;
    const isContinuousX =
      scales.x.type !== 'band' && scales.x.type !== 'point' && scales.x.type !== 'ordinal';

    const xTargetCount = isContinuousX
      ? targetTickCount(chartArea.width, xDensity, 'x')
      : undefined;

    // Use explicit tick values from axis config if provided
    let allTicks: AxisTick[];
    if (axisConfig?.values) {
      allTicks = resolveExplicitTicks(axisConfig.values, scales.x);
    } else if (!isContinuousX) {
      const xBandwidth =
        scales.x.type === 'band' ? (scales.x.scale as ScaleBand<string>).bandwidth() : undefined;
      allTicks = categoricalTicks(
        scales.x,
        xDensity,
        'horizontal',
        xBandwidth,
        axisConfig?.labelAngle,
        fontSize,
        fontWeight,
        measureText,
      );
    } else {
      allTicks = continuousTicks(scales.x, xDensity, xTargetCount);
    }

    // Gridlines use the full tick set so they remain visible even when labels
    // are thinned to prevent overlap.
    const gridlines: Gridline[] = allTicks.map((t) => ({
      position: t.position,
      major: true,
    }));

    // Thin tick labels to prevent overlap (skip for band scales which use
    // auto-rotation, and when the user set explicit tick values).
    // When tickCount is set, we still thin if D3 overshot the requested count
    // (common with log scales where ticks(4) can return 26 values).
    const hasExplicitValues = !!axisConfig?.values;
    const shouldThin = scales.x.type !== 'band' && !hasExplicitValues;
    let ticks: AxisTick[];
    if (!shouldThin) {
      ticks = allTicks;
    } else if (isContinuousX) {
      // Continuous x-axis: re-request ticks at a lower count on overlap so
      // time-scale quartile/monthly jumps don't leave a too-dense axis.
      ticks = fitContinuousTicks(
        scales.x,
        allTicks,
        xTargetCount ?? allTicks.length,
        fontSize,
        fontWeight,
        chartArea.width,
        'horizontal',
        measureText,
      );
    } else {
      ticks = thinTicksUntilFit(allTicks, fontSize, fontWeight, measureText);
    }

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
    const xLabelColor = axisConfig?.labelColor;
    // X-axis defaults to gutter (no inline mode is sensible for the x axis
    // because tick labels need horizontal room around their x position).
    const xTickPosition = axisConfig?.tickPosition ?? 'gutter';

    result.x = {
      ticks,
      gridlines: axisConfig?.grid ? gridlines : [],
      label: axisTitle,
      labelStyle: xLabelColor ? { ...axisLabelStyle, fill: xLabelColor } : axisLabelStyle,
      tickLabelStyle: xLabelColor ? { ...tickLabelStyle, fill: xLabelColor } : tickLabelStyle,
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
      tickPosition: xTickPosition,
    };
  }

  if (scales.y && !dataContext?.skipY && scales.y.channel.axis !== false) {
    const axisConfig = scales.y.channel.axis;
    const isContinuousY =
      scales.y.type !== 'band' && scales.y.type !== 'point' && scales.y.type !== 'ordinal';

    // Target count from pixels-per-tick when we have a continuous y-axis.
    const yTargetCount = isContinuousY
      ? targetTickCount(chartArea.height, yDensity, 'y')
      : undefined;

    // Use explicit tick values from axis config if provided
    let allTicks: AxisTick[];
    if (axisConfig?.values) {
      allTicks = resolveExplicitTicks(axisConfig.values, scales.y);
    } else if (!isContinuousY) {
      const yFieldName = dataContext?.encoding.y?.field;
      const yLabelField = axisConfig?.labelField;
      allTicks = categoricalTicks(
        scales.y,
        yDensity,
        'vertical',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        yFieldName && yLabelField && dataContext
          ? { data: dataContext.data, fieldName: yFieldName, labelField: yLabelField }
          : undefined,
      );
    } else {
      allTicks = continuousTicks(scales.y, yDensity, yTargetCount);
    }

    // Thin tick labels to prevent overlap (skip for band scales and explicit tick values).
    // When tickCount is set, we still thin if D3 overshot the requested count
    // (common with log scales where ticks(4) can return 26 values).
    const shouldThinY = scales.y.type !== 'band' && !axisConfig?.values;
    let ticks: AxisTick[];
    if (!shouldThinY) {
      ticks = allTicks;
    } else if (isContinuousY) {
      // Continuous y-axis: re-request ticks at a lower count on overlap so
      // spacing stays uniform and we don't collapse to min/max.
      ticks = fitContinuousTicks(
        scales.y,
        allTicks,
        yTargetCount ?? allTicks.length,
        fontSize,
        fontWeight,
        chartArea.height,
        'vertical',
        measureText,
      );
    } else {
      ticks = thinTicksUntilFit(allTicks, fontSize, fontWeight, measureText, 'vertical');
    }

    // Gridlines match the tick set so every gridline has a label.
    const gridlines: Gridline[] = ticks.map((t) => ({
      position: t.position,
      major: true,
    }));

    const axisTitle = axisConfig?.title;
    const tickAngle = axisConfig?.labelAngle;
    const yLabelColor = axisConfig?.labelColor;
    // Editorial line/area y-axes default to inline tick labels above their
    // gridlines. Other mark types keep the classic gutter placement. Right-side
    // y-axes (dual-axis) always use gutter.
    const isContinuousYAxis =
      scales.y.type !== 'band' && scales.y.type !== 'point' && scales.y.type !== 'ordinal';
    const isLineOrArea = dataContext?.markType === 'line' || dataContext?.markType === 'area';
    const yTickPosition: 'inline' | 'gutter' =
      axisConfig?.tickPosition ??
      (isLineOrArea && isContinuousYAxis && axisConfig?.orient !== 'right' ? 'inline' : 'gutter');

    // Inline mode hides the axis line and tick marks by default; the gridlines
    // themselves serve as the visual axis. Explicit user overrides win.
    const yDomainLine = axisConfig?.domain ?? (yTickPosition === 'inline' ? false : undefined);
    const yTickMarks = axisConfig?.ticks ?? (yTickPosition === 'inline' ? false : undefined);

    result.y = {
      ticks,
      // Y-axis gridlines are shown by default (standard editorial practice)
      gridlines,
      label: axisTitle,
      labelStyle: yLabelColor ? { ...axisLabelStyle, fill: yLabelColor } : axisLabelStyle,
      tickLabelStyle: yLabelColor ? { ...tickLabelStyle, fill: yLabelColor } : tickLabelStyle,
      tickAngle,
      start: { x: chartArea.x, y: chartArea.y },
      end: { x: chartArea.x, y: chartArea.y + chartArea.height },
      orient: axisConfig?.orient,
      domainLine: yDomainLine,
      tickMarks: yTickMarks,
      offset: axisConfig?.offset,
      titlePadding: axisConfig?.titlePadding,
      labelPadding: axisConfig?.labelPadding,
      labelOverlap: axisConfig?.labelOverlap,
      labelFlush: axisConfig?.labelFlush,
      tickPosition: yTickPosition,
    };
  }

  return result;
}
