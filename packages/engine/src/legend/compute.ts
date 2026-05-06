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
import { BRAND_RESERVE_WIDTH, COMPACT_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import { countColorSeries, resolveSuppression } from './suppression';
import { ENTRY_GAP, ENTRY_GAP_COMPACT, measureLegendWrap, SWATCH_GAP, SWATCH_SIZE } from './wrap';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEGEND_PADDING = 8;
const LEGEND_RIGHT_WIDTH = 120;

/** Max fraction of chart area height for right-positioned legends. */
const RIGHT_LEGEND_MAX_HEIGHT_RATIO = 0.4;

/** Max number of rows for top-positioned legends before truncation. */
const TOP_LEGEND_MAX_ROWS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the constant fields every CategoricalLegendLayout return shares
 * (swatch geometry + chip fill). Pulled out so each early-return branch
 * doesn't re-spell the same five fields.
 */
function categoricalDefaults(theme: ResolvedTheme): {
  swatchSize: number;
  swatchGap: number;
  entryGap: number;
  swatchChipFill: string;
} {
  return {
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
    swatchChipFill: theme.colors.annotationFill,
  };
}

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

  const dataValues = [...new Set(spec.data.map((d) => String(d[colorEnc.field])))];
  const explicitDomain = colorEnc.scale?.domain as string[] | undefined;
  const explicitRange = colorEnc.scale?.range as string[] | undefined;
  const palette = explicitRange ?? theme.colors.categorical;
  const shape = swatchShapeForType(spec.markType);

  // Order legend entries by explicit domain when provided so the author
  // controls which entries render first (and which get truncated last when
  // symbolLimit applies). Without explicit domain, preserve data order.
  const uniqueValues = explicitDomain
    ? [
        ...explicitDomain.filter((v) => dataValues.includes(v)),
        ...dataValues.filter((v) => !explicitDomain.includes(v)),
      ]
    : dataValues;

  const excludeSet = new Set(spec.legend?.exclude ?? []);
  // Hidden series stay in the legend (dimmed) so the user can toggle them
  // back on. `active: false` is the renderer's signal to apply the dimmed
  // visual state.
  const hiddenSet = new Set(spec.hiddenSeries);

  return uniqueValues
    .map((value, i) => {
      // When explicit domain+range are provided, look up the color by domain index
      // so legend colors match the mark colors exactly.
      let colorIndex = i;
      if (explicitDomain && explicitRange) {
        const domainIdx = explicitDomain.indexOf(value);
        if (domainIdx >= 0) colorIndex = domainIdx;
      }
      return {
        label: value,
        color: palette[colorIndex % palette.length],
        shape,
        active: !hiddenSet.has(value),
      };
    })
    .filter((entry) => !excludeSet.has(entry.label));
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
  watermark: boolean = true,
): LegendLayout {
  // Sparkline mode: legend hidden by default unless the user opted in. Color
  // scales still resolve normally (legend hidden != no colors), so multi-series
  // sparklines retain their categorical palette.
  const sparklineHidden = spec.display === 'sparkline' && !spec.userExplicit.legend;

  // Legend explicitly hidden via show: false, or height strategy says no legend
  if (sparklineHidden || spec.legend?.show === false || strategy.legendMaxHeight === 0) {
    return {
      type: 'categorical' as const,
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
      ...categoricalDefaults(theme),
    };
  }

  let entries = extractColorEntries(spec, theme);

  // Consult the shared suppression truth table so the legend, endpoint column,
  // and end-of-line labels stay in sync. The helper returns
  // `showTraditionalLegend: false` when the endpoint column auto-takes over
  // for ≥2-series line/area charts (and the user hasn't forced the legend on).
  const seriesCount = countColorSeries(spec);
  const suppression = resolveSuppression(spec, {
    seriesCount,
    labelsHiddenByStrategy: strategy.labelMode === 'none',
    labelsDensityNone: spec.labels.density === 'none',
  });
  if (!suppression.showTraditionalLegend) {
    entries = [];
  }

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
      type: 'categorical' as const,
      position: resolvedPosition,
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle,
      ...categoricalDefaults(theme),
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
    // symbolLimit overrides the space-based limit when explicitly set (minimum 1)
    const maxEntries =
      spec.legend?.symbolLimit != null ? Math.max(1, spec.legend.symbolLimit) : maxFromSpace;
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
      type: 'categorical' as const,
      position: resolvedPosition,
      entries,
      bounds: {
        x: chartArea.x + chartArea.width - legendWidth + offsetDx,
        y: legendY + offsetDy,
        width: legendWidth,
        height: clampedHeight,
      },
      labelStyle,
      ...categoricalDefaults(theme),
      // Right-positioned legends pack rows tighter than the default entryGap
      // because each row is its own swatch+label and the gap controls
      // vertical breathing room rather than horizontal spacing.
      entryGap: 4,
    };
  }

  // Top/bottom-positioned legend: horizontal flow with overflow protection.
  // Reserve space on the right for bottom legends so they don't overlap the brand
  // watermark. Top legends don't need this since the brand renders at the bottom.
  const reserveBrand = watermark && resolvedPosition === 'bottom';
  // Tighten gaps on narrow viewports so horizontal legends keep fitting on one row.
  const isCompact = chartArea.width < COMPACT_WIDTH;
  const effectivePadding = isCompact ? 2 : LEGEND_PADDING;
  const effectiveEntryGap = isCompact ? ENTRY_GAP_COMPACT : ENTRY_GAP;
  const availableWidth =
    chartArea.width - effectivePadding * 2 - (reserveBrand ? BRAND_RESERVE_WIDTH : 0);

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
  const { fittingCount } = measureLegendWrap(
    entries,
    availableWidth,
    labelStyle,
    maxRows,
    effectiveEntryGap,
  );

  if (fittingCount < entries.length) {
    entries = truncateEntries(entries, fittingCount);
  }

  const totalWidth = entries.reduce((sum, entry) => {
    const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    return sum + SWATCH_SIZE + SWATCH_GAP + labelWidth + effectiveEntryGap;
  }, 0);

  // Calculate actual row count for height (recompute after truncation).
  const { rowCount } = measureLegendWrap(
    entries,
    availableWidth,
    labelStyle,
    undefined,
    effectiveEntryGap,
  );

  const rowHeight = SWATCH_SIZE + 4;
  const legendHeight = rowCount * rowHeight + effectivePadding * 2;

  // Apply user-provided legend offset
  const offsetDx = spec.legend?.offset?.dx ?? 0;
  const offsetDy = spec.legend?.offset?.dy ?? 0;

  return {
    type: 'categorical' as const,
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
    ...categoricalDefaults(theme),
    // Top/bottom legends honor the compact-viewport-aware entry gap so
    // chips stay readable on narrow widths.
    entryGap: effectiveEntryGap,
  };
}
