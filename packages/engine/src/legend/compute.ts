/**
 * Legend computation.
 *
 * Derives legend entries from the color encoding's unique values in data,
 * computes position based on layout strategy, and returns a LegendLayout
 * that dimensions.ts uses to reserve space in the chart area.
 *
 * The legend is computed early (before marks) so the chartArea accounts
 * for legend space. Entries come from data + encoding, not marks.
 */

import type {
  LayoutStrategy,
  LegendEntry,
  LegendLayout,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/core';
import { estimateTextWidth } from '@opendata-ai/core';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;
const LEGEND_PADDING = 8;
const LEGEND_RIGHT_WIDTH = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine the swatch shape based on chart type. */
function swatchShapeForType(chartType: string): LegendEntry['shape'] {
  switch (chartType) {
    case 'line':
      return 'line';
    case 'scatter':
    case 'dot':
      return 'circle';
    default:
      return 'square';
  }
}

/** Extract unique color values from data based on the color encoding. */
function extractColorEntries(spec: NormalizedChartSpec, theme: ResolvedTheme): LegendEntry[] {
  const colorEnc = spec.encoding.color;
  if (!colorEnc) return [];

  // Sequential (quantitative) color doesn't produce discrete legend entries
  if (colorEnc.type === 'quantitative') return [];

  const uniqueValues = [...new Set(spec.data.map((d) => String(d[colorEnc.field])))];
  const palette = theme.colors.categorical;
  const shape = swatchShapeForType(spec.type);

  return uniqueValues.map((value, i) => ({
    label: value,
    color: palette[i % palette.length],
    shape,
    active: true,
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute legend layout for a chart spec.
 *
 * @param spec - Normalized chart spec.
 * @param strategy - Responsive layout strategy.
 * @param theme - Resolved theme.
 * @param chartArea - The available chart area (before legend space is reserved).
 * @returns LegendLayout with position, entries, and bounds.
 */
export function computeLegend(
  spec: NormalizedChartSpec,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  chartArea: Rect,
): LegendLayout {
  const entries = extractColorEntries(spec, theme);

  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };

  // Resolve position: spec-level override wins, then responsive strategy
  const resolvedPosition =
    spec.legend?.position ?? (strategy.legendPosition === 'right' ? 'right' : 'top');

  // No entries = empty legend with no space
  if (entries.length === 0) {
    return {
      position: resolvedPosition,
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle,
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: ENTRY_GAP,
    };
  }

  if (resolvedPosition === 'right' || resolvedPosition === 'bottom-right') {
    // Right-positioned legend: vertical stack
    const maxLabelWidth = Math.max(
      ...entries.map((e) => estimateTextWidth(e.label, labelStyle.fontSize, labelStyle.fontWeight)),
    );
    const legendWidth = Math.min(
      LEGEND_RIGHT_WIDTH,
      SWATCH_SIZE + SWATCH_GAP + maxLabelWidth + LEGEND_PADDING * 2,
    );
    const entryHeight = Math.max(SWATCH_SIZE, labelStyle.fontSize * labelStyle.lineHeight);
    const legendHeight =
      entries.length * entryHeight + (entries.length - 1) * 4 + LEGEND_PADDING * 2;
    const clampedHeight = Math.min(legendHeight, chartArea.height);

    // bottom-right anchors to the bottom of the chart area
    const legendY =
      resolvedPosition === 'bottom-right'
        ? chartArea.y + chartArea.height - clampedHeight
        : chartArea.y;

    return {
      position: resolvedPosition,
      entries,
      bounds: {
        x: chartArea.x + chartArea.width - legendWidth,
        y: legendY,
        width: legendWidth,
        height: clampedHeight,
      },
      labelStyle,
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: 4,
    };
  }

  // Top/bottom-positioned legend: horizontal flow
  const totalWidth = entries.reduce((sum, entry) => {
    const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    return sum + SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;
  }, 0);

  const legendHeight = SWATCH_SIZE + LEGEND_PADDING * 2;

  return {
    position: resolvedPosition,
    entries,
    bounds: {
      x: chartArea.x,
      y:
        resolvedPosition === 'bottom' ? chartArea.y + chartArea.height - legendHeight : chartArea.y,
      width: Math.min(totalWidth, chartArea.width),
      height: legendHeight,
    },
    labelStyle,
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
  };
}
