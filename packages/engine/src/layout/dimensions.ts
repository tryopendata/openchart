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
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  AXIS_TITLE_TRAILING_PAD,
  BREAKPOINT_COMPACT_MAX,
  computeChrome,
  estimateTextWidth,
  getAxisTitleOffset,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
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

import type { NormalizedChartSpec, NormalizedChrome } from '../compiler/types';
import { predictEndpointLabelsWidth } from '../endpoint-labels/predict';
import { countColorSeries, resolveSuppression } from '../legend/suppression';
import { legendGap } from '../legend/wrap';
import { computeMetricBar, metricBarHeight } from './metrics';

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
   * Height reserved below the chart area for x-axis tick labels and the
   * (optional) axis title. Exposed so downstream layout code (e.g. the
   * second legend pass) can position elements below the axis row.
   */
  xAxisHeight: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert NormalizedChrome back to a Chrome-compatible shape for computeChrome. */
function chromeToInput(chrome: NormalizedChrome): import('@opendata-ai/openchart-core').Chrome {
  return {
    eyebrow: chrome.eyebrow,
    title: chrome.title,
    subtitle: chrome.subtitle,
    source: chrome.source,
    byline: chrome.byline,
    footer: chrome.footer,
    brand: chrome.brand,
  };
}

/**
 * Scale padding based on the smaller container dimension.
 * At >= 500px, padding is unchanged. At <= 200px, padding is halved (min 4px).
 * Linear interpolation between 200-500px.
 */
function scalePadding(basePadding: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (minDim >= 500) return basePadding;
  if (minDim <= 200) return Math.max(Math.round(basePadding * 0.5), 4);
  const t = (minDim - 200) / 300;
  return Math.max(Math.round(basePadding * (0.5 + t * 0.5)), 4);
}

/** Minimum chart area dimensions before guardrails kick in. */
const MIN_CHART_WIDTH = 60;
const MIN_CHART_HEIGHT = 40;

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
 * Resolve the per-side safety padding for sparkline mode. Padding scales with
 * the user-configured mark stroke width so a thick line doesn't clip at the
 * container edge. Per-side padding = max(strokeWidth/2 + 1, 2) so even a 1px
 * stroke gets at least 2px breathing room.
 */
