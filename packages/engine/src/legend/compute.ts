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
  ContinuousLegendLayout,
  LayoutStrategy,
  LegendEntry,
  LegendEntryPosition,
  LegendLayout,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { BRAND_RESERVE_WIDTH, COMPACT_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';

import { isStrokeSeriesMark, resolveSeriesStroke } from '../charts/utils';
import { categoricalColorsForDomain } from '../compile/color-scale-range';
import type { NormalizedChartSpec } from '../compiler/types';
import type { MeasureFn } from '../layout/plan';
import { applyCategoricalSort } from '../layout/scales';
import {
  CONTINUOUS_LABEL_GAP,
  type ContinuousLegendContent,
  computeContinuousLegendContent,
  hasContinuousColorScale,
} from './continuous';
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

/**
 * Slice count above which an arc chart keeps its legend even though the slices
 * carry labels. Past this the leader-line labels start losing collisions and
 * dropping silently, so the legend has to stay as the fallback identifier.
 *
 * Measured against `computePieLabels`: the first drop appears at 22 slices in
 * the tightest container that renders a pie at all (300x220) and does not
 * appear below 33 at 500px and up. 21 is therefore safe at every width, and it
 * sits far past the point where a pie is readable anyway.
 */
const ARC_LABEL_CROWDING_LIMIT = 21;

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
  /**
   * Continuous legend payload (gradient bar / binned swatches). When set,
   * `entries` is empty and `height`/`legendWidth` describe the bar block.
   */
  continuous?: ContinuousLegendContent;
}

/**
 * True when the legend has something to render (categorical entries or a
 * continuous bar). Space-reservation predicates must use this instead of
 * checking `entries.length` directly.
 */
