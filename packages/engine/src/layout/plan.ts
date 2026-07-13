import type {
  CompileOptions,
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
  TOP_PAD_EXTRA_NARROW,
} from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import { predictEndpointLabelsWidth } from '../endpoint-labels/predict';
import { computeLegendContent, hasLegendContent, type LegendContent } from '../legend/compute';
import {
  computeSizeLegendContent,
  SIZE_LEGEND_GAP,
  type SizeLegendContent,
  sizeLegendScaleFor,
} from '../legend/size';
import { legendGap, TOP_LEGEND_GAP_ABOVE } from '../legend/wrap';
import { yTickPositionIsInline } from './axes';
import { resolveBandTickAngle } from './axes/rotation';
import { buildContinuousTicks, scaleSupportsTickCount, targetTickCount } from './axes/ticks';
import { computeScales, estimateBandStep, estimateBandwidth } from './scales';
import { bottomMargin, chromeToInput, INLINE_TICK_OVERHANG_PAD, scalePadding } from './shared';

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
 * @param options    - CompileOptions (width, height, measureText, etc.)
 * @param theme      - Resolved theme
 * @param strategy   - Responsive layout strategy
 * @param watermark  - Whether the brand watermark is shown
 * @param measure    - Width-only text measurement function
 */
export function resolveLayoutPlan(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  options: CompileOptions,
  theme: ResolvedTheme,
  strategy: LayoutStrategy,
  watermark: boolean,
  measure: MeasureFn,
): LayoutPlan {
  const { width, height } = options;
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

  // -----------------------------------------------------------------------
  // Sparkline / radial: trivial plan (no y-axis measurement needed)
  // -----------------------------------------------------------------------
  if (renderSpec.display === 'sparkline' || isRadial) {
    const legendContent = computeLegendContent(
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
    if (
      encoding.y.type === 'nominal' ||
      encoding.y.type === 'ordinal' ||
      renderSpec.markType === 'bar' ||
      renderSpec.markType === 'circle' ||
      renderSpec.markType === 'lollipop'
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
      const ctx = computeFieldFormatContext(renderSpec.data.map((r) => r[yField]));
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
  const MAX_ENDPOINT_FRACTION = 0.3;
  let endpointLabelsDemoted = false;
  if (chartSpec.autoThin) {
    const epWidth = predictEndpointLabelsWidth(chartSpec, theme);
    if (epWidth > 0 && epWidth / width > MAX_ENDPOINT_FRACTION) {
      endpointLabelsDemoted = true;
    }
  }

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

  for (let iter = 0; iter < 2; iter++) {
    // Legend content
    const legendAvailWidth = width - padding - leftGutter;
    const legendContent = computeLegendContent(
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
    const chrome = computeChrome(
      chromeToInput(renderSpec.chrome),
      theme,
      width,
      options.measureText,
      chromeMode,
      padding,
      watermark,
      bottomLegendReservation,
    );

    // Effective x tick angle. Band x-axes auto-rotate to -45° when horizontal
    // labels don't fit their band; computeAxes makes the same call later. The
    // planner must know the angle now so it reserves the rotated-label
    // footprint in the bottom margin instead of the (smaller) flat one.
    let effectiveXTickAngle = xTickAngle;
    if (xTickAngle === undefined && xLabels.length > 1) {
      // The size legend's right column narrows the plot (dimensions.ts reserves
      // it), so it has to be in this estimate too. Without it the planner sizes
      // bands against a plot up to ~100px wider than the real one, concludes the
      // labels fit flat, and computeAxes then rotates them against the true
      // bandwidth -- reserving the flat footprint for rotated labels and clipping
      // the axis. Bites a nominal-x beeswarm with a size channel.
      const sizeLegendReserve = sizeLegendContent ? sizeLegendContent.width + SIZE_LEGEND_GAP : 0;
      const rightMarginEst = hPad + (isRadial ? hPad : axisMargin) + sizeLegendReserve;
      const plotWidth = Math.max(0, width - leftGutter - Math.max(rightMarginEst, hPad));
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
    const xAxisExtent =
      isRadial || xAxisSuppressed
        ? 0
        : computeXAxisExtentFromLabels({
            labels: xLabels,
            tickAngle: effectiveXTickAngle,
            hasTitle: hasXAxisTitle,
            tickFontSize: theme.fonts.sizes.axisTick,
            tickFontWeight: theme.fonts.weights.normal,
            xAxisHeight: theme.spacing.xAxisHeight,
            measure,
          });

    // Top margin
    const topPad = width < NARROW_VIEWPORT_MAX ? padding + TOP_PAD_EXTRA_NARROW : padding;
    const hasTopLegend = hasLegendContent(legendContent) && legendContent.position === 'top';
    const gap = legendGap(width);
    const inlineTickOverhang = yIsInline
      ? theme.fonts.sizes.axisTick + INLINE_TICK_OVERHANG_PAD
      : 0;
    const topAxisGap = axisMargin + inlineTickOverhang;
    const effectiveTopAxisGap = hasTopLegend ? inlineTickOverhang : topAxisGap;

    let topMargin = topPad + chrome.topHeight;
    // Mirrors the dimensions.ts margin stack: min gap above the top legend.
    if (hasTopLegend) topMargin += TOP_LEGEND_GAP_ABOVE + legendContent.height + gap;
    topMargin += effectiveTopAxisGap;

    const bMargin = bottomMargin(chrome.bottomHeight, padding, xAxisExtent);
    const chartHeight = Math.max(0, height - topMargin - bMargin);

    // Provisional area
    const rightMargin = hPad + (isRadial ? hPad : axisMargin);
    const rightAxisReserve = options.rightAxisReserve ?? 0;
    const provisionalArea: Rect = {
      x: leftGutter,
      y: topMargin,
      width: Math.max(0, width - leftGutter - Math.max(rightMargin, hPad + rightAxisReserve)),
      height: chartHeight,
    };

    // Build provisional scales and generate real y ticks
    let yTickValues: unknown[] = [];
    let yTickCount = 0;
    let newGutter = leftGutter;

    if (encoding.y && yIsContinuous && !yAxisSuppressed) {
      const scales = computeScales(renderSpec, provisionalArea, renderSpec.data);
      if (scales.y && scaleSupportsTickCount(scales.y)) {
        const yTargetCount = targetTickCount(chartHeight, 'full', 'y');
        const axisTickCount = yAxisCfg?.tickCount as number | undefined;
        const effectiveCount = axisTickCount ?? yTargetCount;
        const ticks = buildContinuousTicks(scales.y, effectiveCount);
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

      // If non-convergent, regenerate ticks once at the final height
      if (prev && !converged && encoding.y && yIsContinuous && !yAxisSuppressed) {
        const finalProvArea: Rect = {
          x: finalGutter,
          y: topMargin,
          width: Math.max(0, width - finalGutter - Math.max(rightMargin, hPad + rightAxisReserve)),
          height: chartHeight,
        };
        const scales = computeScales(renderSpec, finalProvArea, renderSpec.data);
        if (scales.y && scaleSupportsTickCount(scales.y)) {
          const yTargetCount = targetTickCount(chartHeight, 'full', 'y');
          const axisTickCount = yAxisCfg?.tickCount as number | undefined;
          const effectiveCount = axisTickCount ?? yTargetCount;
          const ticks = buildContinuousTicks(scales.y, effectiveCount);
          yTickValues = ticks.map((t) => t.value);
          yTickCount = ticks.length;
        }
      }

      // Compute inline y-label inset
      let inlineYLabelInset = 0;
      if (yIsInline && encoding.y && yIsContinuous && encoding.y.axis !== false) {
        if (yTickValues.length > 0) {
          // Build ticks from the final scales to get formatted labels
          const finalProvArea: Rect = {
            x: finalGutter,
            y: topMargin,
            width: Math.max(0, width - finalGutter - rightMargin),
            height: chartHeight,
          };
          const scales = computeScales(renderSpec, finalProvArea, renderSpec.data);
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
          const ctx = computeFieldFormatContext(renderSpec.data.map((r) => r[yField]));
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
      if (yAxisDef && (yAxisDef.title || yAxisDef.label) && !isRadial) {
        let estTickLabelWidth = 0;
        // Inline y-tick labels sit above their gridlines inside the chart area,
        // not in a left gutter, so they add no width the title must clear.
        // Reserving their width here would leave a dead gap between the title
        // and the plot. Only gutter (non-inline) tick labels count.
        if (encoding.y?.field && yIsContinuous && !yIsInline) {
          if (yTickValues.length > 0) {
            const titleProvArea: Rect = {
              x: finalGutter,
              y: topMargin,
              width: Math.max(0, width - finalGutter - hPad),
              height: chartHeight,
            };
            const scales = computeScales(renderSpec, titleProvArea, renderSpec.data);
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
        gutterWithTitle = Math.max(finalGutter, hPad + rotatedLabelMargin);
      }

      finalPlan = {
        leftGutter: gutterWithTitle,
        xAxisExtent,
        legendContent,
        sizeLegendContent,
        chrome,
        yTickValues,
        yTickCount,
        converged: prev === null || converged,
        inlineYLabelInset,
        endpointLabelsDemoted,
      };
      break;
    }

    prev = { gutter: newGutter, rowCount: legendContent.rowCount, xAxisExtent };
    leftGutter = newGutter;
  }

  if (!finalPlan) throw new Error('resolveLayoutPlan: loop exited without producing a plan');
  return finalPlan;
}
