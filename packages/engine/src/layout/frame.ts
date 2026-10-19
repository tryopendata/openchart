import type { AxisTitleHeader } from './axis-title-plan';
/**
 * Figure frame: the single owner of where the plot sits inside the figure.
 *
 * The layout plan plans ticks, the x-label angle and the reference lane
 * against a frame; the figure budget resolves the final layout from a frame
 * built with the plan's measurements. Both build it here, so the plot the
 * plan measured is the plot the budget places. Sparkline display mode has its
 * own near-edge-to-edge geometry in the budget and never reaches this module.
 */

import type {
  ChromeMode,
  Encoding,
  LayoutStrategy,
  Margins,
  Rect,
  ResolvedChrome,
  ResolvedMetricBar,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  BREAKPOINT_COMPACT_MAX,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  isAxislessMark,
  NARROW_VIEWPORT_MAX,
  TOP_PAD_EXTRA_NARROW,
} from '@opendata-ai/openchart-core';
import type { ReferenceReserve } from '../annotations/reference-layout';
import type { BarLabelPlan } from '../charts/bar/label-plan';
import type { InternalCompileOptions } from '../compile/internal-options';
import type { NormalizedChartSpec } from '../compiler/types';
import { isEndsBoth, predictEndpointLabelsWidth } from '../endpoint-labels/predict';
import { hasLegendContent, type LegendContent } from '../legend/compute';
import { SIZE_LEGEND_GAP, type SizeLegendContent } from '../legend/size';
import { countColorSeries, resolveSuppression } from '../legend/suppression';
import { legendGap, TOP_LEGEND_GAP_ABOVE } from '../legend/wrap';
import { yTickPositionIsInline } from './axes';
import { computeMetricBar } from './metrics';
import {
  bottomMargin,
  type ChromeLayoutMode,
  INLINE_TICK_OVERHANG_PAD,
  resolveChromeLayout,
  scalePadding,
} from './shared';
import {
  chromeInsetReference,
  fitReferenceLane,
  headerBands,
  MIN_CHART_HEIGHT,
  metricFonts,
  type ReferenceXResolver,
  referenceLaneFor,
  scaleAreaFor,
  stackHeight,
  stackTop,
  type VerticalBands,
} from './stack';

/** Established usable Cartesian width, shared by planning and budget degradation. */
export const MIN_CHART_WIDTH = 60;

export function hasUsablePlotWidth(
  width: number,
  margins: { left: number; right: number },
  inlineInset = 0,
): boolean {
  return width - margins.left - margins.right - inlineInset >= MIN_CHART_WIDTH;
}

/** Authored reserves the frame places: the note band and the outside reference lanes. */
export interface BudgetReserves {
  noteBand: number;
  /** Measured summary reserve activated only when endpoints yield to identification fallback. */
  endpointSummaryBand?: number;
  reference: ReferenceReserve;
  /** Rule positions for packing the top lane; without it each label gets its own row. */
  referenceX?: ReferenceXResolver;
}

/** Per-compile inputs every frame for a chart shares. */
export interface FrameContext {
  spec: NormalizedChartSpec;
  options: InternalCompileOptions;
  theme: ResolvedTheme;
  strategy: LayoutStrategy | undefined;
  reserves: BudgetReserves;
}

/** What the plan measures and the frame places. */
export interface FrameMeasures {
  /** Authored value-label reserve, chosen before scale placement. */
  valueLabelPlan?: BarLabelPlan;
  axisTitleHeader?: AxisTitleHeader;
  legendContent: LegendContent;
  sizeLegendContent?: SizeLegendContent | null;
  leftGutter: number;
  xAxisExtent: number;
  inlineYLabelInset: number;
  endpointLabelsDemoted?: boolean;
}

/** Spacing derived from the container and theme alone. */
export interface FrameSpacing {
  /** Scaled theme padding (chrome text, brand, right reference lane). */
  padding: number;
  /** Horizontal plot padding: tighter than `padding` on compact widths. */
  hPad: number;
  axisMargin: number;
  /** Padding above the chrome block (extra on narrow viewports for iOS Safari). */
  topPad: number;
  /** Axisless marks (arc, waffle, calendar, parliament). */
  isRadial: boolean;
  chromeMode: ChromeMode;
  chromeLayout: ChromeLayoutMode;
}

