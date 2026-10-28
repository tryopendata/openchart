import type {
  Encoding,
  EncodingChannel,
  FieldFormatContext,
  LayoutStrategy,
  MeasureTextFn,
  Rect,
  ResolvedChrome,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  AXIS_TITLE_TRAILING_PAD,
  axisTitleOffset,
  BREAKPOINT_COMPACT_MAX,
  COMPACT_WIDTH,
  computeChrome,
  computeFieldFormatContext,
  computeXAxisExtentFromLabels,
  defaultNumberFormatter,
  estimateTextWidth,
  getHeightClass,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  isAxislessMark,
  LABEL_GAP_COMPACT,
  LABEL_GAP_DEFAULT,
  MAX_LEFT_LABEL_FRACTION_COMPACT,
  MAX_LEFT_LABEL_FRACTION_DEFAULT,
  MAX_LEFT_LABEL_FRACTION_MEDIUM,
  MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX,
  NARROW_VIEWPORT_MAX,
  resolveNumberFormatter,
} from '@opendata-ai/openchart-core';
import { NO_REFERENCE_RESERVE } from '../annotations/reference-layout';
import { type BarLabelPlan, planBarLabels } from '../charts/bar/label-plan';
import { isBinnedBarEncoding } from '../charts/post-process';
import type { InternalCompileOptions } from '../compile/internal-options';
import type { NormalizedChartSpec } from '../compiler/types';
import { isEndsBoth, predictEndpointLabelsWidth } from '../endpoint-labels/predict';
import {
  computeLegendContent,
  hasLegendContent,
  type LegendContent,
  measureCategoricalLegendContent,
} from '../legend/compute';
import {
  computeSizeLegendContent,
  type SizeLegendContent,
  sizeLegendScaleFor,
} from '../legend/size';
import { endpointLabelsExplicitlyOn } from '../legend/suppression';
import { legendGap } from '../legend/wrap';
import { yTickPositionIsInline } from './axes';
import { resolveBandTickAngle } from './axes/rotation';
import {
  buildContinuousTicks,
  buildDefaultYTicks,
  scaleSupportsTickCount,
  targetTickCount,
} from './axes/ticks';
import {
  type AxisTitleHeader,
  authoredTitleFootprint,
  isYAxisHeader,
  measureYAxisHeader,
} from './axis-title-plan';
import type { BudgetReserves } from './budget';
import {
  createFrame,
  type FrameContext,
  frameMargins,
  frameReference,
  frameSpacing,
  hasUsablePlotWidth,
} from './frame';
import {
  categoricalAxisIsBand,
  computeScales,
  estimateBandStep,
  estimateBandwidth,
} from './scales';
import { chromeToInput, fieldIterable, scalePadding } from './shared';
import { scaleAreaFor } from './stack';

// ---------------------------------------------------------------------------
// MeasureFn -- simplified width-only text measurement
// ---------------------------------------------------------------------------

/** Width-only text measurement function used by the layout planner. */
export type MeasureFn = (text: string, fontSize: number, fontWeight: number) => number;

// ---------------------------------------------------------------------------
// LayoutPlan -- frozen dimensions from the measure phase
// ---------------------------------------------------------------------------

/** Frozen layout dimensions produced by the measure phase. */
export interface LayoutPlan {
  valueLabelPlan?: BarLabelPlan;
  axisTitleHeader?: AxisTitleHeader;
  leftGutter: number;
  xAxisExtent: number;
  legendContent: LegendContent;
  /**
   * Size legend content, when a quantitative `size` channel is encoded.
   *
   * Kept beside `legendContent` rather than inside it: a chart can carry BOTH a
   * color legend and a size legend, and folding them into one slot is what made
   * the size channel unkeyable in the first place. `dimensions.ts` reserves
   * right-margin for this independently of the color legend's position.
   */
  sizeLegendContent?: SizeLegendContent | null;
  chrome: ResolvedChrome;
  yTickValues: unknown[];
  yTickCount: number;
  converged: boolean;
  inlineYLabelInset: number;
  /** True when endpoint labels were demoted by auto-thinning (don't fit at current width). */
  endpointLabelsDemoted?: boolean;
  /**
   * The plot the y ticks were planned for: the figure frame (./frame.ts) built
   * from this plan's own measurements and the same reserves the budget gets, so
   * it is the budget's chartArea unless the chrome ladder steps down.
   */
  plotArea?: Rect;
}

