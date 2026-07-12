/**
 * Dimension computation for the chart layout.
 *
 * Takes the normalized spec + compile options + legend layout and produces
 * LayoutDimensions with the total area, chrome layout, chart drawing area,
 * and margins. The chart area is what's left after subtracting chrome,
 * legend space, and axis margins.
 *
 * Padding and chrome scale down at smaller container sizes to maximize
 * the usable chart area. When the chart area is still too small after
 * scaling, chrome is progressively stripped as a fallback.
 */

import type {
  CompileOptions,
  Encoding,
  LayoutStrategy,
  LegendLayout,
  Margins,
  Rect,
  ResolvedChrome,
  ResolvedMetricBar,
  ResolvedSeriesSearch,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  AXIS_TITLE_TRAILING_PAD,
  axisTitleOffset,
  BREAKPOINT_COMPACT_MAX,
  computeChrome,
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
  TOP_PAD_EXTRA_NARROW,
} from '@opendata-ai/openchart-core';
import { format as d3Format } from 'd3-format';

import type { NormalizedChartSpec } from '../compiler/types';
import { isEndsBoth, predictEndpointLabelsWidth } from '../endpoint-labels/predict';
import { hasLegendContent } from '../legend/compute';
import { SIZE_LEGEND_GAP } from '../legend/size';
import { countColorSeries, resolveSuppression } from '../legend/suppression';
import { legendGap, TOP_LEGEND_GAP_ABOVE } from '../legend/wrap';
import { yTickPositionIsInline } from './axes';
import { computeMetricBar, type MetricFontSizes, metricBarHeight } from './metrics';
import type { LayoutPlan } from './plan';
import { bottomMargin, chromeToInput, INLINE_TICK_OVERHANG_PAD, scalePadding } from './shared';

/** Pull the metric-row font sizes from the resolved theme. */
function metricFonts(theme: ResolvedTheme): MetricFontSizes {
  return { label: theme.fonts.sizes.metricLabel, value: theme.fonts.sizes.metricValue };
}