export function frameSpacing(ctx: FrameContext): FrameSpacing {
  const { spec, options, theme, strategy } = ctx;
  const { width, height } = options;
  const padding = scalePadding(theme.spacing.padding, width, height);
  // Sparkline mode forces chrome hidden unless the user opted in explicitly.
  let chromeMode = strategy?.chromeMode ?? 'full';
  if (spec.display === 'sparkline' && !spec.userExplicit.chrome) chromeMode = 'hidden';
  return {
    padding,
    // Horizontal padding can be tighter than the chrome text padding on narrow
    // containers because axis titles and tick labels tolerate closer edges.
    hPad:
      width < BREAKPOINT_COMPACT_MAX
        ? Math.max(Math.round(padding * HPAD_COMPACT_FRACTION), HPAD_COMPACT_MIN)
        : padding,
    axisMargin: theme.spacing.axisMargin,
    topPad: width < NARROW_VIEWPORT_MAX ? padding + TOP_PAD_EXTRA_NARROW : padding,
    isRadial: isAxislessMark(spec.markType),
    chromeMode,
    chromeLayout: resolveChromeLayout(spec, options),
  };
}

/** The figure's outside reference reserve, its right lane inset to the chrome padding. */
export function frameReference(ctx: FrameContext, spacing: FrameSpacing): ReferenceReserve {
  return chromeInsetReference(
    ctx.reserves.reference,
    ctx.spec.annotations,
    ctx.options.width,
    ctx.options.measureText,
    ctx.theme,
    spacing.padding,
  );
}

/**
 * Left and right margins: axis margins, the endpoint-label column(s), the
 * left gutter, a secondary y-axis, the right legend column and the right
 * reference lane.
 */
export function frameMargins(
  ctx: FrameContext,
  spacing: FrameSpacing,
  reference: ReferenceReserve,
  measures: Omit<FrameMeasures, 'xAxisExtent' | 'inlineYLabelInset'>,
): { left: number; right: number } {
  const { spec, options, theme, strategy } = ctx;
  const { hPad, axisMargin, isRadial } = spacing;
  let left = hPad + (isRadial ? hPad : axisMargin);
  let right = hPad + (isRadial ? hPad : axisMargin);

  // Reserve the endpoint column when the series identification policy shows it.
  const sup = resolveSuppression(spec, {
    seriesCount: countColorSeries(spec),
    labelsHiddenByStrategy: strategy?.labelMode === 'none',
    endpointLabelsDemoted: measures.endpointLabelsDemoted,
  });
  // The policy accounts for compact demotion and explicit author opt-ins.
  if (sup.showEndpointLabels) {
    const endpointWidth = predictEndpointLabelsWidth(spec, theme, options.measureText);
    if (endpointWidth > 0) {
      // The theme gap is reserved for each enabled endpoint column.
      right = Math.max(right, hPad) + endpointWidth + theme.spacing.endpointColumnGap;
      // Both-ends mode: mirror the column on the left for first-value labels.
      if (isEndsBoth(spec))
        left = Math.max(left, hPad) + endpointWidth + theme.spacing.endpointColumnGap;
    }
  }

  left = Math.max(left, measures.leftGutter) + (measures.valueLabelPlan?.reserveLeft ?? 0);
  right += measures.valueLabelPlan?.reserveRight ?? 0;

  // Reserve space for a secondary (right) y-axis in dual-axis charts.
  // Use Math.max (not +=) to mirror the left-margin pattern: the reserve
  // replaces the base axisMargin when it's larger, instead of stacking.
  if (options.rightAxisReserve && options.rightAxisReserve > 0) {
    right = Math.max(right, hPad + options.rightAxisReserve);
  }

  // Right-hand legend column. The color legend and the size legend SHARE it,
  // stacked vertically (see placeSizeLegend), so it is reserved at the width of
  // the wider block -- not the sum. Each block keeps its own gap (the color
  // legend's 8, the size legend's 12).
  const legend = measures.legendContent;
  const colorLegendInGutter =
    hasLegendContent(legend) && (legend.position === 'right' || legend.position === 'bottom-right');
  const colorReserve = colorLegendInGutter ? legend.legendWidth + 8 : 0;
  const sizeReserve = measures.sizeLegendContent
    ? measures.sizeLegendContent.width + SIZE_LEGEND_GAP
    : 0;
  right += Math.max(colorReserve, sizeReserve) + reference.right;
  return { left, right };
}