export function hasLegendContent(content: LegendContent): boolean {
  return content.entries.length > 0 || content.continuous != null;
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
    case 'beeswarm':
    case 'range':
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
  const shape = swatchShapeForType(spec.markType);

  // Reproduce the ordinal color scale's domain so swatch colors index the
  // palette exactly like the mark colors do. `buildOrdinalColorScale` takes an
  // explicit domain verbatim, otherwise sorts the data values by `sort`.
  const scaleDomain = explicitDomain
    ? explicitDomain.map(String)
    : applyCategoricalSort(dataValues, colorEnc.sort);

  // Colors come from the same resolver the scale uses, so `highlight` muting
  // and the accent-neutral series strategy show up in the legend too. An
  // explicit range always wins (the scale honours it verbatim).
  const rawDomainColors =
    explicitRange ?? categoricalColorsForDomain(scaleDomain, theme, spec.highlight, spec.markType);

  // Line and area series draw their color as a foreground stroke, which the
  // mark compute darkens on a light canvas (resolveSeriesStroke). The swatch
  // has to run through the same helper or the legend shows one cyan and the
  // line another. The helper is also what keeps an explicit range verbatim on
  // both sides.
  const domainColors = isStrokeSeriesMark(spec.markType)
    ? rawDomainColors.map((c) => resolveSeriesStroke(spec, c, theme))
    : rawDomainColors;

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
      // Look the value up in the scale domain so the color matches the mark
      // even when legend order differs from domain order. Values outside the
      // domain (a data value not in an explicit domain) fall back to position.
      const domainIdx = scaleDomain.indexOf(value);
      const colorIndex = domainIdx >= 0 ? domainIdx : i;
      return {
        label: value,
        color: domainColors[colorIndex % domainColors.length],
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

  // Continuous color scale (quantitative color encoding): gradient bar or
  // binned swatch legend, on by default. Horizontal-bar geometry only, so the
  // position resolves to top (newsroom map-key convention) unless the user
  // asks for bottom; right-column positions can't fit the bar.
  if (hasContinuousColorScale(spec)) {
    const continuous = computeContinuousLegendContent(spec, theme, availableWidth);
    const continuousPosition = spec.legend?.position === 'bottom' ? 'bottom' : 'top';
    if (!continuous) {
      return emptyContent(continuousPosition, theme);
    }
    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: theme.fonts.sizes.small,
      fontWeight: theme.fonts.weights.normal,
      fill: theme.colors.text,
      lineHeight: 1.3,
      fontVariant: 'tabular-nums',
    };
    const labelRowHeight = Math.ceil(labelStyle.fontSize * labelStyle.lineHeight);
    const height = continuous.barHeight + CONTINUOUS_LABEL_GAP + labelRowHeight;
    return {
      entries: [],
      position: continuousPosition,
      labelStyle,
      rowCount: 1,
      totalWidth: continuous.barWidth,
      height,
      legendWidth: continuous.barWidth,
      offset: spec.legend?.offset,
      ...categoricalDefaults(theme),
      continuous,
    };
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

  // Bar/column/lollipop/beeswarm redundancy rule: when color.field matches the
  // category axis field, the legend just repeats the axis labels. Hide it
  // unless the user explicitly configured the legend.
  const hasRedundantLegend =
    spec.markType === 'bar' || spec.markType === 'lollipop' || spec.markType === 'beeswarm';
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

  // Arc redundancy rule: pie/donut slices carry their own leader-line labels
  // naming each category, so a categorical legend restates them one-for-one.
  // Same principle as the bar rule above -- the difference is that an arc has
  // no category axis, so the slice labels themselves play that role.
  //
  // Only when EVERY slice is labeled. 'endpoints' labels just the first and
  // last, so dropping the legend there would leave the middle slices with no
  // identifier anywhere; 'none' draws no labels at all. Both keep the legend.
  //
  // Deliberately not gated on `strategy.labelMode`: pie labels are computed in
  // charts/pie/index.ts, which passes only `spec.labels.density` to
  // computePieLabels and never consults the strategy. Reading labelMode here
  // would make the legend disagree with what the pie renderer actually draws
  // (on the compact breakpoint it would hide the legend while every slice
  // label still rendered).
  //
  // `legend` set explicitly always wins, in either direction.
  //
  // Arc only. Waffle and parliament share the part-to-whole family but attach
  // no per-mark labels, so their legend is the sole identifier. `'arc:donut'`
  // is a renderer key, not a markType -- donuts reach here as `'arc'` too.
  //
  // Capped by slice count: past ARC_LABEL_CROWDING_LIMIT the leader-line labels
  // start losing collisions and silently drop (a ~30-slice pie in a small
  // container drops 2-3), which would strand those slices with no identifier.
  // The legend is computed before marks, so the resolved `visible` flags aren't
  // available here -- this is a conservative bound, not a measurement. Dense
  // pies keep their legend, and they are the ones that need it.
  const density = spec.labels.density;
  const everySliceLabeled = density === 'all' || density === 'auto';
  const uncrowded = seriesCount > 0 && seriesCount <= ARC_LABEL_CROWDING_LIMIT;
  if (spec.markType === 'arc' && everySliceLabeled && uncrowded && !spec.userExplicit?.legend) {
    entries = [];
  }

  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
    // Legend labels are often values or years; lining figures keep the column
    // of entries from shimmying.
    fontVariant: 'tabular-nums',
  };

  // Resolve position: spec-level override wins, then responsive strategy.
  // 'top-left' is a map-only overlay position; charts fold it into 'top'.
  const specPosition = spec.legend?.position === 'top-left' ? 'top' : spec.legend?.position;
  const resolvedPosition = specPosition ?? (strategy.legendPosition === 'right' ? 'right' : 'top');

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

  // Continuous legend: gradient bar / binned swatches. Placement mirrors the
  // categorical top/bottom math; the bar-relative geometry from the content
  // phase is offset into chart coordinates here.
  if (content.continuous) {
    const c = content.continuous;
    const cDx = offset?.dx ?? 0;
    const cDy = offset?.dy ?? 0;
    const cGap = legendGap(containerWidth);
    const boundsX = chartArea.x + cDx;
    const boundsY =
      position === 'bottom'
        ? chartArea.y + chartArea.height + xAxisHeight + cGap + cDy
        : chartArea.y - axisGapBelowLegend - cGap - height + cDy;
    const bounds = { x: boundsX, y: boundsY, width: legendWidth, height };
    const bar = { x: bounds.x, y: bounds.y, width: c.barWidth, height: c.barHeight };
    return {
      type: 'continuous' as const,
      mode: c.mode,
      position,
      bounds,
      labelStyle,
      bar,
      colorStops: c.colorStops,
      bins: c.bins.map((b) => ({ ...b, x: b.x + bar.x })),
      ticks: c.ticks.map((t) => ({ ...t, x: t.x + bar.x })),
      labelY: bar.y + bar.height + CONTINUOUS_LABEL_GAP + labelStyle.fontSize,
    } satisfies ContinuousLegendLayout;
  }

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
  // Continuous legends share placeLegend's placement math.
  if (content.continuous) {
    return placeLegend(content, chartArea, chartArea.width, theme, 0);
  }
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