/** True when a placed legend layout has visible content (back-compat path). */
function legendLayoutHasContent(legendLayout: LegendLayout): boolean {
  if (legendLayout.type === 'continuous') return legendLayout.bounds.height > 0;
  return 'entries' in legendLayout && legendLayout.entries.length > 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The complete dimension layout for a chart. */
export interface LayoutDimensions {
  /** Total available space. */
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
}

/** Minimum chart area dimensions before guardrails kick in. */
const MIN_CHART_WIDTH = 60;
const MIN_CHART_HEIGHT = 40;

/** Input row height for the series-search band (matches the DOM input's CSS height). */
const SERIES_SEARCH_INPUT_HEIGHT = 32;
/** Gap between the series-search input row and whatever stacks below it. */
const SERIES_SEARCH_GAP = 12;

/**
 * Per-display minimum chart dimensions. Sparkline mode allows much smaller
 * containers (down to ~30x20px) since the entire chart is just the mark.
 */
function getMinChartDims(display: import('@opendata-ai/openchart-core').Display): {
  width: number;
  height: number;
} {
  return display === 'sparkline'
    ? { width: 30, height: 20 }
    : { width: MIN_CHART_WIDTH, height: MIN_CHART_HEIGHT };
}

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
 * Compute chart dimensions, reserving space for chrome, legend, and axes.
 *
 * @param spec - Normalized chart spec.
 * @param options - Compile options (width, height, theme, darkMode).
 * @param legendLayout - Pre-computed legend layout (used to reserve space).
 * @param theme - Already-resolved theme (resolved once in compileChart).
 * @param strategy - Responsive layout strategy (controls chrome mode).
 * @returns LayoutDimensions with chart area rect.
 */
export function computeDimensions(
  spec: NormalizedChartSpec,
  options: CompileOptions,
  legendLayout: LegendLayout,
  theme: ResolvedTheme,
  strategy?: LayoutStrategy,
  watermark: boolean = true,
  plan?: LayoutPlan,
): LayoutDimensions {
  const { width, height } = options;

  const padding = scalePadding(theme.spacing.padding, width, height);
  // Horizontal padding can be tighter than the chrome text padding on narrow
  // containers because axis titles and tick labels tolerate closer edges.
  const hPad =
    width < BREAKPOINT_COMPACT_MAX
      ? Math.max(Math.round(padding * HPAD_COMPACT_FRACTION), HPAD_COMPACT_MIN)
      : padding;
  const axisMargin = theme.spacing.axisMargin;
  const userExplicit = spec.userExplicit;
  const isSparkline = spec.display === 'sparkline';

  // Sparkline mode forces chrome hidden unless the user opted in explicitly.
  // Force-hiding chrome here also short-circuits the watermark (which is
  // rendered as part of chrome), so we don't need a separate watermark gate.
  let chromeMode = strategy?.chromeMode ?? 'full';
  if (isSparkline && !userExplicit.chrome) {
    chromeMode = 'hidden';
  }

  // Pre-compute the bottom-legend reservation (legend height + gap) so the
  // chrome layout can stack source/byline/footer below the legend band.
  // When a layout plan is present, derive legend info from plan.legendContent;
  // otherwise fall back to the legendLayout parameter (back-compat).
  const bottomLegendReservation = plan
    ? hasLegendContent(plan.legendContent) && plan.legendContent.position === 'bottom'
      ? plan.legendContent.height + legendGap(width)
      : 0
    : legendLayoutHasContent(legendLayout) && legendLayout.position === 'bottom'
      ? legendLayout.bounds.height + legendGap(width)
      : 0;

  // When a layout plan is present, use its pre-computed chrome directly.
  // Otherwise compute chrome with mode and scaled padding.
  //
  // Invariant: bottom-legend space is owned by `chrome.bottomHeight`, not
  // `margins.bottom`. The legend reservation flows like this:
  //   bottomLegendReservation = legend.height + legendGap(width)
  //   chrome.bottomHeight     >= bottomLegendReservation  (via computeChrome)
  //   margins.bottom          = padding + chrome.bottomHeight + xAxisHeight
  // So the legend band is implicitly inside margins.bottom exactly once.
  // The legend-reservation block further down explicitly skips position
  // 'bottom' to avoid double-counting.
  const chrome =
    plan?.chrome ??
    computeChrome(
      chromeToInput(spec.chrome),
      theme,
      width,
      options.measureText,
      chromeMode,
      padding,
      watermark,
      bottomLegendReservation,
    );

  // Sparkline mode: produce a near-edge-to-edge layout. Only stroke-width-based
  // safety padding plus chrome (if user-explicit). Skip axis space, label
  // reservations, annotation reservations, and legend reservations unless the
  // user opted in to those individually.
  if (isSparkline) {
    const total: Rect = { x: 0, y: 0, width, height };
    const sparkPad = getSparklinePad(spec);

    // Axis space only when user explicitly set encoding.x/y.axis.
    const xAxisSpace = userExplicit.xAxis ? 26 : 0;
    const yAxisSpace = userExplicit.yAxis ? 30 : 0;

    const margins: Margins = {
      top: chrome.topHeight + sparkPad.top,
      right: sparkPad.right,
      bottom: chrome.bottomHeight + sparkPad.bottom + xAxisSpace,
      left: sparkPad.left + yAxisSpace,
    };

    // Reserve legend space only when user explicitly opted into a legend.
    if (userExplicit.legend && legendLayoutHasContent(legendLayout)) {
      const gap = legendGap(width);
      if (legendLayout.position === 'right' || legendLayout.position === 'bottom-right') {
        margins.right += legendLayout.bounds.width + 8;
      } else if (legendLayout.position === 'top') {
        margins.top += legendLayout.bounds.height + gap;
      } else if (legendLayout.position === 'bottom') {
        margins.bottom += legendLayout.bounds.height + gap;
      }
    }

    const chartArea: Rect = {
      x: margins.left,
      y: margins.top,
      width: Math.max(0, width - margins.left - margins.right),
      height: Math.max(0, height - margins.top - margins.bottom),
    };

    return {
      total,
      chrome,
      chartArea,
      margins,
      theme,
      xAxisHeight: xAxisSpace,
      effectiveAxisGap: 0,
    };
  }

  // Start with the total rect
  const total: Rect = { x: 0, y: 0, width, height };

  // Axisless charts (arc, waffle, calendar) don't have axes, so skip axis space
  const isRadial = isAxislessMark(spec.markType);
  const encoding = spec.encoding as Encoding;

  // Estimate x-axis height below chart area: tick labels sit 14px below,
  // axis title sits 35px below. These extend past the chart area bottom
  // and source/footer chrome must be positioned below them.
  const xAxisSuppressed = encoding.x?.axis === false;
  const xAxis = (!xAxisSuppressed && encoding.x?.axis) as
    | (Record<string, unknown> & { labelAngle?: number })
    | undefined;
  const hasXAxisLabel = !!xAxis?.title;
  const xTickAngle = xAxis?.labelAngle;

  let xAxisHeight: number;
  if (plan) {
    xAxisHeight = plan.xAxisExtent;
  } else if (isRadial || xAxisSuppressed) {
    xAxisHeight = 0;
  } else if (xTickAngle && Math.abs(xTickAngle) > 10) {
    // Rotated labels: estimate height from the longest label text.
    // At -90 degrees, the label height = text width. At -45, it's width * sin(45).
    const angleRad = Math.abs(xTickAngle) * (Math.PI / 180);
    const xField = encoding.x?.field;
    let maxLabelWidth = 40; // fallback
    if (xField) {
      for (const row of spec.data) {
        const label = String(row[xField] ?? '');
        const w = estimateTextWidth(label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
    }
    // Rotated label height: width * sin(angle), plus a small gap
    const rotatedHeight = maxLabelWidth * Math.sin(angleRad) + 6;
    // Cap at a reasonable max to avoid absurd margins
    const labelHeight = Math.min(rotatedHeight, 120);
    xAxisHeight = hasXAxisLabel ? labelHeight + 20 : labelHeight;
  } else {
    const base = theme.spacing.xAxisHeight;
    xAxisHeight = hasXAxisLabel ? base + 22 : base;
  }

  // Resolve effective y-axis tickPosition early so margin math can account
  // for the inline-tick overhang. Inline y-tick labels render above their
  // gridline inside the chart area; the topmost tick text extends roughly
  // (tickFontSize + INLINE_TICK_OVERHANG_PAD) pixels above area.y, which
  // would otherwise crowd the chrome→chart gap.
  // Inline y-tick placement must match computeAxes exactly (shared predicate),
  // or the reserved left margin won't line up with where the title is drawn.
  const yIsInlinePre = yTickPositionIsInline(encoding.y, spec.markType);
  const inlineTickOverhang = yIsInlinePre
    ? theme.fonts.sizes.axisTick + INLINE_TICK_OVERHANG_PAD
    : 0;

  // Build margins: padding + chrome + axis space.
  // For radial charts (arc/donut), axes don't exist, so axisMargin is only
  // added when there's actual chrome content that needs separation from the
  // chart area. When chrome is empty the margin is just padding.
  const topAxisGap = isRadial && chrome.topHeight === 0 ? 0 : axisMargin + inlineTickOverhang;
  // Extra top padding on narrow viewports prevents iOS Safari from clipping
  // the title chrome behind the browser UI.
  const topPad = width < NARROW_VIEWPORT_MAX ? padding + TOP_PAD_EXTRA_NARROW : padding;
  // Tentative metric-bar reservation. The bar's final inclusion is decided
  // below by computeMetricBar, which can strip it on overflow / narrow areas.
  // We reserve optimistically so the chart-area math is correct when the bar
  // is kept; the rollback path subtracts it back when stripped.
  const wantsMetrics = !!spec.metrics && spec.metrics.length > 0 && chromeMode !== 'hidden';
  const tentativeMetricsHeight = wantsMetrics ? metricBarHeight(metricFonts(theme)) : 0;
  // Series-search band: reserved empty SVG space directly below chrome and
  // the metric bar. The vanilla adapter overlays a DOM combobox on this rect.
  const wantsSearch = !!spec.seriesSearch && chromeMode !== 'hidden';
  const searchReservation = wantsSearch ? SERIES_SEARCH_INPUT_HEIGHT + SERIES_SEARCH_GAP : 0;
  // topAxisGap sits between the legend (or chrome, if no legend) and the
  // chart area. It accounts for the general axis margin plus any inline
  // tick-label overhang. Placing it after the legend (below) keeps the
  // subtitle-to-legend gap tight while reserving physical space for ticks
  // that protrude above the chart area.
  const margins: Margins = {
    top: topPad + chrome.topHeight + tentativeMetricsHeight + searchReservation,
    right: hPad + (isRadial ? hPad : axisMargin),
    bottom: bottomMargin(chrome.bottomHeight, padding, xAxisHeight),
    left: hPad + (isRadial ? hPad : axisMargin),
  };

  // Right-margin reservation for the three-way label suppression truth table:
  //
  //   1. Endpoint-labels column (predicted width, default ON for ≥2-series
  //      line/area). Reserves chart-width + ENDPOINT_COLUMN_GAP + col-width.
  //   2. Legacy end-of-line labels — only when the truth table resolves to
  //      `showEndOfLineLabels: true` (legend hidden AND endpoint column off).
  //   3. Right-edge text annotations — stack ADDITIVELY on top of (1) and (2)
  //      so a callout at maxX lands between the chart area and any column to
  //      its right.
  const labelDensity = spec.labels.density;
  const labelsHiddenByStrategy = strategy?.labelMode === 'none';
  const seriesCount = countColorSeries(spec);
  const sup = resolveSuppression(spec, {
    seriesCount,
    labelsHiddenByStrategy,
    labelsDensityNone: labelDensity === 'none',
    endpointLabelsDemoted: plan?.endpointLabelsDemoted,
  });

  // (1) Endpoint-labels column reservation. predictEndpointLabelsWidth returns 0
  // when the column would be suppressed. `labels.density` is intentionally
  // not checked here — that switch controls only the legacy end-of-line labels.
  // No extra strategy check either: `sup.showEndpointLabels` already accounts
  // for the compact strip (and its explicit-opt-in override).
  let endpointWidth = 0;
  if (sup.showEndpointLabels) {
    endpointWidth = predictEndpointLabelsWidth(spec, theme);
    if (endpointWidth > 0) {
      // 16px gap between chart area edge and the column.
      margins.right = Math.max(margins.right, hPad) + endpointWidth + 16;
      // Both-ends mode: mirror the column on the left for first-value labels.
      if (isEndsBoth(spec)) {
        margins.left = Math.max(margins.left, hPad) + endpointWidth + 16;
      }
    }
  }

  // (2) Legacy end-of-line label reservation — fires only in the truth-table
  // cell where end-of-line labels still render (legend hidden AND endpoint
  // column off AND ≥2 series AND labels visible). When the endpoint column
  // is on, this reservation is redundant and is skipped.
  if (
    endpointWidth === 0 &&
    sup.showEndOfLineLabels &&
    (spec.markType === 'line' || spec.markType === 'area') &&
    labelDensity !== 'none' &&
    !labelsHiddenByStrategy
  ) {
    const colorEnc = encoding.color;
    const colorField = colorEnc && 'field' in colorEnc ? colorEnc.field : undefined;
    if (colorField) {
      let maxLabelWidth = 0;
      const seen = new Set<string>();
      for (const row of spec.data) {
        const label = String(row[colorField] ?? '');
        if (!seen.has(label)) {
          seen.add(label);
          const w = estimateTextWidth(label, 11, 600);
          if (w > maxLabelWidth) maxLabelWidth = w;
        }
      }
      if (maxLabelWidth > 0) {
        margins.right = Math.max(margins.right, hPad + maxLabelWidth + 8);
      }
    }
  }

  // (3) Right-edge text annotations. Stacks ADDITIVELY on top of any
  // endpoint-labels reservation so the annotation text lands between the
  // chart area's right edge and the endpoint column. When no endpoint column
  // is reserved, behaves as before (max-of with the existing margin).
  if (
    strategy?.annotationPosition !== 'tooltip-only' &&
    spec.annotations.length > 0 &&
    encoding.x
  ) {
    const xField = encoding.x.field;
    // Find the maximum x value in the data
    let maxX: string | number | undefined;
    for (const row of spec.data) {
      const v = row[xField];
      if (v != null && (maxX == null || String(v) >= String(maxX))) maxX = v as string | number;
    }
    if (maxX != null) {
      const maxXStr = String(maxX);
      for (const ann of spec.annotations) {
        if (ann.type === 'text' && String(ann.x) === maxXStr) {
          const textWidth = estimateTextWidth(ann.text, ann.fontSize ?? 11, ann.fontWeight ?? 600);
          const dx = ann.offset?.dx ?? 0;
          // How much text extends right of the anchor point depends on alignment:
          // - anchor "right" or "left": text is off to one side, full width extends
          // - anchor "top"/"bottom"/"auto"/undefined: text is centered, half extends right
          const anchor = ann.anchor ?? 'auto';
          const baseRightExtent =
            anchor === 'left'
              ? textWidth
              : // text is to the right of anchor
                anchor === 'right'
                ? 0
                : // text is to the left of anchor
                  textWidth / 2; // centered (top/bottom/auto)
          const rightOverflow = Math.max(0, baseRightExtent + dx);
          if (rightOverflow > 0) {
            if (endpointWidth > 0) {
              // Endpoint column already reserved space at the far right; the
              // annotation lands BETWEEN the chart edge and the column, so
              // stack additively rather than max-of.
              margins.right += rightOverflow + 12;
            } else {
              margins.right = Math.max(margins.right, hPad + rightOverflow + 12);
            }
          }
        }
      }
    }
  }

  // Dynamic left margin for y-axis labels (yIsInline already resolved above
  // for inline-tick top-margin reservation).
  const yAxisSuppressed = encoding.y?.axis === false;
  const yIsInline = yIsInlinePre;
  if (encoding.y && !isRadial && !yAxisSuppressed && !yIsInline) {
    if (
      !plan &&
      (spec.markType === 'bar' ||
        spec.markType === 'circle' ||
        spec.markType === 'lollipop' ||
        encoding.y.type === 'nominal' ||
        encoding.y.type === 'ordinal')
    ) {
      // Category labels on the left for bar/dot charts
      const yField = encoding.y.field;
      const yLabelField = (encoding.y.axis as Record<string, unknown> | undefined)?.labelField as
        | string
        | undefined;
      let maxLabelWidth = 0;
      for (const row of spec.data) {
        const label = String(row[yField] ?? '');
        let w = estimateTextWidth(label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
        // When labelField is set, add a gap and the subtitle width
        if (yLabelField) {
          const subtitle = String(row[yLabelField] ?? '');
          if (subtitle) {
            const gap = theme.fonts.sizes.axisTick * 0.6;
            const subtitleWidth = estimateTextWidth(
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
        // Tighter label-to-chart gap on narrow containers
        const labelGap = width < NARROW_VIEWPORT_MAX ? LABEL_GAP_COMPACT : LABEL_GAP_DEFAULT;
        // Clamp reservation so bars keep at least ~45% of container width on
        // narrow viewports. Labels that exceed the cap will be truncated by
        // the axis renderer (see axes.ts).
        const maxLeftFraction =
          width < BREAKPOINT_COMPACT_MAX
            ? MAX_LEFT_LABEL_FRACTION_COMPACT
            : width < MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX
              ? MAX_LEFT_LABEL_FRACTION_MEDIUM
              : MAX_LEFT_LABEL_FRACTION_DEFAULT;
        const maxLeftReserved = Math.floor(width * maxLeftFraction);
        const reserved = Math.min(hPad + maxLabelWidth + labelGap, maxLeftReserved);
        margins.left = Math.max(margins.left, reserved);
      }
    } else if ((encoding.y.type === 'quantitative' || encoding.y.type === 'temporal') && !plan) {
      // Numeric tick labels on the left. Estimate width from the data range.
      // Skipped when a layout plan is present -- the plan measured real tick
      // labels and provides plan.leftGutter below.
      const yField = encoding.y.field;
      const yAxisFormat = (encoding.y.axis as Record<string, unknown> | undefined)?.format as
        | string
        | undefined;
      let maxAbsVal = 0;
      for (const row of spec.data) {
        const v = Number(row[yField]);
        if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
      }

      let sampleLabel: string;
      if (yAxisFormat) {
        // Use the actual d3-format to produce a realistic label estimate
        try {
          const fmt = d3Format(yAxisFormat);
          sampleLabel = fmt(maxAbsVal);
        } catch {
          sampleLabel = String(maxAbsVal);
        }
      } else {
        // Fallback: estimate from magnitude
        if (maxAbsVal >= 1_000_000_000) sampleLabel = '1.5B';
        else if (maxAbsVal >= 1_000_000) sampleLabel = '1.5M';
        else if (maxAbsVal >= 1_000) sampleLabel = '1.5K';
        else if (maxAbsVal >= 100) sampleLabel = '100';
        else if (maxAbsVal >= 10) sampleLabel = '10';
        else sampleLabel = '0.0';
      }
      // Account for negative sign
      const negPrefix = spec.data.some((r) => Number(r[yField]) < 0) ? '-' : '';
      const labelEst = negPrefix + sampleLabel;
      const labelWidth = estimateTextWidth(
        labelEst,
        theme.fonts.sizes.axisTick,
        theme.fonts.weights.normal,
      );
      // 6px gap between label and chart area edge
      margins.left = Math.max(margins.left, hPad + labelWidth + 10);
    }
  }

  // Rotated y-axis label needs extra left margin (rendered at area.x - offset in SVG).
  // The renderer computes a dynamic offset that accounts for wide tick labels (e.g.
  // "$100,000" is ~62px wide and would overlap a fixed 45px offset). We replicate
  // the same formula here so the reserved space matches what the renderer places.
  // Skipped when a layout plan is present -- the plan already accounts for the
  // y-axis title in its leftGutter calculation.
  const yAxis = encoding.y?.axis as Record<string, unknown> | undefined;
  if (yAxis && (yAxis.title || yAxis.label) && !isRadial && !plan) {
    // Estimate the widest y-axis tick label width to mirror the renderer's dynamic offset.
    const yFieldForTitle = encoding.y?.field;
    const yAxisFormatForTitle = yAxis?.format as string | undefined;
    let estTickLabelWidth = 0;
    // Inline y-tick labels render inside the chart area (above their gridlines),
    // not in a left gutter, so they add no width the rotated title must clear.
    // Counting them here would reserve a phantom gutter and leave a dead gap
    // between the title and the plot.
    if (
      yFieldForTitle &&
      !yIsInlinePre &&
      (encoding.y?.type === 'quantitative' || encoding.y?.type === 'temporal')
    ) {
      let maxAbsValForTitle = 0;
      for (const row of spec.data) {
        const v = Number(row[yFieldForTitle]);
        if (Number.isFinite(v) && Math.abs(v) > maxAbsValForTitle) maxAbsValForTitle = Math.abs(v);
      }
      let sampleLabelForTitle: string;
      if (yAxisFormatForTitle) {
        try {
          const fmt = d3Format(yAxisFormatForTitle);
          sampleLabelForTitle = fmt(maxAbsValForTitle);
        } catch {
          sampleLabelForTitle = String(maxAbsValForTitle);
        }
      } else {
        if (maxAbsValForTitle >= 1_000_000_000) sampleLabelForTitle = '1.5B';
        else if (maxAbsValForTitle >= 1_000_000) sampleLabelForTitle = '1.5M';
        else if (maxAbsValForTitle >= 1_000) sampleLabelForTitle = '1.5K';
        else if (maxAbsValForTitle >= 100) sampleLabelForTitle = '100';
        else if (maxAbsValForTitle >= 10) sampleLabelForTitle = '10';
        else sampleLabelForTitle = '0.0';
      }
      const negPrefixForTitle = spec.data.some((r) => Number(r[yFieldForTitle]) < 0) ? '-' : '';
      estTickLabelWidth = estimateTextWidth(
        negPrefixForTitle + sampleLabelForTitle,
        theme.fonts.sizes.axisTick,
        theme.fonts.weights.normal,
      );
    }
    // Mirror the renderer's title placement so the reserved space matches where
    // the title is drawn. axisTitleOffset() returns the distance to the title's
    // center; it already includes the title half-glyph on the tick-label side.
    // We add another halfGlyph here for the title glyph extending the other way,
    // toward the container edge, so the margin reaches the title's outer edge.
    const titleFontSize = theme.fonts.sizes.body;
    const offset = axisTitleOffset(estTickLabelWidth, titleFontSize, width, yIsInlinePre);
    const halfGlyph = Math.ceil(titleFontSize / 2);
    const rotatedLabelMargin =
      offset + halfGlyph + (width < BREAKPOINT_COMPACT_MAX ? 0 : AXIS_TITLE_TRAILING_PAD);
    margins.left = Math.max(margins.left, hPad + rotatedLabelMargin);
  }

  // When a layout plan is present, its leftGutter was measured from real tick
  // labels and already accounts for quantitative guess + y-axis title. Apply
  // it as a floor so the plan's measurement wins over the category-label
  // reservation above (which stays for bar/dot charts).
  if (plan) {
    margins.left = Math.max(margins.left, plan.leftGutter);
  }

  // Reserve space for a secondary (right) y-axis in dual-axis charts.
  // Use Math.max (not +=) to mirror the left-margin pattern: the reserve
  // replaces the base axisMargin when it's larger, instead of stacking.
  if (options.rightAxisReserve && options.rightAxisReserve > 0) {
    margins.right = Math.max(margins.right, hPad + options.rightAxisReserve);
  }

  // Reserve space for the auto-thinning footnote list. Additive, not Math.max:
  // the footnotes stack above the source/byline/footer row that bottomHeight
  // already covers, rather than replacing it.
  if (options.footnoteReserve && options.footnoteReserve > 0) {
    margins.bottom += options.footnoteReserve;
  }

  // Reserve legend space.
  //
  // Bottom legend: reservation is already baked into `chrome.bottomHeight`
  // via `bottomLegendReservation`, so no additional bottom margin is needed
  // here. The legend lands below the x-axis tick row (which is reserved via
  // `xAxisHeight` in the base bottom margin) and source/byline/footer chrome
  // stacks underneath the legend band rather than colliding with it.
  // When a plan is present, derive legend position/size from plan.legendContent;
  // otherwise use the legendLayout parameter (back-compat for non-plan callers).
  const legendHasEntries = plan
    ? hasLegendContent(plan.legendContent)
    : legendLayoutHasContent(legendLayout);
  const legendPos = plan ? plan.legendContent.position : legendLayout.position;
  const legendHeight = plan ? plan.legendContent.height : legendLayout.bounds.height;
  const legendBoundsWidth = plan ? plan.legendContent.legendWidth : legendLayout.bounds.width;

  const hasTopLegend = legendHasEntries && legendPos === 'top';
  if (legendHasEntries) {
    const gap = legendGap(width);
    if (legendPos === 'right' || legendPos === 'bottom-right') {
      margins.right += legendBoundsWidth + 8;
    } else if (legendPos === 'top') {
      // TOP_LEGEND_GAP_ABOVE keeps the legend from sitting flush against the
      // subtitle/metric bar now that the axis gap sits BELOW the legend.
      margins.top += TOP_LEGEND_GAP_ABOVE + legendHeight + gap;
    }
    // 'bottom' is intentionally not handled here -- see bottomLegendReservation
    // above.
  }

  // Size legend: its own right-column reservation, ADDED to whatever the color
  // legend already took. This is the whole point of the plural slot -- a bubble
  // chart keys continent (color) and population (size), and reserving for only
  // one leaves the other drawing on top of the plot.
  //
  // Right column, not top: graduated circles are as tall as the largest bubble's
  // diameter, and a ~60px band across the top of a 400px chart eats the plot.
  const sizeLegend = plan?.sizeLegendContent;
  if (sizeLegend) {
    margins.right += sizeLegend.width + SIZE_LEGEND_GAP;
  }

  // effectiveAxisGap sits between the legend (or chrome, if no legend) and
  // the chart area. When a top legend is present, the legendGap already
  // provides breathing room, so only the inlineTickOverhang is needed (the
  // axisMargin component would double up with legendGap). Without a top
  // legend, the full topAxisGap (axisMargin + inlineTickOverhang) applies.
  // The value is returned so placeLegend can position the top legend above
  // this reserved zone (inline y-tick labels draw inside it).
  const effectiveAxisGap = hasTopLegend ? inlineTickOverhang : topAxisGap;
  margins.top += effectiveAxisGap;

  // Chart area is what's left after margins
  let chartArea: Rect = {
    x: margins.left,
    y: margins.top,
    width: Math.max(0, width - margins.left - margins.right),
    height: Math.max(0, height - margins.top - margins.bottom),
  };

  // Guardrail: if chart area is too small, progressively strip chrome
  const minDims = getMinChartDims(spec.display);
  if (
    (chartArea.width < minDims.width || chartArea.height < minDims.height) &&
    chromeMode !== 'hidden'
  ) {
    // Try compact first, then hidden
    const fallbackMode = chromeMode === 'full' ? 'compact' : 'hidden';
    const fallbackChrome = computeChrome(
      chromeToInput(spec.chrome),
      theme,
      width,
      options.measureText,
      fallbackMode as 'compact' | 'hidden',
      padding,
      watermark,
      bottomLegendReservation,
    );

    // Recalculate top/bottom margins with stripped chrome.
    // Use topPad (not padding) to preserve the iOS Safari clearance on narrow viewports.
    // Include the tentative metric reservation so the rollback below mirrors
    // the primary path's invariant (margins.top includes tentativeMetricsHeight
    // until resolveMetrics decides otherwise).
    const fallbackTopAxisGap =
      isRadial && fallbackChrome.topHeight === 0 ? 0 : axisMargin + inlineTickOverhang;
    const fallbackEffectiveAxisGap = hasTopLegend ? inlineTickOverhang : fallbackTopAxisGap;
    const newTop = topPad + fallbackChrome.topHeight + tentativeMetricsHeight + searchReservation;
    const topDelta = margins.top - newTop;
    const newBottom = bottomMargin(fallbackChrome.bottomHeight, padding, xAxisHeight);
    const bottomDelta = margins.bottom - newBottom;

    if (topDelta > 0 || bottomDelta > 0) {
      const gap = legendGap(width);
      margins.top =
        newTop +
        (hasTopLegend ? TOP_LEGEND_GAP_ABOVE + legendHeight + gap : 0) +
        fallbackEffectiveAxisGap;
      margins.bottom = newBottom;

      chartArea = {
        x: margins.left,
        y: margins.top,
        width: Math.max(0, width - margins.left - margins.right),
        height: Math.max(0, height - margins.top - margins.bottom),
      };

      // Same chrome-anchored positioning as the primary path; see comment
      // near the primary `metricsTopY` for the full stacking order.
      const fallbackMetricsTopY = topPad + fallbackChrome.topHeight;
      const fallbackMetricsArea = { x: hPad, width: Math.max(0, width - hPad * 2) };
      const fallbackMetrics = wantsMetrics
        ? resolveMetrics(
            spec,
            fallbackMetricsTopY,
            fallbackMetricsArea,
            chartArea.height,
            options.measureText,
            theme,
          )
        : undefined;
      if (wantsMetrics && !fallbackMetrics) {
        // Bar was tentatively reserved but didn't fit — roll back the top margin.
        // Clamp at 0 as a defensive guard: even though the reservation was
        // additive (margins.top = topPad + chrome + tentative + axisGap [+ legend])
        // and so subtraction is mathematically safe, a negative top margin would
        // shift the chart above the SVG viewport if any future change ever
        // reordered the additions.
        margins.top = Math.max(0, margins.top - tentativeMetricsHeight);
        chartArea = {
          ...chartArea,
          y: margins.top,
          height: Math.max(0, height - margins.top - margins.bottom),
        };
      }
      return {
        total,
        chrome: fallbackChrome,
        chartArea,
        margins,
        theme,
        metrics: fallbackMetrics,
        seriesSearch: wantsSearch
          ? resolveSeriesSearch(
              spec,
              fallbackMetricsTopY + (fallbackMetrics?.height ?? 0),
              fallbackMetricsArea,
            )
          : undefined,
        xAxisHeight,
        effectiveAxisGap: fallbackEffectiveAxisGap,
      };
    }
  }

  // Vertical stacking order from the SVG top edge:
  //   topPad
  //   chrome.topHeight              (title / subtitle / eyebrow)
  //   tentativeMetricsHeight        (KPI bar — placed here)
  //   [optional top legend band     (TOP_LEGEND_GAP_ABOVE + legend + legendGap)]
  //   effectiveAxisGap              (inlineTickOverhang with a top legend,
  //                                  else axisMargin + inlineTickOverhang)
  //   chartArea
  // The metric bar belongs with chrome, above the legend, so its y is
  // computed off chrome.topHeight only — not the full legend-inclusive
  // margins.top.
  const metricsTopY = topPad + chrome.topHeight;
  const metricsArea = { x: hPad, width: Math.max(0, width - hPad * 2) };
  const resolvedMetrics = wantsMetrics
    ? resolveMetrics(spec, metricsTopY, metricsArea, chartArea.height, options.measureText, theme)
    : undefined;
  if (wantsMetrics && !resolvedMetrics) {
    // See fallback path above for the clamp rationale.
    margins.top = Math.max(0, margins.top - tentativeMetricsHeight);
    chartArea = {
      ...chartArea,
      y: margins.top,
      height: Math.max(0, height - margins.top - margins.bottom),
    };
  }
  return {
    total,
    chrome,
    chartArea,
    margins,
    theme,
    metrics: resolvedMetrics,
    seriesSearch: wantsSearch
      ? resolveSeriesSearch(spec, metricsTopY + (resolvedMetrics?.height ?? 0), metricsArea)
      : undefined,
    xAxisHeight,
    effectiveAxisGap,
  };
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

/**
 * Resolve the metric bar layout. The bar spans the full chrome content width
 * (from hPad to width - hPad), aligning with the title/eyebrow rather than
 * indenting to the chart area's left gutter. Its `y` sits directly below
 * chrome and above any top legend.
 */
function resolveMetrics(
  spec: NormalizedChartSpec,
  metricsTopY: number,
  metricsArea: { x: number; width: number },
  remainingChartHeight: number,
  measureText: import('@opendata-ai/openchart-core').MeasureTextFn | undefined,
  theme: ResolvedTheme,
): ResolvedMetricBar | undefined {
  return computeMetricBar(
    spec.metrics,
    metricsTopY,
    metricsArea,
    remainingChartHeight,
    measureText,
    metricFonts(theme),
  );
}
