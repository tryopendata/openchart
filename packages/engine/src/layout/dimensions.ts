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
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { computeChrome, estimateTextWidth } from '@opendata-ai/openchart-core';
import { format as d3Format } from 'd3-format';

import type { NormalizedChartSpec, NormalizedChrome } from '../compiler/types';

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert NormalizedChrome back to a Chrome-compatible shape for computeChrome. */
function chromeToInput(chrome: NormalizedChrome): import('@opendata-ai/openchart-core').Chrome {
  return {
    title: chrome.title,
    subtitle: chrome.subtitle,
    source: chrome.source,
    byline: chrome.byline,
    footer: chrome.footer,
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
): LayoutDimensions {
  const { width, height } = options;

  const padding = scalePadding(theme.spacing.padding, width, height);
  const axisMargin = theme.spacing.axisMargin;
  const chromeMode = strategy?.chromeMode ?? 'full';

  // Compute chrome with mode and scaled padding
  const chrome = computeChrome(
    chromeToInput(spec.chrome),
    theme,
    width,
    options.measureText,
    chromeMode,
    padding,
  );

  // Start with the total rect
  const total: Rect = { x: 0, y: 0, width, height };

  // Radial charts (arc) don't have axes, so skip axis space
  const isRadial = spec.markType === 'arc';
  const encoding = spec.encoding as Encoding;

  // Estimate x-axis height below chart area: tick labels sit 14px below,
  // axis title sits 35px below. These extend past the chart area bottom
  // and source/footer chrome must be positioned below them.
  const xAxis = encoding.x?.axis as (Record<string, unknown> & { tickAngle?: number }) | undefined;
  const hasXAxisLabel = !!xAxis?.label;
  const xTickAngle = xAxis?.tickAngle;

  let xAxisHeight: number;
  if (isRadial) {
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
  const margins: Margins = {
    top: padding + chrome.topHeight + topAxisGap,
    right: padding + (isRadial ? padding : axisMargin),
    bottom: padding + chrome.bottomHeight + xAxisHeight,
    left: padding + (isRadial ? padding : axisMargin),
  };

  // Dynamic right margin for line/area end-of-line labels.
  // Only reserve space when labels will actually render (density != 'none').
  const labelDensity = spec.labels.density;
  if ((spec.markType === 'line' || spec.markType === 'area') && labelDensity !== 'none') {
    // Estimate label width from longest series name (color encoding domain)
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
        margins.right = Math.max(margins.right, padding + maxLabelWidth + 16);
      }
    }
  }

  // Reserve right margin for text annotations near the chart's right edge.
  // Without this, annotation text at the last data point clips outside the SVG.
  if (spec.annotations.length > 0 && encoding.x) {
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
          margins.right = Math.max(margins.right, padding + textWidth + 12);
        }
      }
    }
  }

  // Dynamic left margin for y-axis labels
  if (encoding.y && !isRadial) {
    if (
      spec.markType === 'bar' ||
      spec.markType === 'circle' ||
      encoding.y.type === 'nominal' ||
      encoding.y.type === 'ordinal'
    ) {
      // Category labels on the left for bar/dot charts
      const yField = encoding.y.field;
      let maxLabelWidth = 0;
      for (const row of spec.data) {
        const label = String(row[yField] ?? '');
        const w = estimateTextWidth(label, theme.fonts.sizes.axisTick, theme.fonts.weights.normal);
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
      if (maxLabelWidth > 0) {
        margins.left = Math.max(margins.left, padding + maxLabelWidth + 12);
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
      margins.left = Math.max(margins.left, padding + labelWidth + 10);
    }
  }

  // Rotated y-axis label needs extra left margin (rendered at area.x - 45 in SVG)
  const yAxis = encoding.y?.axis as Record<string, unknown> | undefined;
  if (yAxis && (yAxis.title || yAxis.label) && !isRadial) {
    const rotatedLabelMargin = 45 + Math.ceil(theme.fonts.sizes.body / 2) + 4;
    margins.left = Math.max(margins.left, padding + rotatedLabelMargin);
  }

  // Reserve legend space
  if (legendLayout.entries.length > 0) {
    if (legendLayout.position === 'right' || legendLayout.position === 'bottom-right') {
      margins.right += legendLayout.bounds.width + 8;
    } else if (legendLayout.position === 'top') {
      margins.top += legendLayout.bounds.height + 4;
    } else if (legendLayout.position === 'bottom') {
      margins.bottom += legendLayout.bounds.height + 4;
    }
  }

  // Chart area is what's left after margins
  let chartArea: Rect = {
    x: margins.left,
    y: margins.top,
    width: Math.max(0, width - margins.left - margins.right),
    height: Math.max(0, height - margins.top - margins.bottom),
  };

  // Guardrail: if chart area is too small, progressively strip chrome
  if (
    (chartArea.width < MIN_CHART_WIDTH || chartArea.height < MIN_CHART_HEIGHT) &&
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
    );

    // Recalculate top/bottom margins with stripped chrome
    const fallbackTopAxisGap = isRadial && fallbackChrome.topHeight === 0 ? 0 : axisMargin;
    const newTop = padding + fallbackChrome.topHeight + fallbackTopAxisGap;
    const topDelta = margins.top - newTop;
    const newBottom = padding + fallbackChrome.bottomHeight + xAxisHeight;
    const bottomDelta = margins.bottom - newBottom;

    if (topDelta > 0 || bottomDelta > 0) {
      margins.top =
        newTop +
        (legendLayout.entries.length > 0 && legendLayout.position === 'top'
          ? legendLayout.bounds.height + 4
          : 0);
      margins.bottom = newBottom;

      chartArea = {
        x: margins.left,
        y: margins.top,
        width: Math.max(0, width - margins.left - margins.right),
        height: Math.max(0, height - margins.top - margins.bottom),
      };

      return { total, chrome: fallbackChrome, chartArea, margins, theme };
    }
  }

  return { total, chrome, chartArea, margins, theme };
}
