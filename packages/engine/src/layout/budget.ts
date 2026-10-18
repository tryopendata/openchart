/**
 * Figure budget: every reserve the layout makes for authored content.
 *
 * Reserves derive from authored text, the container width and the theme, all
 * known before placement. They are measured once per compile here and read by
 * dimensions, placement and assembly, so no reserve is ever discovered after
 * placement and fed back through a second compile.
 */

import type {
  DesignDiagnostic,
  EndpointLabelEntry,
  LayoutStrategy,
  LegendLayout,
  Margins,
  MeasureTextFn,
  Rect,
  ResolvedChrome,
  ResolvedMetricBar,
  ResolvedSeriesSearch,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { computeChrome, computeNoteBandHeight, wrapText } from '@opendata-ai/openchart-core';
import { annotationNoteCapacity } from '../annotations/notes';
import {
  admitReferenceRows,
  NO_REFERENCE_RESERVE,
  type ReferenceReserve,
  referenceLabelReserve,
} from '../annotations/reference-layout';
import type { InternalCompileOptions } from '../compile/internal-options';
import type { NormalizedChartSpec } from '../compiler/types';
import { hasLegendContent } from '../legend/compute';
import { legendGap } from '../legend/wrap';
import { type BudgetReserves, createFrame, type FramePlacement } from './frame';
import { createMeasureFn, type LayoutPlan } from './plan';
import { type ChromeLayoutMode, chromeToInput } from './shared';
import {
  annotationMeasureFn,
  headerBands,
  MIN_CHART_HEIGHT,
  outsideBudget,
  SERIES_SEARCH_INPUT_HEIGHT,
  stackTop,
  type VerticalBands,
} from './stack';

export type { BudgetReserves } from './frame';
export {
  annotationMeasureFn,
  type BudgetBand,
  outsideBudget,
  type ReferenceXResolver,
  referenceLaneFor,
  scaleAreaFor,
} from './stack';
export { NO_REFERENCE_RESERVE };

/** Height of the note band below the plot for the given note and series-summary lines. */
export function noteBandHeight(
  noteLines: number,
  summaryLines: number,
  theme: ResolvedTheme,
): number {
  return computeNoteBandHeight(noteLines + summaryLines, theme);
}

export interface AuthoredReserves {
  /** Note lines the authored text annotations can occupy, whichever demote. */
  noteLines: number;
  /** Series-summary lines (responsive.labelSummary), 0 when no summary shows. */
  summaryLines: number;
  /** Note band height covering noteLines + summaryLines. */
  noteBand: number;
  /** Outside reference-label lanes at the figure width. */
  reference: ReferenceReserve;
  /** Outside reference-label lanes for a narrower container (facet panels). */
  referenceAt: (width: number) => ReferenceReserve;
}

export interface AuthoredReserveOptions {
  /** Compact container with a compact annotation limit: a single note can demote. */
  compactNotes: boolean;
  /** Reserve outside reference lanes at the figure level (facets reserve per panel). */
  figureReferences?: boolean;
  /** Series-summary lines, measured by the caller from the summary text. */
  summaryLines?: number;
}

/**
 * Measure every authored reserve once. Note capacity covers every text
 * annotation (pinned or not) at its widest source ordinal, so a drag that pins
 * a label or changes the demoted set never moves the plot.
 */
export function measureAuthoredReserves(
  spec: NormalizedChartSpec,
  width: number,
  theme: ResolvedTheme,
  measureText: MeasureTextFn | undefined,
  opts: AuthoredReserveOptions,
): AuthoredReserves {
  const noteLines = spec.autoThin
    ? annotationNoteCapacity(spec.annotations, width, theme, measureText, opts.compactNotes)
    : 0;
  const summaryLines = opts.summaryLines ?? 0;
  const measure = annotationMeasureFn(measureText);
  const referenceAt = (containerWidth: number) =>
    referenceLabelReserve(spec.annotations, containerWidth, measure, theme.fonts.sizes.small);
  return {
    noteLines,
    summaryLines,
    noteBand: noteBandHeight(noteLines, summaryLines, theme),
    reference: opts.figureReferences === false ? NO_REFERENCE_RESERVE : referenceAt(width),
    referenceAt,
  };
}

export type SeriesSummaryEntry = NonNullable<ResolvedChrome['seriesSummary']>[number];

/**
 * Responsive series summary: one "series · value" note per endpoint entry,
 * wrapped to the figure width. Unspaced identifiers (URLs, codes) are broken
 * per character too, so no line overflows.
 */
export function buildSeriesSummary(
  entries: EndpointLabelEntry[],
  width: number,
  theme: ResolvedTheme,
  measureText: MeasureTextFn | undefined,
): SeriesSummaryEntry[] {
  const measure = createMeasureFn(measureText);
  const max = Math.max(1, width - 2 * theme.spacing.padding);
  return entries.map((entry) => ({
    key: entry.seriesKey,
    text: `${entry.seriesKey} · ${entry.value}`,
    lines: wrapText(
      `${entry.seriesKey} · ${entry.value}`,
      theme.fonts.sizes.small,
      500,
      max,
      measureText,
    ).flatMap((line) => {
      const chunks: string[] = [];
      let chunk = '';
      for (const character of line) {
        const candidate = chunk + character;
        if (chunk && measure(candidate, theme.fonts.sizes.small, 500) > max) {
          chunks.push(chunk);
          chunk = character;
        } else chunk = candidate;
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    }),
    color: entry.color,
  }));
}

export function seriesSummaryLineCount(summary: SeriesSummaryEntry[]): number {
  return summary.reduce((count, entry) => count + entry.lines.length, 0);
}

/**
 * The note list resolved after placement needs more lines than the reserve
 * measured up front. Only possible with a host measureText whose wrapping is
 * not monotone in the source ordinal. Outside the budget the figure grows;
 * a fixed budget reports it instead of moving the plot.
 */
export function noteOverflowDiagnostic(viewport: {
  width: number;
  height: number;
}): DesignDiagnostic {
  return {
    code: 'layout.note-capacity',
    path: '/annotations',
    origin: 'author',
    status: 'failed',
    severity: 'error',
    viewport,
    message: NOTE_OVERFLOW_MESSAGE,
  };
}

const NOTE_OVERFLOW_MESSAGE =
  'Annotation notes need more lines than the reserved note band. Increase the requested height, explicitly choose chromeLayout: "grow", or reduce annotation text/count.';

/** Tell the overflow variant of `layout.note-capacity` from the exhausted-plot one. */
export function isNoteOverflowDiagnostic(diagnostic: DesignDiagnostic): boolean {
  return diagnostic.code === 'layout.note-capacity' && diagnostic.message === NOTE_OVERFLOW_MESSAGE;
}

/**
 * Settle a note list that outgrew its up-front reserve without re-running the
 * compile: grow the figure when notes sit outside the budget, otherwise report
 * the fixed budget. Returns the height the figure grew by.
 */
export function resolveNoteOverflow(
  dims: { total: { x: number; y: number; width: number; height: number } },
  overflow: number,
  mode: ChromeLayoutMode,
  onDiagnostic: ((diagnostic: DesignDiagnostic) => void) | undefined,
): number {
  if (!(overflow > 0)) return 0;
  if (outsideBudget(mode, 'notes')) {
    dims.total = { ...dims.total, height: dims.total.height + overflow };
    return overflow;
  }
  onDiagnostic?.(noteOverflowDiagnostic({ width: dims.total.width, height: dims.total.height }));
  return 0;
}

// ---------------------------------------------------------------------------
// Figure budget: total, plot, margins, chrome and every reserved band
// ---------------------------------------------------------------------------

/**
 * What the budget gave up to keep the plot above its minimum size or a band
 * within its share. `reference-lane`: some vertical outside labels were not
 * admitted to the top lane (share cap or plot minimum) and place inside.
 */
export type BudgetDegradation = 'chrome-compact' | 'chrome-hidden' | 'reference-lane' | 'metrics';

/** Outside reference lanes as resolved by the budget. */
export interface ResolvedReferenceReserve extends ReferenceReserve {
  /** False when no top-lane row was admitted: vertical outside labels place inside. */
  topLane: boolean;
}

/** The complete figure budget for a chart. */
export interface FigureBudget {
  /** Total figure rect (grows past the authored height outside the budget). */
  total: Rect;
  /** Resolved chrome (title, subtitle, source, etc.). */
  chrome: ResolvedChrome;
  /** The chart drawing area (after subtracting chrome, legend, margins). */
  chartArea: Rect;
  /** Margins around the chart area. */
  margins: Margins;
  /** Resolved theme used for this layout. */
  theme: ResolvedTheme;
  /**
   * Resolved metric bar (KPI cells above the chart area). Present only when
   * spec.metrics is supplied AND the bar fits the container.
   */
  metrics?: ResolvedMetricBar;
  /**
   * Reserved series-search band (below chrome and the metric bar, above the
   * top legend). Present only when spec.seriesSearch is enabled.
   */
  seriesSearch?: ResolvedSeriesSearch;
  /**
   * Height reserved below the chart area for x-axis tick labels and the
   * (optional) axis title. Exposed so downstream layout code (e.g. the
   * second legend pass) can position elements below the axis row.
   */
  xAxisHeight: number;
  /**
   * The axis gap the margin stack placed between the top legend (or chrome,
   * when there is no top legend) and the chart area. With a top legend this
   * is the inline-tick overhang, and `placeLegend` must receive it as
   * `axisGapBelowLegend` so the legend sits above the reserved tick zone
   * instead of flush against `chartArea.y` (where inline y-tick labels draw).
   */
  effectiveAxisGap: number;
  /**
   * Padding above the top chrome block. Chrome text starts at this y, so
   * `topPad + chrome.topHeight` is the first y below the chrome block.
   */
  topPad: number;
  /**
   * True when the chrome-strip guardrail fired and chrome was reduced from what
   * the layout plan assumed. Signals that plan-precomputed y-ticks were sized
   * against the pre-strip (shorter) plot and must be regenerated against the
   * final chartArea.
   */
  chromeStripped?: boolean;
  /** Note band reserved below the plot. */
  noteBand: number;
  /** Outside reference lanes, with whether the top lane survived. */
  reference: ResolvedReferenceReserve;
  /** Steps the fallback ladder took, in order. */
  degraded: BudgetDegradation[];
}

/** Minimum chart area dimensions before guardrails kick in. */
const MIN_CHART_WIDTH = 60;

/** Chrome may not exceed this fraction of a fixed-height plot budget. */
const PLOT_SHARE_MAX = 0.4;

/**
 * Resolve per-side safety padding for sparkline mode. Stroke-based padding
 * applies to every side so a thick line doesn't clip at the container edge.
 * Endpoint-dot padding applies only to the side that actually carries a dot:
 * `point: 'last'` reserves space on the right, `'first'` on the left, and
 * `true | 'endpoints' | 'transparent'` on both. This keeps tiny sparklines
 * flush left when the endpoint dot only renders at the right edge.
 */
function getSparklinePad(spec: NormalizedChartSpec): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const strokeWidth = (spec.markDef as { strokeWidth?: number }).strokeWidth ?? 2;
  const point = (spec.markDef as { point?: unknown }).point;
  const strokePad = Math.max(strokeWidth / 2 + 1, 2);
  const dotPad = 4; // r=3.5 + 0.5 — matches the terminator dot size

  const dotRight =
    point === 'last' || point === true || point === 'endpoints' || point === 'transparent';
  const dotLeft =
    point === 'first' || point === true || point === 'endpoints' || point === 'transparent';
  const hasDots = dotRight || dotLeft;

  return {
    left: dotLeft ? Math.max(strokePad, dotPad) : strokePad,
    right: dotRight ? Math.max(strokePad, dotPad) : strokePad,
    top: hasDots ? Math.max(strokePad, dotPad) : strokePad,
    bottom: hasDots ? Math.max(strokePad, dotPad) : strokePad,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the figure budget: total size, chrome, margins and the plot, with
 * every authored reserve placed and the fallback ladder applied when the plot
 * would drop below its minimum.
 *
 * Annotation placement never feeds back into this: committing an explicit
 * anchor/offset must not move the data point underneath it.
 *
 * @param spec - Normalized chart spec.
 * @param options - Compile options (width, height, chromeLayout, measureText).
 * @param legendLayout - Pre-computed legend layout (used to reserve space).
 * @param theme - Already-resolved theme (resolved once in compileChart).
 * @param strategy - Responsive layout strategy (controls chrome mode).
 * @param reserves - Note band and reference lanes measured from authored text.
 */
export function resolveFigureBudget(
  spec: NormalizedChartSpec,
  options: InternalCompileOptions,
  legendLayout: LegendLayout,
  theme: ResolvedTheme,
  strategy: LayoutStrategy | undefined,
  watermark: boolean,
  plan: LayoutPlan,
  reserves: BudgetReserves = { noteBand: 0, reference: NO_REFERENCE_RESERVE },
): FigureBudget {
  const { width, height } = options;
  const { noteBand } = reserves;
  const userExplicit = spec.userExplicit;
  const frame = createFrame(
    { spec, options, theme, strategy, reserves },
    {
      legendContent: plan.legendContent,
      sizeLegendContent: plan.sizeLegendContent,
      leftGutter: plan.leftGutter,
      // x-axis tick labels and title extend past the chart area bottom; the plan
      // measured them, and source/footer chrome is positioned below them.
      xAxisExtent: plan.xAxisExtent,
      inlineYLabelInset: plan.inlineYLabelInset,
      endpointLabelsDemoted: plan.endpointLabelsDemoted,
    },
    plan.chrome,
  );
  const { padding, chromeMode, chromeLayout } = frame.spacing;

  // Pre-compute the bottom-legend reservation (legend height + gap) so the
  // chrome layout can stack source/byline/footer below the legend band.
  //
  // Invariant: bottom-legend space is owned by `chrome.bottomHeight`, not
  // `margins.bottom`. The legend reservation flows like this:
  //   bottomLegendReservation = legend.height + legendGap(width)
  //   chrome.bottomHeight     >= bottomLegendReservation  (via computeChrome)
  //   margins.bottom          = padding + chrome.bottomHeight + xAxisHeight
  // So the legend band is implicitly inside margins.bottom exactly once.
  const bottomLegendReservation =
    hasLegendContent(plan.legendContent) && plan.legendContent.position === 'bottom'
      ? plan.legendContent.height + legendGap(width)
      : 0;

  const chrome = { ...plan.chrome };
  const { effectiveHeight } = frame;
  if (outsideBudget(chromeLayout, 'notes')) chrome.grownHeight = effectiveHeight - height;
  const total: Rect = { x: 0, y: 0, width, height: effectiveHeight };
  const degraded: BudgetDegradation[] = [];

  // Sparkline mode: produce a near-edge-to-edge layout. Only stroke-width-based
  // safety padding plus chrome (if user-explicit). Skip axis space, label
  // reservations, annotation reservations, and legend reservations unless the
  // user opted in to those individually.
  if (spec.display === 'sparkline') {
    const sparkPad = getSparklinePad(spec);

    // Axis space only when user explicitly set encoding.x/y.axis.
    const xAxisSpace = userExplicit.xAxis ? 26 : 0;
    const yAxisSpace = userExplicit.yAxis ? 30 : 0;

    // Reserve legend space only when user explicitly opted into a legend.
    const legend = userExplicit.legend && hasLegendContent(plan.legendContent);
    const gap = legendGap(width);
    const bands: VerticalBands = {
      topPad: sparkPad.top,
      chromeTop: chrome.topHeight,
      metrics: 0,
      search: 0,
      topLegendBand:
        legend && legendLayout.position === 'top' ? legendLayout.bounds.height + gap : 0,
      axisGap: 0,
      bottom: chrome.bottomHeight + sparkPad.bottom + xAxisSpace + noteBand,
    };
    if (legend && legendLayout.position === 'bottom')
      bands.bottom += legendLayout.bounds.height + gap;
    const margins: Margins = {
      top: stackTop(bands, 0),
      right: sparkPad.right,
      bottom: bands.bottom,
      left: sparkPad.left + yAxisSpace,
    };
    if (legend && (legendLayout.position === 'right' || legendLayout.position === 'bottom-right'))
      margins.right += legendLayout.bounds.width + 8;

    const chartArea: Rect = {
      x: margins.left,
      y: margins.top,
      width: Math.max(0, width - margins.left - margins.right),
      height: Math.max(0, effectiveHeight - margins.top - margins.bottom),
    };

    return {
      total,
      chrome,
      chartArea,
      margins,
      theme,
      xAxisHeight: xAxisSpace,
      effectiveAxisGap: 0,
      topPad: padding,
      noteBand,
      reference: { ...frame.reference, top: 0, rows: [], topLane: false },
      degraded,
    };
  }

  const wantsSearch = headerBands(spec, chromeMode, height, theme).search > 0;

  const finish = (
    block: ResolvedChrome,
    placed: FramePlacement,
    chromeStripped: boolean,
  ): FigureBudget => {
    if (placed.fit.admitted < frame.lane.rows.length) degraded.push('reference-lane');
    if (placed.metricsDropped) degraded.push('metrics');
    return {
      total,
      chrome: block,
      chartArea: placed.chartArea,
      margins: placed.margins,
      theme,
      metrics: placed.metrics,
      seriesSearch: wantsSearch
        ? resolveSeriesSearch(
            spec,
            placed.metricsTopY + (placed.metrics?.height ?? 0),
            placed.metricsArea,
          )
        : undefined,
      xAxisHeight: plan.xAxisExtent,
      effectiveAxisGap: placed.bands.axisGap,
      topPad: frame.spacing.topPad,
      ...(chromeStripped ? { chromeStripped: true } : {}),
      noteBand,
      reference: admitReferenceRows(frame.reference, frame.lane.rows, placed.fit.reserve),
      degraded,
    };
  };

  // Fallback ladder. The outside reference lane yields first: rows that do not
  // fit the lane's share of the height place inside, and the lane shrinks
  // until the plot keeps its minimum (FigureFrame.place). Only when the plot is
  // still too small, or chrome eats too much of a fixed-height budget, does
  // chrome step down one level (full -> compact -> hidden). Authored chrome
  // outranks optional label lanes.
  const full = frame.place(chrome);
  const preliminary = full.stackArea;
  // The share check uses the raw height budget (not effectiveHeight); it is
  // off when chrome sits outside the budget, where the plot keeps its budget.
  const chromeEatsPlot =
    !outsideBudget(chromeLayout, 'chrome') && chrome.topHeight > height * PLOT_SHARE_MAX;
  if (
    (preliminary.width < MIN_CHART_WIDTH ||
      preliminary.height < MIN_CHART_HEIGHT ||
      chromeEatsPlot) &&
    chromeMode !== 'hidden'
  ) {
    const fallbackMode = chromeMode === 'full' ? 'compact' : 'hidden';
    const fallbackChrome = computeChrome(
      chromeToInput(spec.chrome),
      theme,
      width,
      options.measureText,
      fallbackMode,
      padding,
      watermark,
      bottomLegendReservation,
    );
    const fallback = frame.place(fallbackChrome);
    // Compared without the legend band and axis gap below the chrome block.
    const topDelta =
      full.stackArea.y -
      (fallback.stackArea.y - fallback.bands.topLegendBand - fallback.bands.axisGap);
    const bottomDelta = full.bands.bottom - fallback.bands.bottom;
    if (topDelta > 0 || bottomDelta > 0) {
      degraded.push(fallbackMode === 'compact' ? 'chrome-compact' : 'chrome-hidden');
      return finish(fallbackChrome, fallback, true);
    }
  }

  return finish(chrome, full, false);
}

/**
 * Resolve the series-search band. Spans the full chrome content width
 * (hPad to width - hPad, same as the metric bar) directly below chrome and
 * the metric bar. The band itself is empty SVG space: the vanilla adapter
 * absolutely positions a DOM combobox over it, so mounting the input never
 * changes the observed container size.
 */
function resolveSeriesSearch(
  spec: NormalizedChartSpec,
  y: number,
  area: { x: number; width: number },
): ResolvedSeriesSearch | undefined {
  const config = spec.seriesSearch;
  if (!config) return undefined;
  const colorEnc = spec.encoding.color;
  // Normalization already guarantees a categorical color encoding when
  // seriesSearch survives; these guards narrow the union for TypeScript.
  if (!colorEnc || 'condition' in colorEnc || !('field' in colorEnc) || !colorEnc.field) {
    return undefined;
  }
  const field = colorEnc.field;
  // Same enumeration rule as legend entries: skip rows missing the color field.
  const values = [
    ...new Set(spec.data.filter((d) => d[field] != null).map((d) => String(d[field]))),
  ];
  return {
    x: area.x,
    y,
    width: area.width,
    height: SERIES_SEARCH_INPUT_HEIGHT,
    placeholder: config.placeholder ?? 'Find a series',
    values,
  };
}