/** One chrome block placed in the frame. */
export interface FramePlacement {
  bands: VerticalBands;
  /** Admitted top reference-lane rows and their height. */
  fit: { reserve: number; admitted: number };
  /** The plot with the tentative metric bar still reserved. */
  stackArea: Rect;
  margins: Margins;
  /** The plot, after the metric bar is dropped when it does not fit. */
  chartArea: Rect;
  /** The metric bar, when the spec has one and it fits. */
  metrics?: ResolvedMetricBar;
  /** The tentative metric bar was rolled back. */
  metricsDropped: boolean;
  /** First y below the chrome block, where the metric bar and search band start. */
  metricsTopY: number;
  /** Horizontal span of the metric bar and search band. */
  metricsArea: { x: number; width: number };
}

export interface FigureFrame {
  spacing: FrameSpacing;
  /** Height the plot-area math derives from (grows past the authored height outside the budget). */
  effectiveHeight: number;
  reference: ReferenceReserve;
  /** Top reference-lane rows, packed against the final plot x-range. */
  lane: ReturnType<typeof referenceLaneFor>;
  /** Place a chrome block (the primary one, or a fallback-ladder step). */
  place(block: ResolvedChrome): FramePlacement;
}

/**
 * Build the frame for a chart. `chrome` is the primary chrome block; the
 * effective height derives from it even when the budget's fallback ladder
 * later places a smaller block.
 */
