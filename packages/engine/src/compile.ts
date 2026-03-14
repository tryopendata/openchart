/**
 * Main compile API: the public entry points for the engine.
 *
 * Pipeline for charts:
 *   validate spec -> normalize -> resolve theme -> dark mode adapt ->
 *   compute legend -> compute dimensions (with legend space) ->
 *   compute scales -> compute axes -> compute gridlines ->
 *   get chart renderer -> compute marks -> compute a11y -> return ChartLayout
 *
 * Table compiler handles full data pipeline (sort, search, pagination, visual enhancements).
 * Graph compiler is a stub for future implementation.
 */

import type {
  ChartLayout,
  CompileOptions,
  CompileTableOptions,
  Mark,
  PointMark,
  Rect,
  RectMark,
  ResolvedAnnotation,
  ResolvedTheme,
  TableLayout,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  BRAND_RESERVE_WIDTH,
  computeLabelBounds,
  generateAltText,
  generateDataTable,
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { computeAnnotations } from './annotations/compute';
import { barRenderer } from './charts/bar';
import { columnRenderer } from './charts/column';
import { dotRenderer } from './charts/dot';
import { areaRenderer, lineRenderer } from './charts/line';
import { donutRenderer, pieRenderer } from './charts/pie';
import { type ChartRenderer, getChartRenderer, registerChartRenderer } from './charts/registry';
import { scatterRenderer } from './charts/scatter';
import { compile as compileSpec } from './compiler/index';

// Register all built-in chart renderers. Explicit imports ensure bundlers
// cannot tree-shake the registrations away (bare side-effect imports are
// treated as dead code by esbuild).
const builtinRenderers: Record<string, ChartRenderer> = {
  line: lineRenderer,
  area: areaRenderer,
  bar: barRenderer,
  column: columnRenderer,
  scatter: scatterRenderer,
  pie: pieRenderer,
  donut: donutRenderer,
  dot: dotRenderer,
};
for (const [type, renderer] of Object.entries(builtinRenderers)) {
  registerChartRenderer(type, renderer);
}

import type { NormalizedChartSpec, NormalizedTableSpec } from './compiler/types';
import { compileGraph as compileGraphImpl } from './graphs/compile-graph';
import type { GraphCompilation } from './graphs/types';
import { computeAxes } from './layout/axes';
import { computeDimensions } from './layout/dimensions';
import { computeGridlines } from './layout/gridlines';
import { computeScales, type ResolvedScales } from './layout/scales';
import { computeLegend } from './legend/compute';
import { compileTableLayout } from './tables/compile-table';
import { computeTooltipDescriptors } from './tooltips/compute';

// ---------------------------------------------------------------------------
// Mark obstacles for annotation collision avoidance
// ---------------------------------------------------------------------------

/**
 * Compute bounding rects from marks to use as obstacles for annotation nudging.
 *
 * For band-scale charts (bar, dot): groups marks by band row and returns
 * a single obstacle per row spanning the full band height and x-range.
 *
 * For other charts (column, scatter): returns individual mark bounds so
 * annotations avoid overlapping any visible data mark.
 */
function computeMarkObstacles(marks: Mark[], scales: ResolvedScales): Rect[] {
  // Band-scale y-axis: group marks by row for efficient obstacle computation
  if (scales.y?.type === 'band') {
    return computeBandRowObstacles(marks, scales);
  }

  // All other charts: use individual rect/point mark bounds as obstacles
  const obstacles: Rect[] = [];
  for (const mark of marks) {
    if (mark.type === 'rect') {
      const rm = mark as RectMark;
      obstacles.push({ x: rm.x, y: rm.y, width: rm.width, height: rm.height });
    } else if (mark.type === 'point') {
      const pm = mark as PointMark;
      obstacles.push({
        x: pm.cx - pm.r,
        y: pm.cy - pm.r,
        width: pm.r * 2,
        height: pm.r * 2,
      });
    }
  }
  return obstacles;
}

/** Group band-scale marks by row, returning one obstacle per band. */
function computeBandRowObstacles(marks: Mark[], scales: ResolvedScales): Rect[] {
  const rows = new Map<number, { minX: number; maxX: number; bandY: number }>();

  for (const mark of marks) {
    let cy: number;
    let left: number;
    let right: number;

    if (mark.type === 'point') {
      const pm = mark as PointMark;
      cy = pm.cy;
      left = pm.cx - pm.r;
      right = pm.cx + pm.r;
    } else if (mark.type === 'rect') {
      const rm = mark as RectMark;
      cy = rm.y + rm.height / 2;
      left = rm.x;
      right = rm.x + rm.width;
    } else {
      continue;
    }

    // Round cy to group marks on the same band
    const key = Math.round(cy);
    const existing = rows.get(key);
    if (existing) {
      existing.minX = Math.min(existing.minX, left);
      existing.maxX = Math.max(existing.maxX, right);
    } else {
      rows.set(key, { minX: left, maxX: right, bandY: cy });
    }
  }

  // Get bandwidth from the band scale
  const bandScale = scales.y!.scale as { bandwidth?: () => number };
  const bandwidth = bandScale.bandwidth?.() ?? 0;
  if (bandwidth === 0) return [];

  const obstacles: Rect[] = [];
  for (const { minX, maxX, bandY } of rows.values()) {
    obstacles.push({
      x: minX,
      y: bandY - bandwidth / 2,
      width: maxX - minX,
      height: bandwidth,
    });
  }

  return obstacles;
}

// ---------------------------------------------------------------------------
// Chart compilation
// ---------------------------------------------------------------------------

/**
 * Compile a chart spec into a ChartLayout.
 *
 * This is the main engine entry point. Takes a raw spec (any shape,
 * validated at runtime) and compile options, produces a fully resolved
 * ChartLayout with positions, colors, and marks ready for rendering.
 *
 * @param spec - Raw chart spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns ChartLayout with all computed positions.
 * @throws Error if spec is invalid or not a chart type.
 */
export function compileChart(spec: unknown, options: CompileOptions): ChartLayout {
  // Validate + normalize
  const { spec: normalized } = compileSpec(spec);

  if (normalized.type === 'table') {
    throw new Error('compileChart received a table spec. Use compileTable instead.');
  }
  if (normalized.type === 'graph') {
    throw new Error('compileChart received a graph spec. Use compileGraph instead.');
  }

  let chartSpec = normalized as NormalizedChartSpec;

  // Responsive strategy
  const breakpoint = getBreakpoint(options.width);
  const heightClass = getHeightClass(options.height);
  const strategy = getLayoutStrategy(breakpoint, heightClass);

  // Apply breakpoint-conditional overrides from the original spec
  const rawSpec = spec as Record<string, unknown>;
  const overrides = rawSpec.overrides as
    | Partial<
        Record<
          string,
          { chrome?: unknown; labels?: unknown; legend?: unknown; annotations?: unknown }
        >
      >
    | undefined;
  if (overrides?.[breakpoint]) {
    const bp = overrides[breakpoint]!;
    if (bp.chrome) {
      chartSpec = {
        ...chartSpec,
        chrome: {
          ...chartSpec.chrome,
          ...(bp.chrome as NormalizedChartSpec['chrome']),
        },
      };
    }
    if (bp.labels) {
      chartSpec = {
        ...chartSpec,
        labels: {
          ...chartSpec.labels,
          ...(bp.labels as NormalizedChartSpec['labels']),
        },
      };
    }
    if (bp.legend) {
      chartSpec = {
        ...chartSpec,
        legend: {
          ...chartSpec.legend,
          ...(bp.legend as NormalizedChartSpec['legend']),
        },
      };
    }
    if (bp.annotations) {
      chartSpec = {
        ...chartSpec,
        annotations: bp.annotations as NormalizedChartSpec['annotations'],
      };
    }
  }

  // Resolve theme: merge spec-level theme with options-level overrides
  const mergedThemeConfig = options.theme
    ? { ...chartSpec.theme, ...options.theme }
    : chartSpec.theme;
  let theme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // Compute legend first (needs to reserve space)
  const preliminaryArea: Rect = {
    x: 0,
    y: 0,
    width: options.width,
    height: options.height,
  };
  const legendLayout = computeLegend(chartSpec, strategy, theme, preliminaryArea);

  // Compute dimensions (accounts for chrome + legend + responsive strategy)
  const dims = computeDimensions(chartSpec, options, legendLayout, theme, strategy);
  const chartArea = dims.chartArea;

  // Recompute legend bounds relative to actual chart area.
  // chartArea was shrunk to exclude legend space, so expand it back to include
  // the reserved margin. This way computeLegend positions the legend outside
  // the data area (in the margin) instead of overlapping data marks.
  const legendArea: Rect = { ...chartArea };
  if (legendLayout.entries.length > 0) {
    switch (legendLayout.position) {
      case 'top':
        legendArea.y -= legendLayout.bounds.height + 4;
        legendArea.height += legendLayout.bounds.height + 4;
        break;
      case 'bottom':
        legendArea.height += legendLayout.bounds.height + 4;
        break;
      case 'right':
      case 'bottom-right':
        legendArea.width += legendLayout.bounds.width + 8;
        break;
    }
  }
  const finalLegend = computeLegend(chartSpec, strategy, theme, legendArea);

  // Apply data filtering after legend (so legend retains all series), but before
  // scale computation (so hidden/clipped data doesn't affect domains or marks).
  let renderData = chartSpec.data;

  // Filter hidden series: removed from rendering but kept in legend (dimmed in the adapter)
  if (chartSpec.hiddenSeries.length > 0 && chartSpec.encoding.color) {
    const colorField = chartSpec.encoding.color.field;
    const hiddenSet = new Set(chartSpec.hiddenSeries);
    renderData = renderData.filter((row) => !hiddenSet.has(String(row[colorField])));
  }

  // Filter clipped scale domains: when scale.clip is true, exclude rows outside the domain
  for (const channel of ['x', 'y'] as const) {
    const enc = chartSpec.encoding[channel];
    if (!enc?.scale?.clip || !enc.scale.domain) continue;
    const domain = enc.scale.domain;
    const field = enc.field;
    if (Array.isArray(domain) && domain.length === 2 && typeof domain[0] === 'number') {
      const [lo, hi] = domain as [number, number];
      renderData = renderData.filter((row) => {
        const v = Number(row[field]);
        return Number.isFinite(v) && v >= lo && v <= hi;
      });
    }
  }

  // Build a filtered spec for scales and marks, keeping all other properties intact
  const renderSpec = renderData !== chartSpec.data ? { ...chartSpec, data: renderData } : chartSpec;

  // Compute scales
  const scales = computeScales(renderSpec, chartArea, renderSpec.data);

  // Update color scale to use theme palette
  if (scales.color) {
    if (scales.color.type === 'sequential') {
      // Sequential: use first sequential palette (or fall back to categorical endpoints)
      const seqStops = Object.values(theme.colors.sequential)[0] ?? theme.colors.categorical;
      (scales.color.scale as unknown as import('d3-scale').ScaleLinear<string, string>).range([
        seqStops[0],
        seqStops[seqStops.length - 1],
      ]);
    } else {
      (scales.color.scale as import('d3-scale').ScaleOrdinal<string, string>).range(
        theme.colors.categorical,
      );
    }
  }

  // Set default color for single-series charts (no color encoding)
  scales.defaultColor = theme.colors.categorical[0];

  // Pie/donut charts don't use axes or gridlines
  const isRadial = chartSpec.type === 'pie' || chartSpec.type === 'donut';

  // Compute axes (skip for radial charts)
  const axes = isRadial
    ? { x: undefined, y: undefined }
    : computeAxes(scales, chartArea, strategy, theme, options.measureText);

  // Compute gridlines (stored in axes, used by adapters via axes.y.gridlines)
  if (!isRadial) {
    computeGridlines(axes, chartArea);
  }

  // Get chart renderer and compute marks (using filtered data)
  const renderer = getChartRenderer(renderSpec.type);
  const marks: Mark[] = renderer ? renderer(renderSpec, scales, chartArea, strategy, theme) : [];

  // Compute annotations from spec, passing legend + mark + brand bounds as obstacles
  const obstacles: Rect[] = [];
  if (finalLegend.bounds.width > 0) {
    obstacles.push(finalLegend.bounds);
  }
  obstacles.push(...computeMarkObstacles(marks, scales));

  // Add visible data label bounds as obstacles so annotations avoid overlapping them
  for (const mark of marks) {
    if (mark.type !== 'area' && mark.label?.visible) {
      obstacles.push(computeLabelBounds(mark.label));
    }
  }

  // Add brand watermark as an obstacle so annotations avoid overlapping it.
  // The brand is right-aligned on the same baseline as the first bottom chrome element,
  // offset below the chart area by x-axis extent (tick labels + axis title).
  const brandPadding = theme.spacing.padding;
  const brandX = dims.total.width - brandPadding - BRAND_RESERVE_WIDTH;
  const xAxisExtent = axes.x?.label ? 48 : axes.x ? 26 : 0;
  const firstBottomChrome = dims.chrome.source ?? dims.chrome.byline ?? dims.chrome.footer;
  const brandY = firstBottomChrome
    ? chartArea.y + chartArea.height + xAxisExtent + firstBottomChrome.y
    : chartArea.y + chartArea.height + xAxisExtent + theme.spacing.chartToFooter;
  obstacles.push({ x: brandX, y: brandY, width: BRAND_RESERVE_WIDTH, height: 30 });
  const annotations: ResolvedAnnotation[] = computeAnnotations(
    chartSpec,
    scales,
    chartArea,
    strategy,
    theme.isDark,
    obstacles,
  );

  // Compute tooltip descriptors from marks and encoding
  const tooltipDescriptors = computeTooltipDescriptors(chartSpec, marks);

  // Compute accessibility
  const altText = generateAltText(
    {
      type: chartSpec.type,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
      chrome: chartSpec.chrome,
    },
    chartSpec.data,
  );
  const dataTableFallback = generateDataTable(
    {
      type: chartSpec.type,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    },
    chartSpec.data,
  );

  return {
    area: chartArea,
    chrome: dims.chrome,
    axes: {
      x: axes.x,
      y: axes.y,
    },
    marks,
    annotations,
    legend: finalLegend,
    tooltipDescriptors,
    a11y: {
      altText,
      dataTableFallback,
      role: 'img',
      keyboardNavigable: marks.length > 0,
    },
    theme,
    dimensions: {
      width: options.width,
      height: options.height,
    },
  };
}

// ---------------------------------------------------------------------------
// Table compilation
// ---------------------------------------------------------------------------

/**
 * Compile a table spec into a TableLayout.
 *
 * Validates and normalizes the spec, resolves the theme, then delegates
 * to compileTableLayout for the full pipeline: column resolution, search,
 * sort, pagination, cell formatting, and visual enhancements.
 *
 * @param spec - Raw table spec.
 * @param options - Compile options with sort, search, pagination state.
 * @returns Fully resolved TableLayout.
 */
export function compileTable(spec: unknown, options: CompileTableOptions): TableLayout {
  const { spec: normalized } = compileSpec(spec);

  if (normalized.type !== 'table') {
    throw new Error(`compileTable received a ${normalized.type} spec. Use compileChart instead.`);
  }

  const tableSpec = normalized as NormalizedTableSpec;

  // Resolve theme: merge spec-level theme with options-level overrides
  const mergedThemeConfig = options.theme
    ? { ...tableSpec.theme, ...options.theme }
    : tableSpec.theme;
  let theme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  return compileTableLayout(tableSpec, options, theme);
}

// ---------------------------------------------------------------------------
// Graph compilation
// ---------------------------------------------------------------------------

/**
 * Compile a graph spec into a GraphCompilation.
 *
 * The graph pipeline resolves visual properties (size, color, stroke) for
 * nodes and edges, assigns communities, and builds legend/tooltip/a11y data.
 * Unlike charts, the output does NOT include x/y positions since the force
 * simulation in the adapter handles layout at runtime.
 *
 * @param spec - Raw graph spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns GraphCompilation with resolved visual properties and simulation config.
 * @throws Error if spec is invalid or not a graph type.
 */
export function compileGraph(spec: unknown, options: CompileOptions): GraphCompilation {
  return compileGraphImpl(spec, options);
}
