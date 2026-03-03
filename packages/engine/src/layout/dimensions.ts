/**
 * Dimension computation for the chart layout.
 *
 * Takes the normalized spec + compile options + legend layout and produces
 * LayoutDimensions with the total area, chrome layout, chart drawing area,
 * and margins. The chart area is what's left after subtracting chrome,
 * legend space, and axis margins.
 */

import type {
  CompileOptions,
  Encoding,
  LegendLayout,
  Margins,
  Rect,
  ResolvedChrome,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { computeChrome, estimateTextWidth } from '@opendata-ai/openchart-core';

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
 * @returns LayoutDimensions with chart area rect.
 */
export function computeDimensions(
  spec: NormalizedChartSpec,
  options: CompileOptions,
  legendLayout: LegendLayout,
  theme: ResolvedTheme,
): LayoutDimensions {
  const { width, height } = options;

  const padding = theme.spacing.padding;
  const axisMargin = theme.spacing.axisMargin;

  // Compute chrome
  const chrome = computeChrome(chromeToInput(spec.chrome), theme, width, options.measureText);

  // Start with the total rect
  const total: Rect = { x: 0, y: 0, width, height };

  // Radial charts (pie/donut) don't have axes, so skip axis space
  const isRadial = spec.type === 'pie' || spec.type === 'donut';
  const encoding = spec.encoding as Encoding;

  // Estimate x-axis height below chart area: tick labels sit 14px below,
  // axis title sits 35px below. These extend past the chart area bottom
  // and source/footer chrome must be positioned below them.
  const hasXAxisLabel = !!(encoding.x?.axis as Record<string, unknown> | undefined)?.label;
  const xAxisHeight = isRadial ? 0 : hasXAxisLabel ? 48 : 26;

  // Build margins: padding + chrome + axis space
  const margins: Margins = {
    top: padding + chrome.topHeight + axisMargin,
    right: padding + (isRadial ? padding : axisMargin),
    bottom: padding + chrome.bottomHeight + xAxisHeight,
    left: padding + (isRadial ? padding : axisMargin),
  };

  // Dynamic right margin for line/area end-of-line labels
  if (spec.type === 'line' || spec.type === 'area') {
    // Estimate label width from longest series name (color encoding domain)
    const colorField = encoding.color?.field;
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

  // Dynamic left margin for y-axis labels
  if (encoding.y && !isRadial) {
    if (
      spec.type === 'bar' ||
      spec.type === 'dot' ||
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
      let maxAbsVal = 0;
      for (const row of spec.data) {
        const v = Number(row[yField]);
        if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
      }
      // Estimate the formatted label: abbreviateNumber for >= 1000, formatNumber otherwise
      let sampleLabel: string;
      if (maxAbsVal >= 1_000_000_000) sampleLabel = '1.5B';
      else if (maxAbsVal >= 1_000_000) sampleLabel = '1.5M';
      else if (maxAbsVal >= 1_000) sampleLabel = '1.5K';
      else if (maxAbsVal >= 100) sampleLabel = '100';
      else if (maxAbsVal >= 10) sampleLabel = '10';
      else sampleLabel = '0.0';
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
  if (encoding.y?.axis && (encoding.y.axis as Record<string, unknown>).label && !isRadial) {
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
  const chartArea: Rect = {
    x: margins.left,
    y: margins.top,
    width: Math.max(0, width - margins.left - margins.right),
    height: Math.max(0, height - margins.top - margins.bottom),
  };

  return { total, chrome, chartArea, margins, theme };
}
