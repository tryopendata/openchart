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
 *
 * The computation is split into two phases:
 * - `computeLegendContent`: everything width-dependent (entry derivation,
 *   truncation, wrapping, row count, dimensions). No chart-area positioning.
 * - `placeLegend`: pure placement (computes `bounds` from chartArea).
 *
 * `computeLegend` is a thin compat wrapper that calls both.
 */

import type {
  LayoutStrategy,
  LegendEntry,
  LegendEntryPosition,
  LegendLayout,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { BRAND_RESERVE_WIDTH, COMPACT_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import type { MeasureFn } from '../layout/plan';
import { countColorSeries, resolveSuppression } from './suppression';
import {
  ENTRY_GAP,
  ENTRY_GAP_COMPACT,
  legendGap,
  measureLegendWrap,
  SWATCH_GAP,
  SWATCH_SIZE,
} from './wrap';

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
// LegendContent -- pre-computed content before placement
// ---------------------------------------------------------------------------

/** Pre-computed legend content produced before final layout. */
export interface LegendContent {
  entries: LegendEntry[];
  position: 'top' | 'bottom' | 'right' | 'bottom-right' | 'inline';
  labelStyle: TextStyle;
  rowCount: number;
  totalWidth: number;
  height: number;
  entryGap: number;
  swatchSize: number;
  swatchGap: number;
  swatchChipFill: string;
  /** Width of the legend box (for right legends this is the column width). */
  legendWidth: number;
  /** User-provided legend offset, threaded through for placement. */
  offset?: { dx?: number; dy?: number };
  /** Relative entry positions (origin 0,0). Offset by bounds in placeLegend. */
  relativePositions?: LegendEntryPosition[];
  /** Row advance used to build entry positions. */
  rowHeight?: number;
}

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

function resolveEntryPositions(
  relative: LegendEntryPosition[] | undefined,
  bounds: Rect,
): LegendEntryPosition[] | undefined {
  if (!relative) return undefined;
  return relative.map((p) => ({
    x: p.x + bounds.x,
    y: p.y + bounds.y,
    labelX: p.labelX + bounds.x,
    labelY: p.labelY + bounds.y,
    width: p.width,
    row: p.row,
  }));
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

  // Bare value defs (constant colors) don't produce legend entries either
  if (!('field' in colorEnc)) return [];

  // Sequential (quantitative) color doesn't produce discrete legend entries
  if (colorEnc.type === 'quantitative') return [];

  // Rows missing the color field (e.g. a sibling layer in a layered spec whose
  // marks don't participate in the color encoding) must not manufacture a legend
  // category. Without this guard, `String(undefined)` seeds a phantom "undefined"
  // entry and — with an explicit domain — appends it past the authored entries.
  const dataValues = [
    ...new Set(
      spec.data.filter((d) => d[colorEnc.field] != null).map((d) => String(d[colorEnc.field])),
    ),
  ];
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

/** Build an empty LegendContent for suppressed/hidden legends. */
function emptyContent(position: LegendContent['position'], theme: ResolvedTheme): LegendContent {
  return {
    entries: [],
    position,
    labelStyle: {
      fontFamily: theme.fonts.family,
      fontSize: theme.fonts.sizes.small,
      fontWeight: theme.fonts.weights.normal,
      fill: theme.colors.text,
      lineHeight: 1.3,
    },
    rowCount: 0,
    totalWidth: 0,
    height: 0,
    legendWidth: 0,
    ...categoricalDefaults(theme),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute legend content (entries, dimensions, wrapping) without placement.
 *
 * This is the "measure" half of legend computation. It determines which
 * entries to show, how they wrap/truncate, and the resulting dimensions,
 * but does not compute a bounding box in chart coordinates.
 *
 * @param spec - Normalized chart spec.
 * @param strategy - Responsive layout strategy.
 * @param theme - Resolved theme.
 * @param availableWidth - Width constraint for layout (e.g. chartArea.width).
 * @param availableHeight - Height constraint for right-legend truncation.
 * @param watermark - Whether the brand watermark is shown (reserves space for bottom legends).
 * @param measure - Optional text measurement function; defaults to estimateTextWidth.
 * @returns LegendContent with entries, dimensions, but no bounds.
 */
export function computeLegendContent(
  spec: NormalizedChartSpec,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  availableWidth: number,
  availableHeight: number,
  watermark: boolean = true,
  measure?: MeasureFn,
  endpointLabelsDemoted?: boolean,
): LegendContent {
  const measureWidth = measure ?? estimateTextWidth;

  // Sparkline mode: legend hidden by default unless the user opted in. Color
  // scales still resolve normally (legend hidden != no colors), so multi-series
  // sparklines retain their categorical palette.
  const sparklineHidden = spec.display === 'sparkline' && !spec.userExplicit.legend;

  // Legend explicitly hidden via show: false, or height strategy says no legend
  if (sparklineHidden || spec.legend?.show === false || strategy.legendMaxHeight === 0) {
    return emptyContent('top', theme);
  }

  let entries = extractColorEntries(spec, theme);

  // Consult the shared suppression truth table so the legend, endpoint column,
  // and end-of-line labels stay in sync. The helper returns
  // `showTraditionalLegend: false` when the endpoint column auto-takes over
  // for >=2-series line/area charts (and the user hasn't forced the legend on).
  const seriesCount = countColorSeries(spec);
  const suppression = resolveSuppression(spec, {
    seriesCount,
    labelsHiddenByStrategy: strategy.labelMode === 'none',
    labelsDensityNone: spec.labels.density === 'none',
    endpointLabelsDemoted,
  });
  if (!suppression.showTraditionalLegend) {
    entries = [];
  }

  // Bar/column/lollipop redundancy rule: when color.field matches the category
  // axis field, the legend just repeats the axis labels. Hide it unless the
  // user explicitly configured the legend.
  const hasRedundantLegend = spec.markType === 'bar' || spec.markType === 'lollipop';
  if (hasRedundantLegend && entries.length > 0 && !spec.userExplicit?.legend) {
    const colorEnc = spec.encoding.color;
    const colorField = colorEnc && 'field' in colorEnc ? colorEnc.field : undefined;
    if (colorField) {
      const categoryField =
        spec.encoding.y?.type === 'quantitative' ? spec.encoding.x?.field : spec.encoding.y?.field;
      if (colorField === categoryField) {
        entries = [];
      }
    }
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
    return emptyContent(resolvedPosition, theme);
  }

  const offset = spec.legend?.offset;

  if (resolvedPosition === 'right' || resolvedPosition === 'bottom-right') {
    // Right-positioned legend: vertical stack
    const maxLabelWidth = Math.max(
      ...entries.map((e) => measureWidth(e.label, labelStyle.fontSize, labelStyle.fontWeight)),
    );
    const legendWidth = Math.min(
      LEGEND_RIGHT_WIDTH,
      SWATCH_SIZE + SWATCH_GAP + maxLabelWidth + LEGEND_PADDING * 2,
    );
    const entryHeight = Math.max(SWATCH_SIZE, labelStyle.fontSize * labelStyle.lineHeight);

    // Apply max height ratio (default 40% of chart area, strategy can override)
    const maxHeightRatio =
      strategy.legendMaxHeight > 0 ? strategy.legendMaxHeight : RIGHT_LEGEND_MAX_HEIGHT_RATIO;
    const maxLegendHeight = availableHeight * maxHeightRatio;

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
    const clampedHeight = Math.min(legendHeight, availableHeight);

    const rightEntryGap = 4;
    const relativePositions: LegendEntryPosition[] = [];
    for (let i = 0; i < entries.length; i++) {
      const ex = 0;
      const ey = i * (entryHeight + rightEntryGap);
      const labelWidth = measureWidth(entries[i].label, labelStyle.fontSize, labelStyle.fontWeight);
      relativePositions.push({
        x: ex,
        y: ey,
        labelX: ex + SWATCH_SIZE + SWATCH_GAP,
        labelY: ey + SWATCH_SIZE / 2,
        width: SWATCH_SIZE + SWATCH_GAP + labelWidth + rightEntryGap,
        row: i,
      });
    }

    return {
      entries,
      position: resolvedPosition,
      labelStyle,
      rowCount: entries.length,
      totalWidth: legendWidth,
      height: clampedHeight,
      legendWidth,
      offset,
      ...categoricalDefaults(theme),
      entryGap: rightEntryGap,
      relativePositions,
      rowHeight: entryHeight + rightEntryGap,
    };
  }

  // Top/bottom-positioned legend: horizontal flow with overflow protection.
  // Reserve space on the right for bottom legends so they don't overlap the brand
  // watermark. Top legends don't need this since the brand renders at the bottom.
  const reserveBrand = watermark && resolvedPosition === 'bottom';
  // Tighten gaps on narrow viewports so horizontal legends keep fitting on one row.
  const isCompact = availableWidth < COMPACT_WIDTH;
  const effectivePadding = isCompact ? 2 : LEGEND_PADDING;
  const effectiveEntryGap = isCompact ? ENTRY_GAP_COMPACT : ENTRY_GAP;
  const contentWidth =
    availableWidth - effectivePadding * 2 - (reserveBrand ? BRAND_RESERVE_WIDTH : 0);

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
    contentWidth,
    labelStyle,
    maxRows,
    effectiveEntryGap,
    measureWidth,
  );

  if (fittingCount < entries.length) {
    entries = truncateEntries(entries, fittingCount);
  }

  const totalWidth = entries.reduce((sum, entry) => {
    const labelWidth = measureWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    return sum + SWATCH_SIZE + SWATCH_GAP + labelWidth + effectiveEntryGap;
  }, 0);

  // Calculate actual row count for height (recompute after truncation).
  const finalWrap = measureLegendWrap(
    entries,
    contentWidth,
    labelStyle,
    undefined,
    effectiveEntryGap,
    measureWidth,
  );
  const { rowCount } = finalWrap;

  const rowHeight = SWATCH_SIZE + 4;
  const legendHeight = rowCount * rowHeight + effectivePadding * 2;

  // Build relative positions (origin 0,0), offset by bounds in placeLegend
  const relativePositions: LegendEntryPosition[] = [];
  for (let i = 0; i < entries.length; i++) {
    const placement = finalWrap.placements[i];
    if (!placement) break;
    const ex = placement.xOffset;
    const ey = placement.row * rowHeight;
    const labelWidth = measureWidth(entries[i].label, labelStyle.fontSize, labelStyle.fontWeight);
    relativePositions.push({
      x: ex,
      y: ey,
      labelX: ex + SWATCH_SIZE + SWATCH_GAP,
      labelY: ey + SWATCH_SIZE / 2,
      width: SWATCH_SIZE + SWATCH_GAP + labelWidth + effectiveEntryGap,
      row: placement.row,
    });
  }

  return {
    entries,
    position: resolvedPosition,
    labelStyle,
    rowCount,
    totalWidth,
    height: legendHeight,
    legendWidth: Math.min(totalWidth, contentWidth),
    offset,
    ...categoricalDefaults(theme),
    entryGap: effectiveEntryGap,
    relativePositions,
    rowHeight,
  };
}

/**
 * Place a pre-computed legend into chart coordinates.
 *
 * This is the "layout" half of legend computation. It takes a `LegendContent`
 * (from `computeLegendContent`) and produces a full `LegendLayout` with a
 * positioned bounding box.
 *
 * @param content - Pre-computed legend content.
 * @param chartArea - The final chart area (legend space already reserved in margins).
 * @param containerWidth - Full container width, used for responsive legend gap.
 * @param _theme - Resolved theme (reserved for future use).
 * @param xAxisHeight - Height of the x-axis, used for bottom legend positioning.
 * @param axisGapBelowLegend - The `effectiveAxisGap` the margin stack reserved
 *   between a top legend and the chart area (inline y-tick labels draw in that
 *   zone, above `chartArea.y`). The top legend is lifted above it so it
 *   occupies its reserved slot instead of colliding with the topmost tick
 *   label. Defaults to 0 so other callers/positions are unaffected.
 * @returns Full LegendLayout with bounds.
 */
export function placeLegend(
  content: LegendContent,
  chartArea: Rect,
  containerWidth: number,
  _theme: ResolvedTheme,
  xAxisHeight: number,
  axisGapBelowLegend: number = 0,
): LegendLayout {
  const { position, entries, labelStyle, legendWidth, height, offset } = content;

  // Empty legend = no bounds
  if (entries.length === 0) {
    return {
      type: 'categorical' as const,
      position,
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle,
      swatchSize: content.swatchSize,
      swatchGap: content.swatchGap,
      entryGap: content.entryGap,
      swatchChipFill: content.swatchChipFill,
    };
  }

  const offsetDx = offset?.dx ?? 0;
  const offsetDy = offset?.dy ?? 0;
  const gap = legendGap(containerWidth);

  let boundsX: number;
  let boundsY: number;

  if (position === 'right' || position === 'bottom-right') {
    boundsX = chartArea.x + chartArea.width + 8 + offsetDx;
    boundsY =
      (position === 'bottom-right' ? chartArea.y + chartArea.height - height : chartArea.y) +
      offsetDy;
  } else if (position === 'bottom') {
    boundsX = chartArea.x + offsetDx;
    boundsY = chartArea.y + chartArea.height + xAxisHeight + gap + offsetDy;
  } else {
    // top
    boundsX = chartArea.x + offsetDx;
    boundsY = chartArea.y - axisGapBelowLegend - gap - height + offsetDy;
  }

  const bounds = { x: boundsX, y: boundsY, width: legendWidth, height };

  const entryPositions = resolveEntryPositions(content.relativePositions, bounds);

  return {
    type: 'categorical' as const,
    position,
    entries,
    bounds,
    labelStyle,
    swatchSize: content.swatchSize,
    swatchGap: content.swatchGap,
    entryGap: content.entryGap,
    swatchChipFill: content.swatchChipFill,
    entryPositions,
    rowHeight: content.rowHeight,
  };
}

/**
 * Compute legend layout for a chart spec.
 *
 * Thin wrapper that calls `computeLegendContent` then `placeLegend`.
 * Existing callers are untouched.
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
  const content = computeLegendContent(
    spec,
    strategy,
    theme,
    chartArea.width,
    chartArea.height,
    watermark,
  );
  const { position, entries, labelStyle, legendWidth, height, offset: off } = content;
  const offsetDx = off?.dx ?? 0;
  const offsetDy = off?.dy ?? 0;
  let boundsX = chartArea.x + offsetDx;
  let boundsY = chartArea.y + offsetDy;
  const boundsW = legendWidth;
  if (entries.length === 0) {
    return {
      type: 'categorical' as const,
      position,
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle,
      swatchSize: content.swatchSize,
      swatchGap: content.swatchGap,
      entryGap: content.entryGap,
      swatchChipFill: content.swatchChipFill,
    };
  }
  if (position === 'right' || position === 'bottom-right') {
    boundsX = chartArea.x + chartArea.width - legendWidth + offsetDx;
    boundsY =
      (position === 'bottom-right' ? chartArea.y + chartArea.height - height : chartArea.y) +
      offsetDy;
  } else if (position === 'bottom') {
    boundsY = chartArea.y + chartArea.height - height + offsetDy;
  }

  const bounds = { x: boundsX, y: boundsY, width: boundsW, height };

  const entryPositions = resolveEntryPositions(content.relativePositions, bounds);

  return {
    type: 'categorical' as const,
    position,
    entries,
    bounds,
    labelStyle,
    swatchSize: content.swatchSize,
    swatchGap: content.swatchGap,
    entryGap: content.entryGap,
    swatchChipFill: content.swatchChipFill,
    entryPositions,
    rowHeight: content.rowHeight,
  };
}
