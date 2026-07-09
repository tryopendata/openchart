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
import {
  axisTitleOffset,
  computeXAxisExtentFromLabels,
  estimateTextWidth,
  getAxisTitleOffset,
  X_AXIS_TITLE_BAND_ROTATED,
} from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import { resolveBandTickAngle } from './axes/rotation';
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

/** Scale types that render as a categorical (non-continuous) y-axis. */
const CATEGORICAL_SCALE_TYPES = new Set(['band', 'point', 'ordinal']);

/**
 * Whether the y-axis renders tick labels inline (above their gridline inside
 * the plot) rather than in a left gutter.
 *
 * This is the single source of truth shared by margin reservation (plan.ts,
 * dimensions.ts) and the renderer's title placement. All three must agree or
 * the reserved left margin won't match where the title is drawn.
 *
 * Editorial line/area charts with a continuous y-axis default to inline ticks.
 * Continuity is decided by the RESOLVED scale type, not the field type: an
 * explicit `scale.type` override (e.g. a band scale forced onto a quantitative
 * field) wins, mirroring buildPositionalScale() in scales.ts. Right-side
 * (dual-axis) y-axes always use the gutter. An explicit axis.tickPosition wins
 * over the default.
 */
export function yTickPositionIsInline(
  yChannel:
    | {
        type?: string;
        scale?: { type?: string };
        axis?: unknown;
      }
    | undefined,
  markType: string,
  /**
   * Resolved continuity of the y-scale, when the caller already has the built
   * scale (computeAxes). When omitted, continuity is inferred from the encoding
   * (explicit scale.type override, else field type) so the reservation paths
   * predict the same answer computeAxes will produce.
   */
  resolvedContinuous?: boolean,
): boolean {
  if (!yChannel) return false;
  const axisCfg = (yChannel.axis as Record<string, unknown> | undefined) ?? undefined;
  const explicit = axisCfg?.tickPosition as 'inline' | 'gutter' | undefined;
  if (explicit) return explicit === 'inline';

  const isLineOrArea = markType === 'line' || markType === 'area';
  if (!isLineOrArea) return false;
  if ((axisCfg?.orient as string | undefined) === 'right') return false;

  if (resolvedContinuous !== undefined) return resolvedContinuous;

  // Predict the resolved scale type: explicit override wins, else field type.
  const explicitScaleType = yChannel.scale?.type;
  return explicitScaleType
    ? !CATEGORICAL_SCALE_TYPES.has(explicitScaleType)
    : yChannel.type === 'quantitative' || yChannel.type === 'temporal';
}

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

/** Marks grounded on the x baseline that warrant a domain line. */
const GROUNDED_MARKS = new Set(['bar', 'tick', 'lollipop']);

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
 * Quantitative axes must always render at least this many tick labels. A lone
 * tick reads as a broken axis (a real iPhone blog chart degenerated to a
 * single "80" when D3's `scale.ticks(2)` collapsed a tight domain like
 * [73, 88] to one nice value). This floor holds at every width.
 */
const MIN_QUANTITATIVE_TICKS = 2;

/**
 * Ensure a continuous scale yields at least MIN_QUANTITATIVE_TICKS ticks.
 *
 * D3's `scale.ticks(n)` picks nice step sizes, so a tight domain can collapse
 * to a single value at low counts (`[73, 88].ticks(2)` → `[80]`). When that
 * happens, request progressively higher counts until at least two ticks
 * appear. Prefers the smallest count that clears the floor, which keeps the
 * ticks spread toward the domain endpoints rather than clustered.
 */