export function createFrame(
  ctx: FrameContext,
  measures: FrameMeasures,
  chrome: ResolvedChrome,
): FigureFrame {
  const { spec, options, theme } = ctx;
  const { width, height } = options;
  const spacing = frameSpacing(ctx);
  const { padding, hPad, axisMargin, topPad, isRadial, chromeMode, chromeLayout } = spacing;
  const reference = frameReference(ctx, spacing);
  const noteBand = Math.max(
    ctx.reserves.noteBand,
    measures.endpointLabelsDemoted ? (ctx.reserves.endpointSummaryBand ?? 0) : 0,
  );

  // Bands outside the budget grow the figure instead of shrinking the plot.
  // effectiveHeight is the height the plot-area math derives from; the band
  // terms baked into margins.top/bottom then cancel against this growth, so the
  // plot keeps the non-chrome budget (padding/axis/etc). In 'subtract' mode
  // effectiveHeight === height.
  const effectiveHeight = stackHeight(chromeLayout, height, chrome, noteBand);
  const horizontal = frameMargins(ctx, spacing, reference, measures);

  // Inline y-tick labels render above their gridline inside the chart area;
  // the topmost tick text extends roughly (tickFontSize + INLINE_TICK_OVERHANG_PAD)
  // pixels above area.y, which would otherwise crowd the chrome→chart gap.
  // Inline y-tick placement must match computeAxes exactly (shared predicate),
  // or the reserved left margin won't line up with where the title is drawn.
  const encoding = spec.encoding as Encoding;
  const inlineTickOverhang = yTickPositionIsInline(encoding.y, spec.markType)
    ? theme.fonts.sizes.axisTick + INLINE_TICK_OVERHANG_PAD
    : 0;

  // Tentative metric-bar reservation. The bar's final inclusion is decided by
  // computeMetricBar, which can strip it on overflow / narrow areas. We
  // reserve optimistically so the chart-area math is correct when the bar is
  // kept; place() subtracts it back when stripped. The series-search band is
  // reserved empty SVG space directly below chrome and the metric bar; the
  // vanilla adapter overlays a DOM combobox on this rect.
  const header = headerBands(spec, chromeMode, height, theme);

  const legend = measures.legendContent;
  const hasTopLegend = hasLegendContent(legend) && legend.position === 'top';
  // TOP_LEGEND_GAP_ABOVE keeps the legend from sitting flush against the
  // subtitle/metric bar now that the axis gap sits BELOW the legend. A bottom
  // legend is reserved inside chrome.bottomHeight.
  const topLegendBand = hasTopLegend ? TOP_LEGEND_GAP_ABOVE + legend.height + legendGap(width) : 0;

  /**
   * The vertical bands for a chrome block (see VerticalBands for the order).
   * The axis gap sits after the legend so the subtitle-to-legend gap stays
   * tight while ticks that protrude above the chart area keep their room.
   */
  const bandsFor = (block: ResolvedChrome): VerticalBands => {
    // Radial charts have no axes: the axis margin only separates real chrome.
    const topAxisGap = isRadial && block.topHeight === 0 ? 0 : axisMargin + inlineTickOverhang;
    return {
      topPad,
      chromeTop: block.topHeight,
      metrics: header.metrics,
      search: header.search,
      topLegendBand,
      axisGap:
        (hasTopLegend ? inlineTickOverhang : topAxisGap) +
        (measures.valueLabelPlan?.reserveTop ?? 0) +
        (measures.axisTitleHeader?.height ?? 0),
      // Additive: the note list stacks above the source/byline/footer row that
      // bottomHeight already covers, rather than replacing it.
      bottom:
        bottomMargin(block.bottomHeight, padding, measures.xAxisExtent) +
        noteBand +
        (measures.valueLabelPlan?.reserveBottom ?? 0),
    };
  };

  const areaFor = (top: number, bottom: number): Rect => ({
    x: horizontal.left,
    y: top,
    width: Math.max(0, width - horizontal.left - horizontal.right),
    height: Math.max(0, effectiveHeight - top - bottom),
  });

  // Top reference lane: vertical outside labels packed into rows by where
  // their rules fall. The horizontal margins are final here, so the rows are
  // packed exactly as placement will position them.
  const plotX = areaFor(0, 0);
  const lane = referenceLaneFor(
    reference,
    ctx.reserves.referenceX,
    plotX,
    scaleAreaFor(plotX, measures.inlineYLabelInset),
    width,
  );

  /**
   * The top lane fits first (share cap, then it yields to the plot minimum),
   * so it gives way before chrome does. The metric bar belongs with chrome,
   * above the legend, so its y is computed off chrome.topHeight only, not the
   * full legend-inclusive margins.top.
   */
  const place = (block: ResolvedChrome): FramePlacement => {
    const bands = bandsFor(block);
    const fit = fitReferenceLane(
      lane.cumulative,
      height,
      effectiveHeight - stackTop(bands, 0) - bands.bottom,
      MIN_CHART_HEIGHT,
    );
    const top = stackTop(bands, fit.reserve);
    const stackArea = areaFor(top, bands.bottom);
    const margins: Margins = {
      top,
      right: horizontal.right,
      bottom: bands.bottom,
      left: horizontal.left,
    };
    const metricsTopY = topPad + block.topHeight;
    const metricsArea = { x: hPad, width: Math.max(0, width - hPad * 2) };
    const metrics =
      header.metrics > 0
        ? computeMetricBar(
            spec.metrics,
            metricsTopY,
            metricsArea,
            stackArea.height,
            options.measureText,
            metricFonts(theme),
          )
        : undefined;
    const metricsDropped = header.metrics > 0 && !metrics;
    let chartArea = stackArea;
    if (metricsDropped) {
      // Clamp at 0 as a defensive guard: the reservation was additive, but a
      // negative top margin would shift the chart above the SVG viewport.
      margins.top = Math.max(0, margins.top - header.metrics);
      chartArea = areaFor(margins.top, margins.bottom);
    }
    return {
      bands,
      fit,
      stackArea,
      margins,
      chartArea,
      metrics,
      metricsDropped,
      metricsTopY,
      metricsArea,
    };
  };

  return { spacing, effectiveHeight, reference, lane, place };
}
