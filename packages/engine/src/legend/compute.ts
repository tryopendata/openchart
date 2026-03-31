/**
 * Legend computation.
 *
 * Derives legend entries from the color encoding's unique values in data,
 * computes position based on layout strategy, and returns a LegendLayout
 * that dimensions.ts uses to reserve space in the chart area.
 *
 * The legend is computed early (before marks) so the chartArea accounts
 * for legend space. Entries come from data + encoding, not marks.
 *
 * Overflow protection: when there are too many entries for the available
 * space, entries are truncated and a "+N more" indicator is appended.
 */

import type {
  LayoutStrategy,
  LegendEntry,
  LegendLayout,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { BRAND_RESERVE_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;
const LEGEND_PADDING = 8;
const LEGEND_RIGHT_WIDTH = 120;

/** Max fraction of chart area height for right-positioned legends. */
const RIGHT_LEGEND_MAX_HEIGHT_RATIO = 0.4;

/** Max number of rows for top-positioned legends before truncation. */
const TOP_LEGEND_MAX_ROWS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine the swatch shape based on mark type. */
function swatchShapeForType(markType: string): LegendEntry['shape'] {
  switch (markType) {
    case 'line':
      return 'line';
    case 'point':
    case 'circle':
    case 'lollipop':
      return 'circle';
    default:
      return 'square';
  }
}

/** Extract unique color values from data based on the color encoding. */
function extractColorEntries(spec: NormalizedChartSpec, theme: ResolvedTheme): LegendEntry[] {
  const colorEnc = spec.encoding.color;
  if (!colorEnc) return [];

  // Conditional color definitions don't produce legend entries
  if ('condition' in colorEnc) return [];

  // Sequential (quantitative) color doesn't produce discrete legend entries
  if (colorEnc.type === 'quantitative') return [];

  const uniqueValues = [...new Set(spec.data.map((d) => String(d[colorEnc.field])))];
  const palette = theme.colors.categorical;
  const shape = swatchShapeForType(spec.markType);

  return uniqueValues.map((value, i) => ({
    label: value,
    color: palette[i % palette.length],
    shape,
    active: true,
  }));
}

/**
 * Calculate how many entries fit within a given number of horizontal rows.
 */
function entriesThatFit(
  entries: LegendEntry[],
  maxWidth: number,
  maxRows: number,
  labelStyle: TextStyle,
): number {
  let row = 1;
  let rowWidth = 0;

  for (let i = 0; i < entries.length; i++) {
    const labelWidth = estimateTextWidth(
      entries[i].label,
      labelStyle.fontSize,
      labelStyle.fontWeight,
    );
    const entryWidth = SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;

    if (rowWidth + entryWidth > maxWidth && rowWidth > 0) {
      row++;
      rowWidth = entryWidth;
      if (row > maxRows) return i;
    } else {
      rowWidth += entryWidth;
    }
  }

  return entries.length;
}

/**
 * Truncate entries and add a "+N more" indicator if needed.
 */
function truncateEntries(entries: LegendEntry[], maxCount: number): LegendEntry[] {
  if (maxCount >= entries.length || maxCount <= 0) return entries;

  const truncated = entries.slice(0, maxCount);
  const remaining = entries.length - maxCount;
  truncated.push({
    label: `+${remaining} more`,
    color: '#999999',
    shape: 'square',
    active: false,
    overflow: true,
  });

  return truncated;
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
  // Legend explicitly hidden via show: false, or height strategy says no legend
  if (spec.legend?.show === false || strategy.legendMaxHeight === 0) {
    return {
      position: 'top',
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle: {
        fontFamily: theme.fonts.family,
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.normal,
        fill: theme.colors.text,
        lineHeight: 1.3,
      },
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: ENTRY_GAP,
    };
  }

  let entries = extractColorEntries(spec, theme);

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

    // Apply max height ratio (default 40% of chart area, strategy can override)
    const maxHeightRatio =
      strategy.legendMaxHeight > 0 ? strategy.legendMaxHeight : RIGHT_LEGEND_MAX_HEIGHT_RATIO;
    const maxLegendHeight = chartArea.height * maxHeightRatio;

    // Calculate how many entries fit
    const maxFromSpace = Math.max(
      1,
      Math.floor((maxLegendHeight - LEGEND_PADDING * 2) / (entryHeight + 4)),
    );
    // symbolLimit overrides the space-based limit when set (minimum 1)
    const maxEntries =
      spec.legend?.symbolLimit != null
        ? Math.min(Math.max(1, spec.legend.symbolLimit), maxFromSpace)
        : maxFromSpace;
    if (entries.length > maxEntries) {
      entries = truncateEntries(entries, maxEntries);
    }

    const legendHeight =
      entries.length * entryHeight + (entries.length - 1) * 4 + LEGEND_PADDING * 2;
    const clampedHeight = Math.min(legendHeight, chartArea.height);

    // bottom-right anchors to the bottom of the chart area
    const legendY =
      resolvedPosition === 'bottom-right'
        ? chartArea.y + chartArea.height - clampedHeight
        : chartArea.y;

    // Apply user-provided legend offset
    const offsetDx = spec.legend?.offset?.dx ?? 0;
    const offsetDy = spec.legend?.offset?.dy ?? 0;

    return {
      position: resolvedPosition,
      entries,
      bounds: {
        x: chartArea.x + chartArea.width - legendWidth + offsetDx,
        y: legendY + offsetDy,
        width: legendWidth,
        height: clampedHeight,
      },
      labelStyle,
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: 4,
    };
  }

  // Top/bottom-positioned legend: horizontal flow with overflow protection.
  // Reserve space on the right so legend entries don't overlap the brand watermark.
  const availableWidth = chartArea.width - LEGEND_PADDING * 2 - BRAND_RESERVE_WIDTH;

  // Apply symbolLimit first if set (minimum 1), then fit remaining entries to available rows.
  if (spec.legend?.symbolLimit != null) {
    const limit = Math.max(1, spec.legend.symbolLimit);
    if (limit < entries.length) {
      entries = truncateEntries(entries, limit);
    }
  }

  // Resolve max rows: explicit maxRows wins, then columns-derived, then default.
  const maxRows =
    spec.legend?.maxRows != null
      ? Math.max(1, spec.legend.maxRows)
      : spec.legend?.columns != null
        ? Math.ceil(entries.length / spec.legend.columns)
        : TOP_LEGEND_MAX_ROWS;
  const maxFit = entriesThatFit(entries, availableWidth, maxRows, labelStyle);

  if (maxFit < entries.length) {
    entries = truncateEntries(entries, maxFit);
  }

  const totalWidth = entries.reduce((sum, entry) => {
    const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    return sum + SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;
  }, 0);

  // Calculate actual row count for height
  let rowCount = 1;
  let rowWidth = 0;
  for (const entry of entries) {
    const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    const entryWidth = SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;
    if (rowWidth + entryWidth > availableWidth && rowWidth > 0) {
      rowCount++;
      rowWidth = entryWidth;
    } else {
      rowWidth += entryWidth;
    }
  }

  const rowHeight = SWATCH_SIZE + 4;
  const legendHeight = rowCount * rowHeight + LEGEND_PADDING * 2;

  // Apply user-provided legend offset
  const offsetDx = spec.legend?.offset?.dx ?? 0;
  const offsetDy = spec.legend?.offset?.dy ?? 0;

  return {
    position: resolvedPosition,
    entries,
    bounds: {
      x: chartArea.x + offsetDx,
      y:
        (resolvedPosition === 'bottom'
          ? chartArea.y + chartArea.height - legendHeight
          : chartArea.y) + offsetDy,
      width: Math.min(totalWidth, availableWidth),
      height: legendHeight,
    },
    labelStyle,
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
  };
}