function ensureMinContinuousTicks(
  scale: ResolvedScales['x' | 'y'],
  ticks: AxisTick[],
  requestedCount: number,
): AxisTick[] {
  if (ticks.length >= MIN_QUANTITATIVE_TICKS) return ticks;
  if (!scale || !scaleSupportsTickCount(scale)) return ticks;

  let best = ticks;
  for (let n = Math.max(requestedCount, MIN_QUANTITATIVE_TICKS) + 1; n <= 10; n++) {
    const candidate = buildContinuousTicks(scale, n);
    if (candidate.length >= MIN_QUANTITATIVE_TICKS) return candidate;
    if (candidate.length > best.length) best = candidate;
  }
  return best;
}

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

  // Floor the initial set: a tight domain can make D3 return a single nice
  // value, which would otherwise pass straight through (no overlap, no
  // overshoot) and render as a lone tick.
  const flooredTicks = ensureMinContinuousTicks(scale, initialTicks, initialCount);

  const tolerance = initialCount * OVERSHOOT_TOLERANCE;
  const overshoots = flooredTicks.length > tolerance;
  const overlaps = ticksOverlap(flooredTicks, fontSize, fontWeight, measureText, orientation);
  if (!overshoots && !overlaps) return flooredTicks;

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
  const rawFallback = bestWithinFloor ?? buildContinuousTicks(scale, floor);
  const fallback = ensureMinContinuousTicks(scale, rawFallback, floor);
  return thinTicksUntilFit(fallback, fontSize, fontWeight, measureText, orientation);
}

/**
 * Horizontal footprint `[left, right]` of a rotated band tick label, in axis
 * pixels. Rotated labels are anchored at the tick position (the rotation
 * pivot), not centered on it: at a negative angle the renderer right-anchors
 * the text so it extends left of the pivot; at a positive angle it left-anchors
 * so it extends right. The horizontal projection is `width * cos(angle)`.
 *
 * Modeling the footprint as centered (the old behavior) over-estimates each
 * label's reach by half its width in the wrong direction, which made a single
 * wide label (e.g. "2026 (to wk 17)") report overlaps against neighbors that
 * actually clear it — triggering needless thinning of the whole axis.
 */
function labelSpanAtAngle(
  tick: AxisTick,
  angleDeg: number,
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): { left: number; right: number } {
  const angleRad = (Math.abs(angleDeg) * Math.PI) / 180;
  const cosA = angleRad > 0 ? Math.abs(Math.cos(angleRad)) : 1;
  const projected = measureLabel(tick.label, fontSize, fontWeight, measureText) * cosA;
  if (angleDeg === 0) {
    // Horizontal labels are centered on the tick.
    return { left: tick.position - projected / 2, right: tick.position + projected / 2 };
  }
  if (angleDeg < 0) {
    // Right-anchored: pivot is the right edge, text extends left.
    return { left: tick.position - projected, right: tick.position };
  }
  // Left-anchored: pivot is the left edge, text extends right.
  return { left: tick.position, right: tick.position + projected };
}

/**
 * Thin band-scale tick labels only where they actually collide at their
 * effective angle, greedily keeping every label that clears the last one
 * retained. This preserves narrow labels that have room even when a single
 * wide label elsewhere on the axis forces some thinning near it, instead of
 * decimating the whole axis every-other. First and last labels are always
 * kept. Most grouped bar charts keep every label even at -45°.
 */