function getSparklinePad(spec: NormalizedChartSpec): number {
  const strokeWidth = (spec.markDef as { strokeWidth?: number }).strokeWidth ?? 2;
  const hasPoints = !!(spec.markDef as { point?: unknown }).point;
  const pointRadius = hasPoints ? 3 : 0;
  return Math.max(strokeWidth / 2 + 1, pointRadius + 1, 2);
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
  // Chart-side bottom legends only — right/top/bottom-right legends don't
  // share vertical space with bottom chrome.
  const bottomLegendReservation =
    'entries' in legendLayout &&
    legendLayout.entries.length > 0 &&
    legendLayout.position === 'bottom'
      ? legendLayout.bounds.height + legendGap(width)
      : 0;

  // Compute chrome with mode and scaled padding. `bottomLegendReservation`
  // pushes bottom chrome below the legend band; the returned bottomHeight
  // already accounts for it, so margin math below must not re-add it.
  const chrome = computeChrome(
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
      top: chrome.topHeight + sparkPad,
      right: sparkPad,
      bottom: chrome.bottomHeight + sparkPad + xAxisSpace,
      left: sparkPad + yAxisSpace,
    };

    // Reserve legend space only when user explicitly opted into a legend.
    if (userExplicit.legend && 'entries' in legendLayout && legendLayout.entries.length > 0) {
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

    return { total, chrome, chartArea, margins, theme, xAxisHeight: xAxisSpace };
  }

  // Start with the total rect
  const total: Rect = { x: 0, y: 0, width, height };

  // Radial charts (arc) don't have axes, so skip axis space
  const isRadial = spec.markType === 'arc';
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
  if (isRadial || xAxisSuppressed) {
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
    xAxisHeight = hasXAxisLabel ? 48 : 26;
  }

  // Build margins: padding + chrome + axis space.
  // For radial charts (arc/donut), axes don't exist, so axisMargin is only
  // added when there's actual chrome content that needs separation from the
  // chart area. When chrome is empty the margin is just padding.
  const topAxisGap = isRadial && chrome.topHeight === 0 ? 0 : axisMargin;
  // Extra top padding on narrow viewports prevents iOS Safari from clipping
  // the title chrome behind the browser UI.
  const topPad = width < NARROW_VIEWPORT_MAX ? padding + TOP_PAD_EXTRA_NARROW : padding;
  // Tentative metric-bar reservation. The bar's final inclusion is decided
  // below by computeMetricBar, which can strip it on overflow / narrow areas.
  // We reserve optimistically so the chart-area math is correct when the bar
  // is kept; the rollback path subtracts it back when stripped.
  const wantsMetrics = !!spec.metrics && spec.metrics.length > 0 && chromeMode !== 'hidden';
  const tentativeMetricsHeight = wantsMetrics ? metricBarHeight() : 0;
  const margins: Margins = {
    top: topPad + chrome.topHeight + tentativeMetricsHeight + topAxisGap,
    right: hPad + (isRadial ? hPad : axisMargin),
    bottom: padding + chrome.bottomHeight + xAxisHeight,
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
  });

  // (1) Endpoint-labels column reservation. predictEndpointLabelsWidth returns 0
  // when the column would be suppressed. `labels.density` is intentionally
  // not checked here — that switch controls only the legacy end-of-line labels.
  let endpointWidth = 0;
  if (sup.showEndpointLabels && !labelsHiddenByStrategy) {
    endpointWidth = predictEndpointLabelsWidth(spec, theme);
    if (endpointWidth > 0) {
      // 16px gap between chart area edge and the column.
      margins.right = Math.max(margins.right, hPad) + endpointWidth + 16;
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

  // Dynamic left margin for y-axis labels
  const yAxisSuppressed = encoding.y?.axis === false;
  // Resolve effective y-axis tickPosition. Editorial line/area y-axes default
  // to inline (labels render above gridlines inside the chart area, so no
  // left gutter is reserved). Other marks default to gutter.
  const yAxisCfg = (encoding.y?.axis as Record<string, unknown> | undefined) ?? undefined;
  const yTickPositionExplicit = yAxisCfg?.tickPosition as 'inline' | 'gutter' | undefined;
  const yIsContinuous = encoding.y?.type === 'quantitative' || encoding.y?.type === 'temporal';
  const yIsLineOrArea = spec.markType === 'line' || spec.markType === 'area';
  const yAxisOrient = yAxisCfg?.orient as 'left' | 'right' | 'top' | 'bottom' | undefined;
  const yTickPosition: 'inline' | 'gutter' =
    yTickPositionExplicit ??
    (yIsLineOrArea && yIsContinuous && yAxisOrient !== 'right' ? 'inline' : 'gutter');
  const yIsInline = yTickPosition === 'inline';
  if (encoding.y && !isRadial && !yAxisSuppressed && !yIsInline) {
    if (
      spec.markType === 'bar' ||
      spec.markType === 'circle' ||
      spec.markType === 'lollipop' ||
      encoding.y.type === 'nominal' ||
      encoding.y.type === 'ordinal'
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
    } else if (encoding.y.type === 'quantitative' || encoding.y.type === 'temporal') {
      // Numeric tick labels on the left. Estimate width from the data range.
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
  // Tighter on compact viewports where horizontal space is scarce.
  const yAxis = encoding.y?.axis as Record<string, unknown> | undefined;
  if (yAxis && (yAxis.title || yAxis.label) && !isRadial) {
    const axisTitleOffset = getAxisTitleOffset(width);
    const halfGlyph = Math.ceil(theme.fonts.sizes.body / 2);
    const rotatedLabelMargin =
      axisTitleOffset + halfGlyph + (width < BREAKPOINT_COMPACT_MAX ? 0 : AXIS_TITLE_TRAILING_PAD);
    margins.left = Math.max(margins.left, hPad + rotatedLabelMargin);
  }

  // Reserve space for a secondary (right) y-axis in dual-axis charts.
  // Use Math.max (not +=) to mirror the left-margin pattern: the reserve
  // replaces the base axisMargin when it's larger, instead of stacking.
  if (options.rightAxisReserve && options.rightAxisReserve > 0) {
    margins.right = Math.max(margins.right, hPad + options.rightAxisReserve);
  }

  // Reserve legend space.
  //
  // Bottom legend: reservation is already baked into `chrome.bottomHeight`
  // via `bottomLegendReservation`, so no additional bottom margin is needed
  // here. The legend lands below the x-axis tick row (which is reserved via
  // `xAxisHeight` in the base bottom margin) and source/byline/footer chrome
  // stacks underneath the legend band rather than colliding with it.
  if ('entries' in legendLayout && legendLayout.entries.length > 0) {
    const gap = legendGap(width);
    if (legendLayout.position === 'right' || legendLayout.position === 'bottom-right') {
      margins.right += legendLayout.bounds.width + 8;
    } else if (legendLayout.position === 'top') {
      margins.top += legendLayout.bounds.height + gap;
    }
    // 'bottom' is intentionally not handled here — see bottomLegendReservation
    // above.
  }

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
    const fallbackTopAxisGap = isRadial && fallbackChrome.topHeight === 0 ? 0 : axisMargin;
    const newTop = topPad + fallbackChrome.topHeight + fallbackTopAxisGap + tentativeMetricsHeight;
    const topDelta = margins.top - newTop;
    const newBottom = padding + fallbackChrome.bottomHeight + xAxisHeight;
    const bottomDelta = margins.bottom - newBottom;

    if (topDelta > 0 || bottomDelta > 0) {
      const gap = legendGap(width);
      margins.top =
        newTop +
        ('entries' in legendLayout &&
        legendLayout.entries.length > 0 &&
        legendLayout.position === 'top'
          ? legendLayout.bounds.height + gap
          : 0);
      margins.bottom = newBottom;

      chartArea = {
        x: margins.left,
        y: margins.top,
        width: Math.max(0, width - margins.left - margins.right),
        height: Math.max(0, height - margins.top - margins.bottom),
      };

      const fallbackMetricsTopY = topPad + fallbackChrome.topHeight;
      const fallbackMetricsArea = { x: hPad, width: Math.max(0, width - hPad * 2) };
      const fallbackMetrics = wantsMetrics
        ? resolveMetrics(
            spec,
            fallbackMetricsTopY,
            fallbackMetricsArea,
            chartArea.height,
            options.measureText,
          )
        : undefined;
      if (wantsMetrics && !fallbackMetrics) {
        // Bar was tentatively reserved but didn't fit — roll back the top margin.
        margins.top -= tentativeMetricsHeight;
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
        xAxisHeight,
      };
    }
  }

  const metricsTopY = topPad + chrome.topHeight;
  const metricsArea = { x: hPad, width: Math.max(0, width - hPad * 2) };
  const resolvedMetrics = wantsMetrics
    ? resolveMetrics(spec, metricsTopY, metricsArea, chartArea.height, options.measureText)
    : undefined;
  if (wantsMetrics && !resolvedMetrics) {
    margins.top -= tentativeMetricsHeight;
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
    xAxisHeight,
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
): ResolvedMetricBar | undefined {
  return computeMetricBar(
    spec.metrics,
    metricsTopY,
    metricsArea,
    remainingChartHeight,
    measureText,
  );
}