// ---------------------------------------------------------------------------
// createMeasureFn -- adapter from MeasureTextFn to MeasureFn
// ---------------------------------------------------------------------------

/**
 * Wraps an optional adapter-provided `MeasureTextFn` (returns `{ width, height }`)
 * into a simpler `MeasureFn` that returns width only. Falls back to the
 * heuristic `estimateTextWidth` when no real measurement is available.
 */
export function createMeasureFn(measureText?: MeasureTextFn): MeasureFn {
  if (measureText) {
    return (text: string, fontSize: number, fontWeight: number) =>
      measureText(text, fontSize, fontWeight).width;
  }
  return estimateTextWidth;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleLabelFromContext(
  maxAbsVal: number,
  yAxisFormat: string | undefined,
  ctx: FieldFormatContext,
): string {
  if (yAxisFormat) {
    const fmt = resolveNumberFormatter(yAxisFormat, ctx);
    if (fmt) return fmt(maxAbsVal);
  }
  return defaultNumberFormatter({ ...ctx, extent: ctx.extent ?? [0, maxAbsVal] })(maxAbsVal);
}

/** Endpoint labels give way to the legend past this share of the width (autoThin). */
const MAX_ENDPOINT_FRACTION = 0.3;

/**
 * Whether auto-thinning demotes endpoint labels to the legend: the column would
 * take more than 30% of the width. Depends only on the spec and the width, so
 * the series-summary preview reads it before the plan runs.
 */
export function endpointLabelsDemotedAt(
  chartSpec: NormalizedChartSpec,
  theme: ResolvedTheme,
  width: number,
  measureText?: MeasureTextFn,
): boolean {
  const fixedRight = chartSpec.frame?.right;
  const fixedLeft = isEndsBoth(chartSpec) ? chartSpec.frame?.left : undefined;
  const measuredWidth = predictEndpointLabelsWidth(chartSpec, theme, measureText);
  const required = measuredWidth + theme.spacing.endpointColumnGap;
  if (
    measuredWidth > 0 &&
    ((fixedRight !== undefined && required > fixedRight) ||
      (fixedLeft !== undefined && required > fixedLeft))
  )
    return true;
  if (
    !chartSpec.autoThin ||
    chartSpec.legend?.show === false ||
    endpointLabelsExplicitlyOn(chartSpec)
  )
    return false;
  const epWidth = predictEndpointLabelsWidth(chartSpec, theme, measureText);
  return (
    epWidth > 0 &&
    ((epWidth + theme.spacing.endpointColumnGap) * (isEndsBoth(chartSpec) ? 2 : 1)) / width >
      MAX_ENDPOINT_FRACTION
  );
}

// ---------------------------------------------------------------------------
// resolveLayoutPlan
// ---------------------------------------------------------------------------

/**
 * Measure real axis labels and legend content, then freeze the chart layout.
 *
 * Runs up to 2 iterations: build provisional scales at an estimated gutter,
 * generate real y-axis tick labels, measure their widths, and check whether
 * the gutter changed. If it converged on the first pass, we're done;
 * otherwise a second pass locks in the final gutter as max(pass0, pass1).
 *
 * @param chartSpec  - UNFILTERED spec (used for legend -- retains all series)
 * @param renderSpec - FILTERED spec (used for measuring data and scales)
 * @param options    - InternalCompileOptions (width, height, measureText, etc.)
 * @param theme      - Resolved theme
 * @param strategy   - Responsive layout strategy
 * @param watermark  - Whether the brand watermark is shown
 * @param measure    - Width-only text measurement function
 * @param reserves   - Authored reserves the budget will place (note band, reference lanes)
 */
export function resolveLayoutPlan(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  options: InternalCompileOptions,
  theme: ResolvedTheme,
  strategy: LayoutStrategy,
  watermark: boolean,
  measure: MeasureFn,
  reserves?: BudgetReserves,
): LayoutPlan {
  const { width, height } = options;
  const measureFigureLegend: typeof computeLegendContent = (...args) => {
    const merged = options.categoricalLegend;
    if (merged)
      return measureCategoricalLegendContent(
        merged.entries,
        merged.config,
        args[1],
        args[2],
        args[3],
        args[4],
        args[5],
        args[6],
      );
    const content = computeLegendContent(...args);
    if (
      options.leafContext &&
      !options.leafContext.categoricalLegend &&
      content.entries.length &&
      !content.continuous
    ) {
      // Use the actual transformed normalized rows and resolved leaf colors.
      // Collection preserves eligibility; only limits wait for the figure union.
      const full = computeLegendContent(
        {
          ...args[0],
          legend: {
            ...args[0].legend,
            show: true,
            symbolLimit: Number.MAX_SAFE_INTEGER,
            maxRows: Number.MAX_SAFE_INTEGER,
          },
        },
        args[1],
        args[2],
        args[3],
        args[4],
        args[5],
        args[6],
        args[7],
      );
      options.leafContext.categoricalLegend = { entries: full.entries, config: args[0].legend };
    }
    return content;
  };
  const padding = scalePadding(theme.spacing.padding, width, height);
  const hPad =
    width < BREAKPOINT_COMPACT_MAX
      ? Math.max(Math.round(padding * HPAD_COMPACT_FRACTION), HPAD_COMPACT_MIN)
      : padding;
  const encoding = renderSpec.encoding as Encoding;
  const isRadial = isAxislessMark(renderSpec.markType);
  const axisMargin = theme.spacing.axisMargin;

  // Resolve chromeMode
  let chromeMode = strategy?.chromeMode ?? 'full';
  if (renderSpec.display === 'sparkline' && !renderSpec.userExplicit?.chrome) {
    chromeMode = 'hidden';
  }

  // The 100-199px cramped height range renders a compact title (chromeMode
  // 'compact'), but a full-size title there can push chrome.topHeight past
  // the min-chart-height guardrail and get stripped by the hidden-chrome
  // fallback. Shrink the default title size a bit further to keep it.
  const crampedTitle = getHeightClass(height) === 'cramped';

  // -----------------------------------------------------------------------
  // Sparkline / radial: trivial plan (no y-axis measurement needed)
  // -----------------------------------------------------------------------
  if (renderSpec.display === 'sparkline' || isRadial) {
    const legendContent = measureFigureLegend(
      chartSpec,
      strategy,
      theme,
      width,
      height,
      watermark,
      measure,
    );
    const bottomLegendReservation =
      hasLegendContent(legendContent) && legendContent.position === 'bottom'
        ? legendContent.height + legendGap(width)
        : 0;
    const chrome = computeChrome(
      chromeToInput(renderSpec.chrome),
      theme,
      width,
      options.measureText,
      chromeMode,
      padding,
      watermark,
      bottomLegendReservation,
      crampedTitle,
    );
    return {
      leftGutter: hPad,
      xAxisExtent: 0,
      legendContent,
      // Sparkline / radial: no positional axes and no bubbles, so no size key.
      sizeLegendContent: null,
      chrome,
      yTickValues: [],
      yTickCount: 0,
      converged: true,
      inlineYLabelInset: 0,
    };
  }

  // -----------------------------------------------------------------------
  // Resolve y-axis inline status
  // -----------------------------------------------------------------------
  const yAxisCfg = (encoding.y?.axis as Record<string, unknown> | undefined) ?? undefined;
  const yIsContinuous = encoding.y?.type === 'quantitative' || encoding.y?.type === 'temporal';
  // Inline y-tick placement must match computeAxes exactly (shared predicate),
  // or the reserved left margin won't line up with where the title is drawn.
  // Sparkline display already returned early above, so no sparkline guard needed.
  const yIsInline = yTickPositionIsInline(encoding.y, renderSpec.markType);
  const yAxisSuppressed = encoding.y?.axis === false;

  // -----------------------------------------------------------------------
  // Seed gutter from formatted max |y|
  // -----------------------------------------------------------------------
  let leftGutter = hPad + axisMargin; // base: pad + axis margin
  if (encoding.y && !isRadial && !yAxisSuppressed && !yIsInline) {
    // A binned bar is a `bar` whose y is the quantitative count, so the bare
    // markType test would send it down the category-label path and size the
    // gutter by string-measuring raw counts instead of formatted ticks. The
    // predicate is shared with the renderer dispatch so the two can't drift.
    const isBinnedBar = isBinnedBarEncoding(renderSpec.markType, encoding);
    if (
      !isBinnedBar &&
      (encoding.y.type === 'nominal' ||
        encoding.y.type === 'ordinal' ||
        renderSpec.markType === 'bar' ||
        renderSpec.markType === 'circle' ||
        renderSpec.markType === 'lollipop')
    ) {
      // Category labels: measure real data values
      const yField = encoding.y.field;
      const yLabelField = yAxisCfg?.labelField as string | undefined;
      let maxLabelWidth = 0;
      for (const row of renderSpec.data) {
        const label = String(row[yField] ?? '');
        let w = measure(label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
        if (yLabelField) {
          const subtitle = String(row[yLabelField] ?? '');
          if (subtitle) {
            const gap = theme.fonts.sizes.axisTick * 0.6;
            const subtitleWidth = measure(
              subtitle,
              theme.fonts.sizes.axisTick,
              theme.fonts.weights.normal,
            );
            w += gap + subtitleWidth;
          }
        }
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
      if (maxLabelWidth > 0) {
        const labelGap = width < NARROW_VIEWPORT_MAX ? LABEL_GAP_COMPACT : LABEL_GAP_DEFAULT;
        const maxLeftFraction =
          width < BREAKPOINT_COMPACT_MAX
            ? MAX_LEFT_LABEL_FRACTION_COMPACT
            : width < MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX
              ? MAX_LEFT_LABEL_FRACTION_MEDIUM
              : MAX_LEFT_LABEL_FRACTION_DEFAULT;
        const maxLeftReserved = Math.floor(width * maxLeftFraction);
        const reserved = Math.min(hPad + maxLabelWidth + labelGap, maxLeftReserved);
        leftGutter = Math.max(leftGutter, reserved);
      }
    } else {
      // Quantitative: seed with a formatted label
      const yField = encoding.y.field;
      const yAxisFormat = yAxisCfg?.format as string | undefined;
      let maxAbsVal = 0;
      for (const row of renderSpec.data) {
        const v = Number(row[yField]);
        if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
      }
      const ctx = computeFieldFormatContext(fieldIterable(renderSpec.data, yField));
      const sampleLabel = sampleLabelFromContext(maxAbsVal, yAxisFormat, ctx);
      const negPrefix = renderSpec.data.some((r) => Number(r[yField]) < 0) ? '-' : '';
      const labelWidth = measure(
        negPrefix + sampleLabel,
        theme.fonts.sizes.axisTick,
        theme.fonts.weights.normal,
      );
      leftGutter = Math.max(leftGutter, hPad + labelWidth + 10);
    }
  }

  // -----------------------------------------------------------------------
  // X-axis setup (doesn't change between iterations)
  // -----------------------------------------------------------------------
  const xAxisSuppressed = encoding.x?.axis === false;
  const xAxis = (!xAxisSuppressed && encoding.x?.axis) as Record<string, unknown> | undefined;
  const hasXAxisTitle = !!xAxis?.title;
  const xTickAngle = xAxis?.labelAngle as number | undefined;

  // Only band x-axes auto-rotate (computeAxes); point-scale labels stay flat.
  const xScaleType = encoding.x?.scale?.type;
  const xIsBand =
    xScaleType === 'band' ||
    ((xScaleType === undefined || xScaleType === 'ordinal') &&
      categoricalAxisIsBand(renderSpec.markType, 'x'));

  // Collect x labels for extent computation
  const xLabels: string[] = [];
  if (!isRadial && !xAxisSuppressed && encoding.x) {
    const xField = encoding.x.field;
    if (encoding.x.type === 'nominal' || encoding.x.type === 'ordinal') {
      const seen = new Set<string>();
      for (const row of renderSpec.data) {
        const label = String(row[xField] ?? '');
        if (!seen.has(label)) {
          seen.add(label);
          xLabels.push(label);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Iteration loop (max 2)
  // -----------------------------------------------------------------------
  let prev: { gutter: number; rowCount: number; xAxisExtent: number } | null = null;
  let finalPlan: LayoutPlan | null = null;

  // Endpoint-label fit check: when autoThin is on, demote endpoint labels to
  // legend if the column would consume more than 30% of the total width.
  let endpointLabelsDemoted = endpointLabelsDemotedAt(chartSpec, theme, width, options.measureText);

  // Size legend: keys a quantitative `size` channel with graduated circles.
  // Independent of the color legend -- a bubble chart keys BOTH continent
  // (color) and population (size), so this is computed alongside, not instead.
  // Its content is width-independent, so it sits outside the convergence loop.
  //
  // Dropped below COMPACT_WIDTH. The block is a fixed ~90px (it can't reflow the
  // way a categorical legend's entries can), which on a phone-width chart is a
  // quarter of the SVG spent on the key and a plot too narrow to read the bubbles
  // it explains. The same threshold the color legend goes compact at.
  const sizeScaleOpts = sizeLegendScaleFor(renderSpec.markType);
  const sizeLegendContent =
    sizeScaleOpts && chartSpec.legend?.show !== false && width >= COMPACT_WIDTH
      ? computeSizeLegendContent(
          renderSpec.encoding.size as EncodingChannel | undefined,
          renderSpec.data,
          theme,
          sizeScaleOpts,
        )
      : null;

  // The figure frame the budget builds from this plan. Built here from the
  // plan's provisional measurements, so every plot the plan measures against
  // (band widths, the reference lane, the y-tick height) is the budget's plot.
  const frameCtx: FrameContext = {
    spec: chartSpec,
    options,
    theme,
    strategy,
    reserves: reserves ?? { noteBand: 0, reference: NO_REFERENCE_RESERVE },
  };
  const spacing = frameSpacing(frameCtx);
  const frameRef = frameReference(frameCtx, spacing);
  let valueLabelPlan: BarLabelPlan | undefined;
  let axisTitleHeader: AxisTitleHeader | undefined;
  const planFrame = (
    legendContent: LegendContent,
    chrome: ResolvedChrome,
    gutter: number,
    xAxisExtent: number,
    inlineYLabelInset: number,
  ) =>
    createFrame(
      frameCtx,
      {
        legendContent,
        sizeLegendContent,
        leftGutter: gutter,
        xAxisExtent,
        inlineYLabelInset,
        endpointLabelsDemoted,
        valueLabelPlan,
        axisTitleHeader,
      },
      chrome,
    ).place(chrome).chartArea;

  // Continuous y ticks for a plot, as computeAxes will generate them.
  const yTicksFor = (area: Rect) => {
    const scales = computeScales(renderSpec, area, renderSpec.data);
    if (!scales.y || !scaleSupportsTickCount(scales.y)) return null;
    const axisTickCount = yAxisCfg?.tickCount as number | undefined;
    const effectiveCount = axisTickCount ?? targetTickCount(area.height, 'full', 'y');
    return axisTickCount != null
      ? buildContinuousTicks(scales.y, effectiveCount)
      : buildDefaultYTicks(scales.y, effectiveCount);
  };
  const yTicksPlanned = !!encoding.y && yIsContinuous && !yAxisSuppressed;

  for (let iter = 0; iter < 2; iter++) {
    // Legend content
    const legendAvailWidth = width - padding - leftGutter;
    let legendContent = measureFigureLegend(
      chartSpec,
      strategy,
      theme,
      legendAvailWidth,
      height,
      watermark,
      measure,
      endpointLabelsDemoted,
    );

    // Chrome
    const bottomLegendReservation =
      hasLegendContent(legendContent) && legendContent.position === 'bottom'
        ? legendContent.height + legendGap(width)
        : 0;
    let chrome = computeChrome(
      chromeToInput(renderSpec.chrome),
      theme,
      width,
      options.measureText,
      chromeMode,
      padding,
      watermark,
      bottomLegendReservation,
      crampedTitle,
    );

    // Effective x tick angle. Band x-axes auto-rotate to -45° when horizontal
    // labels don't fit their band; computeAxes makes the same call later. The
    // planner must know the angle now so it reserves the rotated-label
    // footprint in the bottom margin instead of the (smaller) flat one.
    // Bands are sized against the frame's plot width: every right-hand
    // reservation (legend column, endpoint labels, secondary axis, reference
    // lane) narrows it. A wider estimate concludes the labels fit flat, and
    // computeAxes then rotates them against the true bandwidth -- reserving
    // the flat footprint for rotated labels and clipping the axis.
    const xAxisExtentFor = (plotWidth: number): number => {
      let effectiveXTickAngle = xTickAngle;
      if (xTickAngle === undefined && xIsBand && xLabels.length > 1) {
        // Mirror d3 scaleBand: step = plotWidth / (n - paddingInner + 2*paddingOuter),
        // bandwidth = step * (1 - paddingInner). Uses the same override resolution
        // as buildBandScale so paddingInner/paddingOuter are honored here too.
        const bandwidth = estimateBandwidth(encoding.x?.scale, plotWidth, xLabels.length);
        const step = estimateBandStep(encoding.x?.scale, plotWidth, xLabels.length);
        // Mirror categoricalTicks' explicit tickCount cap: retained ticks sit a
        // multiple of the band step apart, so the drawn labels and their anchor
        // spacing — not the full category set — drive the angle here, matching
        // what computeAxes measures from actual tick positions.
        const xTickCount = xAxis?.tickCount as number | undefined;
        let drawnLabels = xLabels;
        let anchorSpacing = step;
        if (xTickCount && xLabels.length > xTickCount) {
          const capStride = Math.ceil(xLabels.length / xTickCount);
          drawnLabels = xLabels.filter((_, i) => i % capStride === 0);
          anchorSpacing = step * capStride;
        }
        let maxXLabelWidth = 0;
        for (const label of drawnLabels) {
          const w = measure(label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
          if (w > maxXLabelWidth) maxXLabelWidth = w;
        }
        effectiveXTickAngle = resolveBandTickAngle(
          undefined,
          maxXLabelWidth,
          bandwidth,
          drawnLabels.length,
          anchorSpacing,
          theme.fonts.sizes.axisTick,
        );
      }

      // X-axis extent
      return isRadial || xAxisSuppressed
        ? 0
        : computeXAxisExtentFromLabels({
            labels: xLabels,
            tickAngle: effectiveXTickAngle,
            hasTitle: hasXAxisTitle,
            tickFontSize: theme.fonts.sizes.axisTick,
            tickFontWeight: theme.fonts.weights.normal,
            xAxisHeight: theme.spacing.xAxisHeight,
            measure,
          }) +
            Math.max(
              0,
              (authoredTitleFootprint(encoding.x, theme, options.measureText)?.height ??
                theme.fonts.sizes.body) - theme.fonts.sizes.body,
            );
    };
    // Evaluate each authored mode against the same frame the budget places.
    // This is a planning measurement: no marks/scales are placed or recompiled.
    const selectValueLabelPlan = (gutter: number, inlineInset = 0): BarLabelPlan | undefined => {
      if (renderSpec.markType !== 'bar' || !renderSpec.labels.placement) return undefined;
      const baseMargins = frameMargins(frameCtx, spacing, frameRef, {
        legendContent,
        sizeLegendContent,
        leftGutter: gutter,
        endpointLabelsDemoted,
      });
      return planBarLabels(renderSpec, theme, {
        availableWidth: Math.max(0, width - baseMargins.left - baseMargins.right - inlineInset),
        measureText: options.measureText,
        plotHeightForPlan: (candidate) => {
          const candidateMargins = frameMargins(frameCtx, spacing, frameRef, {
            legendContent,
            sizeLegendContent,
            leftGutter: gutter,
            endpointLabelsDemoted,
            valueLabelPlan: candidate,
          });
          const plotWidth = Math.max(
            0,
            width - candidateMargins.left - candidateMargins.right - inlineInset,
          );
          const header = measureYAxisHeader(
            encoding.y,
            theme,
            plotWidth * (options.axisHeaderWidthFraction ?? 1),
            options.measureText,
          );
          return createFrame(
            frameCtx,
            {
              legendContent,
              sizeLegendContent,
              leftGutter: gutter,
              xAxisExtent: xAxisExtentFor(plotWidth),
              inlineYLabelInset: inlineInset,
              endpointLabelsDemoted,
              valueLabelPlan: candidate,
              axisTitleHeader: header,
            },
            chrome,
          ).place(chrome).chartArea.height;
        },
      });
    };
    const margins = frameMargins(frameCtx, spacing, frameRef, {
      legendContent,
      sizeLegendContent,
      leftGutter,
      endpointLabelsDemoted,
    });
    valueLabelPlan = selectValueLabelPlan(leftGutter);
    margins.left += valueLabelPlan?.reserveLeft ?? 0;
    margins.right += valueLabelPlan?.reserveRight ?? 0;
    axisTitleHeader = measureYAxisHeader(
      encoding.y,
      theme,
      Math.max(0, width - margins.left - margins.right) * (options.axisHeaderWidthFraction ?? 1),
      options.measureText,
    );
    const xAxisExtent = xAxisExtentFor(Math.max(0, width - margins.left - margins.right));

    // The plot at this iteration's gutter. The inline y-label inset is not
    // known until the ticks are; the final frame below accounts for it.
    const provisionalArea = planFrame(legendContent, chrome, leftGutter, xAxisExtent, 0);

    // Build provisional scales and generate real y ticks
    let yTickValues: unknown[] = [];
    let yTickCount = 0;
    let newGutter = leftGutter;

    if (yTicksPlanned) {
      const ticks = yTicksFor(provisionalArea);
      if (ticks) {
        yTickValues = ticks.map((t) => t.value);
        yTickCount = ticks.length;

        // Measure real tick labels for gutter
        if (!yIsInline) {
          let maxLabelWidth = 0;
          for (const t of ticks) {
            const w = measure(t.label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
            if (w > maxLabelWidth) maxLabelWidth = w;
          }
          newGutter = hPad + maxLabelWidth + 10;
        }
      }
    }

    // Convergence check
    const converged =
      prev != null &&
      Math.abs(newGutter - prev.gutter) <= 0.5 &&
      legendContent.rowCount === prev.rowCount &&
      Math.abs(xAxisExtent - prev.xAxisExtent) <= 0.5;

    if (converged || iter === 1) {
      // On non-convergence at iter=1: gutter = max(iter0, iter1)
      const finalGutter = prev && !converged ? Math.max(prev.gutter, newGutter) : newGutter;

      const finalArea =
        finalGutter === leftGutter
          ? provisionalArea
          : planFrame(legendContent, chrome, finalGutter, xAxisExtent, 0);

      // If non-convergent, regenerate ticks once at the final gutter
      if (prev && !converged && yTicksPlanned) {
        const ticks = yTicksFor(finalArea);
        if (ticks) {
          yTickValues = ticks.map((t) => t.value);
          yTickCount = ticks.length;
        }
      }

      // Compute inline y-label inset
      let inlineYLabelInset = 0;
      if (
        chartSpec.frame?.left === undefined &&
        yIsInline &&
        encoding.y &&
        yIsContinuous &&
        encoding.y.axis !== false
      ) {
        if (yTickValues.length > 0) {
          // Build ticks from the final scales to get formatted labels
          const scales = computeScales(renderSpec, finalArea, renderSpec.data);
          if (scales.y && scaleSupportsTickCount(scales.y)) {
            const ticks = buildContinuousTicks(scales.y, yTickCount || 5);
            let maxLabelWidth = 0;
            for (const t of ticks) {
              const w = measure(t.label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
              if (w > maxLabelWidth) maxLabelWidth = w;
            }
            if (maxLabelWidth > 0) {
              inlineYLabelInset = Math.ceil(maxLabelWidth + 8);
            }
          }
        } else {
          // Fallback: measure from data max
          const yField = encoding.y.field;
          const yAxisFormat = yAxisCfg?.format as string | undefined;
          let maxAbsVal = 0;
          for (const row of renderSpec.data) {
            const v = Number(row[yField]);
            if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
          }
          const ctx = computeFieldFormatContext(fieldIterable(renderSpec.data, yField));
          const sample = sampleLabelFromContext(maxAbsVal, yAxisFormat, ctx);
          const neg = renderSpec.data.some((r) => Number(r[encoding.y!.field]) < 0) ? '-' : '';
          const maxLabelWidth = measure(
            neg + sample,
            theme.fonts.sizes.axisTick,
            theme.fonts.weights.normal,
          );
          if (maxLabelWidth > 0) {
            inlineYLabelInset = Math.ceil(maxLabelWidth + 8);
          }
        }
      }

      // Account for rotated y-axis title in the gutter
      let gutterWithTitle = finalGutter;
      const yAxisDef = encoding.y?.axis as Record<string, unknown> | undefined;
      if (
        yAxisDef &&
        (yAxisDef.title || yAxisDef.label) &&
        !isRadial &&
        !isYAxisHeader(encoding.y)
      ) {
        let estTickLabelWidth = 0;
        // Inline y-tick labels sit above their gridlines inside the chart area,
        // not in a left gutter, so they add no width the title must clear.
        // Reserving their width here would leave a dead gap between the title
        // and the plot. Only gutter (non-inline) tick labels count.
        if (encoding.y?.field && yIsContinuous && !yIsInline) {
          if (yTickValues.length > 0) {
            const scales = computeScales(renderSpec, finalArea, renderSpec.data);
            if (scales.y && scaleSupportsTickCount(scales.y)) {
              const ticks = buildContinuousTicks(scales.y, yTickCount || 5);
              for (const t of ticks) {
                const w = measure(t.label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
                if (w > estTickLabelWidth) estTickLabelWidth = w;
              }
            }
          }
        }
        const titleFontSize = theme.fonts.sizes.body;
        const offset = axisTitleOffset(estTickLabelWidth, titleFontSize, width, yIsInline);
        const halfGlyph = Math.ceil(titleFontSize / 2);
        const rotatedLabelMargin =
          offset + halfGlyph + (width < BREAKPOINT_COMPACT_MAX ? 0 : AXIS_TITLE_TRAILING_PAD);
        const titleExtra = Math.max(
          0,
          (authoredTitleFootprint(encoding.y, theme, options.measureText)?.width ??
            theme.fonts.sizes.body) - theme.fonts.sizes.body,
        );
        gutterWithTitle = Math.max(finalGutter, hPad + rotatedLabelMargin + titleExtra);
      }

      // The budget's frame: this plan's final measurements over the same
      // reserves. When the title gutter or the inline inset moved the plot
      // (the inset can repack the reference lane), plan the ticks again for it.
      // Freeze the authored mode against the final category/title gutter before
      // placement. No reserve is discovered after this planning stage.
      let finalMargins = frameMargins(frameCtx, spacing, frameRef, {
        legendContent,
        sizeLegendContent,
        leftGutter: gutterWithTitle,
        endpointLabelsDemoted,
      });
      // Select the identification mode from the final measured frame, before
      // scale placement. Explicit endpoint/suppression choices remain authored.
      const fallbackAvailable =
        chartSpec.legend?.show !== false || (reserves?.endpointSummaryBand ?? 0) > 0;
      if (
        !endpointLabelsDemoted &&
        chartSpec.autoThin &&
        !endpointLabelsExplicitlyOn(chartSpec) &&
        fallbackAvailable &&
        predictEndpointLabelsWidth(chartSpec, theme, options.measureText) > 0 &&
        !hasUsablePlotWidth(width, finalMargins, inlineYLabelInset)
      ) {
        endpointLabelsDemoted = true;
        legendContent = measureFigureLegend(
          chartSpec,
          strategy,
          theme,
          width - padding - gutterWithTitle,
          height,
          watermark,
          measure,
          true,
        );
        const bottomReserve =
          hasLegendContent(legendContent) && legendContent.position === 'bottom'
            ? legendContent.height + legendGap(width)
            : 0;
        chrome = computeChrome(
          chromeToInput(renderSpec.chrome),
          theme,
          width,
          options.measureText,
          chromeMode,
          padding,
          watermark,
          bottomReserve,
          crampedTitle,
        );
        finalMargins = frameMargins(frameCtx, spacing, frameRef, {
          legendContent,
          sizeLegendContent,
          leftGutter: gutterWithTitle,
          endpointLabelsDemoted,
        });
      }
      valueLabelPlan = selectValueLabelPlan(gutterWithTitle, inlineYLabelInset);
      axisTitleHeader = measureYAxisHeader(
        encoding.y,
        theme,
        Math.max(
          0,
          width -
            finalMargins.left -
            finalMargins.right -
            (valueLabelPlan?.reserveLeft ?? 0) -
            (valueLabelPlan?.reserveRight ?? 0),
        ) * (options.axisHeaderWidthFraction ?? 1),
        options.measureText,
      );
      let finalXAxisExtent = xAxisExtent;
      let plotArea = planFrame(
        legendContent,
        chrome,
        gutterWithTitle,
        finalXAxisExtent,
        inlineYLabelInset,
      );
      // A wider gutter or an inline y-label inset narrows the bands the label
      // angle was chosen against; resolve it again at the plot computeAxes
      // will draw on.
      const settledExtent = xAxisExtentFor(scaleAreaFor(plotArea, inlineYLabelInset).width);
      if (Math.abs(settledExtent - finalXAxisExtent) > 0.5) {
        finalXAxisExtent = settledExtent;
        plotArea = planFrame(
          legendContent,
          chrome,
          gutterWithTitle,
          finalXAxisExtent,
          inlineYLabelInset,
        );
      }
      if (yTicksPlanned && Math.abs(plotArea.height - finalArea.height) > 0.5) {
        const ticks = yTicksFor(plotArea);
        if (ticks) {
          yTickValues = ticks.map((t) => t.value);
          yTickCount = ticks.length;
        }
      }

      finalPlan = {
        leftGutter: gutterWithTitle,
        xAxisExtent: finalXAxisExtent,
        legendContent,
        sizeLegendContent,
        chrome,
        yTickValues,
        yTickCount,
        converged: prev === null || converged,
        inlineYLabelInset,
        endpointLabelsDemoted,
        plotArea,
        ...(valueLabelPlan ? { valueLabelPlan } : {}),
        ...(axisTitleHeader ? { axisTitleHeader } : {}),
      };
      break;
    }

    prev = { gutter: newGutter, rowCount: legendContent.rowCount, xAxisExtent };
    leftGutter = newGutter;
  }

  if (!finalPlan) throw new Error('resolveLayoutPlan: loop exited without producing a plan');
  return finalPlan;
}