function thinBandTicksIfNeeded(
  ticks: AxisTick[],
  angleDeg: number,
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): AxisTick[] {
  if (ticks.length < 3) return ticks;
  const minGap = fontSize * 0.5;

  const spans = ticks.map((t) => labelSpanAtAngle(t, angleDeg, fontSize, fontWeight, measureText));

  // Greedy left-to-right retention: keep a label only if its footprint clears
  // the last kept label's right edge by minGap. Always keep the first label.
  const keep = new Array<boolean>(ticks.length).fill(false);
  keep[0] = true;
  let lastRight = spans[0].right;
  for (let i = 1; i < ticks.length; i++) {
    if (spans[i].left >= lastRight + minGap) {
      keep[i] = true;
      lastRight = spans[i].right;
    }
  }

  // Always keep the last label. If keeping it collides with previously kept
  // labels, drop each colliding neighbor so the endpoint stays labeled. A very
  // wide final label (long category name) projects across several bands at an
  // angle, so clear every kept label its footprint overlaps, not just the
  // nearest one — otherwise an earlier kept label still overlaps the endpoint.
  //
  // Use true pixel overlap here (no minGap comfort buffer) so a neighbor that
  // merely falls a few pixels short of the comfort gap — but does not actually
  // touch the endpoint label — is kept rather than sacrificed. Dropping a
  // readable short label to seat a near-miss wide endpoint reads as arbitrary
  // (e.g. losing "2025" beside "2026 (to wk 17)" that clears it by 2px).
  const lastIdx = ticks.length - 1;
  if (!keep[lastIdx]) {
    keep[lastIdx] = true;
    for (let i = lastIdx - 1; i > 0; i--) {
      if (!keep[i]) continue;
      if (spans[i].right > spans[lastIdx].left) {
        keep[i] = false;
        continue;
      }
      break;
    }
  }

  return ticks.filter((_, i) => keep[i]);
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
  /** Total container width for axis title offset threshold checks. */
  totalWidth?: number;
  /**
   * Pinned y-axis tick values from the layout plan. When provided, the y-axis
   * uses these values (via resolveExplicitTicks) instead of generating fresh
   * ticks, so the labels match exactly what the gutter was measured for.
   * User-specified `axis.values` still takes priority.
   */
  precomputedYTicks?: unknown[];
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
      // For band scales, generate all ticks first (no thinning). Rotation and
      // thinning are resolved below once we know the effective label angle.
      allTicks = categoricalTicks(scales.x, xDensity, 'horizontal');
    } else {
      allTicks = continuousTicks(scales.x, xDensity, xTargetCount);
    }

    // Gridlines use the full tick set so they remain visible even when labels
    // are thinned to prevent overlap.
    const gridlines: Gridline[] = allTicks.map((t) => ({
      position: t.position,
      major: true,
    }));

    // Determine rotation before thinning so we know the effective label
    // footprint. Band scales auto-rotate when horizontal labels don't fit.
    let tickAngle = axisConfig?.labelAngle;
    if (tickAngle === undefined && scales.x.type === 'band' && allTicks.length > 1) {
      const bandwidth = (scales.x.scale as ScaleBand<string>).bandwidth();
      let maxLabelWidth = 0;
      for (const t of allTicks) {
        const w = measureLabel(t.label, fontSize, fontWeight, measureText);
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
      tickAngle = resolveBandTickAngle(undefined, maxLabelWidth, bandwidth, allTicks.length);
    }

    // Thin tick labels to prevent overlap (skip for explicit tick values).
    const hasExplicitValues = !!axisConfig?.values;
    let ticks: AxisTick[];
    if (hasExplicitValues) {
      ticks = allTicks;
    } else if (scales.x.type === 'band') {
      // Band scales: thin only when labels actually overlap at their
      // effective angle. After rotation, most charts have room for every label.
      const effectiveAngle = tickAngle ?? 0;
      ticks = thinBandTicksIfNeeded(allTicks, effectiveAngle, fontSize, fontWeight, measureText);
    } else if (isContinuousX) {
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

    const axisTitle = axisConfig?.title;
    const xLabelColor = axisConfig?.labelColor;
    // X-axis defaults to gutter (no inline mode is sensible for the x axis
    // because tick labels need horizontal room around their x position).
    const xTickPosition = axisConfig?.tickPosition ?? 'gutter';

    const xDomainLine =
      axisConfig?.domain ?? (GROUNDED_MARKS.has(dataContext?.markType ?? '') ? undefined : false);

    result.x = {
      ticks,
      gridlines: (axisConfig?.grid ?? dataContext?.markType === 'point') ? gridlines : [],
      label: axisTitle,
      labelStyle: xLabelColor ? { ...axisLabelStyle, fill: xLabelColor } : axisLabelStyle,
      tickLabelStyle: xLabelColor ? { ...tickLabelStyle, fill: xLabelColor } : tickLabelStyle,
      tickAngle,
      start: { x: chartArea.x, y: chartArea.y + chartArea.height },
      end: { x: chartArea.x + chartArea.width, y: chartArea.y + chartArea.height },
      orient: axisConfig?.orient,
      domainLine: xDomainLine,
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
    } else if (
      dataContext?.precomputedYTicks &&
      dataContext.precomputedYTicks.length > 0 &&
      isContinuousY
    ) {
      // Pinned ticks from the layout plan -- use the same resolution path as
      // explicit user values so the labels match exactly what the gutter was
      // measured for.
      allTicks = resolveExplicitTicks(dataContext.precomputedYTicks, scales.y);
    } else if (!isContinuousY) {
      const yFieldName = dataContext?.encoding.y?.field;
      const yLabelField = axisConfig?.labelField;
      allTicks = categoricalTicks(
        scales.y,
        yDensity,
        'vertical',
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
    const shouldThinY =
      scales.y.type !== 'band' && !axisConfig?.values && !dataContext?.precomputedYTicks?.length;
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
    // y-axes (dual-axis) always use gutter. Uses the shared predicate so the
    // margin-reservation paths (plan.ts, dimensions.ts) agree with this; here
    // we pass the RESOLVED scale continuity since the scale is already built.
    const isContinuousYAxis =
      scales.y.type !== 'band' && scales.y.type !== 'point' && scales.y.type !== 'ordinal';
    const yTickPosition: 'inline' | 'gutter' = yTickPositionIsInline(
      dataContext?.encoding.y,
      dataContext?.markType ?? '',
      isContinuousYAxis,
    )
      ? 'inline'
      : 'gutter';

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

  const totalWidth = dataContext?.totalWidth ?? chartArea.x + chartArea.width;

  if (result.x) {
    const isRotated = !!result.x.tickAngle && Math.abs(result.x.tickAngle) > 10;

    // Single source of truth for the x-axis vertical extent (rotated or flat).
    // computeXAxisExtentFromLabels applies the correct rotated-extent math
    // (textWidth*|sin θ| + lineHeight*|cos θ|), so the reserved bottom margin
    // matches what the labels actually occupy.
    result.x.extent = computeXAxisExtentFromLabels({
      labels: result.x.ticks.map((t) => t.label),
      tickAngle: result.x.tickAngle,
      hasTitle: !!result.x.label,
      tickFontSize: result.x.tickLabelStyle.fontSize,
      tickFontWeight: result.x.tickLabelStyle.fontWeight,
      xAxisHeight: theme.spacing.xAxisHeight,
      measure: (t, fs, fw) => measureLabel(t, fs, fw, measureText),
    });

    if (result.x.label) {
      // Rotated: place the title just below the tick band (extent already
      // includes the rotated label height and the title band). Flat: fixed 35px.
      const rotatedBand = isRotated ? result.x.extent - X_AXIS_TITLE_BAND_ROTATED + 14 : 35;
      result.x.titlePosition = {
        x: chartArea.x + chartArea.width / 2,
        y: chartArea.y + chartArea.height + rotatedBand,
      };
    }
  }

  if (result.y?.label && result.y.labelStyle) {
    const isRight = result.y.orient === 'right';
    if (isRight) {
      const titleOff = getAxisTitleOffset(totalWidth);
      result.y.titlePosition = {
        x: chartArea.x + chartArea.width + titleOff,
        y: chartArea.y + chartArea.height / 2,
        angle: 90,
      };
    } else {
      const maxTickLabelWidth = result.y.ticks.reduce((max, t) => {
        const w = estimateTextWidth(
          t.label,
          result.y!.tickLabelStyle.fontSize,
          result.y!.tickLabelStyle.fontWeight ?? 400,
        );
        return Math.max(max, w);
      }, 0);
      // Inline y-ticks live inside the plot (no left gutter), so the title
      // clears only the chart edge — pass the inline flag so the offset drops
      // the tick-label width and the viewport floor. Omitting it reserved a
      // gutter-sized offset that pushed the rotated title off the left edge of
      // the container on narrow/large-font charts.
      const titleOff = axisTitleOffset(
        maxTickLabelWidth,
        result.y.labelStyle.fontSize,
        totalWidth,
        result.y.tickPosition === 'inline',
      );
      result.y.titlePosition = {
        x: chartArea.x - titleOff,
        y: chartArea.y + chartArea.height / 2,
        angle: -90,
      };
    }
  }

  return result;
}
