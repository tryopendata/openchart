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
  AnimationSpec,
  BinParams,
  BinTransform,
  ChartLayout,
  ChartSpec,
  CompileOptions,
  CompileTableOptions,
  EncodingChannel,
  LayerSpec,
  Mark,
  PointMark,
  Rect,
  RectMark,
  ResolvedAnnotation,
  ResolvedTheme,
  TableLayout,
  TimeUnit,
  TimeUnitTransform,
  Transform,
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
import { ruleRenderer } from './charts/rule';
import { scatterRenderer } from './charts/scatter';
import { textRenderer } from './charts/text';
import { tickRenderer } from './charts/tick';
import { compile as compileSpec, flattenLayers } from './compiler/index';

// Register all built-in chart renderers under the new Vega-Lite mark type names.
// Explicit imports ensure bundlers cannot tree-shake the registrations away.
//
// Mark type mapping from old chart types:
// - 'bar' -> barRenderer (horizontal bars, old 'bar')
// - 'bar:vertical' is handled by columnRenderer (old 'column')
// - 'arc' -> pieRenderer (old 'pie'); donutRenderer is also registered
// - 'point' -> scatterRenderer (old 'scatter')
// - 'circle' -> dotRenderer (old 'dot')
// - 'line' and 'area' unchanged
// - 'text', 'rule', 'tick' are new Vega-Lite mark types
//
// For 'bar', orientation is resolved at compile time to dispatch to the right renderer.
// We register both barRenderer and columnRenderer; the compile function picks based on orientation.
const builtinRenderers: Record<string, ChartRenderer> = {
  line: lineRenderer,
  area: areaRenderer,
  bar: barRenderer, // horizontal bars
  'bar:vertical': columnRenderer, // vertical bars (old 'column')
  point: scatterRenderer, // old 'scatter'
  arc: pieRenderer, // old 'pie' (donut handled via innerRadius)
  'arc:donut': donutRenderer, // old 'donut'
  circle: dotRenderer, // old 'dot'
  lollipop: dotRenderer, // semantic alias for dot/circle
  text: textRenderer,
  rule: ruleRenderer,
  tick: tickRenderer,
  rect: columnRenderer, // rect uses column renderer (RectMark output) as baseline for heatmaps
};
for (const [type, renderer] of Object.entries(builtinRenderers)) {
  registerChartRenderer(type, renderer);
}

import { resolveAnimation } from './compiler/animation';
import type { NormalizedChartSpec, NormalizedTableSpec } from './compiler/types';
import { compileGraph as compileGraphImpl } from './graphs/compile-graph';
import type { GraphCompilation } from './graphs/types';
import { computeAxes } from './layout/axes';
import { computeDimensions } from './layout/dimensions';
import { computeGridlines } from './layout/gridlines';
import { computeScales, type ResolvedScales } from './layout/scales';
import { computeLegend } from './legend/compute';
import { compileSankey as compileSankeyImpl } from './sankey/compile-sankey';
import { compileTableLayout } from './tables/compile-table';
import { computeTooltipDescriptors } from './tooltips/compute';
import { runTransforms } from './transforms';

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
// Encoding sugar expansion (bin, timeUnit on encoding channels)
// ---------------------------------------------------------------------------

/**
 * Expand encoding-level `bin` and `timeUnit` shorthand into explicit transforms.
 *
 * Vega-Lite allows `encoding.x.bin: true` as sugar for a BinTransform.
 * This function detects those shorthands, generates the corresponding transforms,
 * updates encoding field references to the output field names, and prepends the
 * transforms to the spec's transform array.
 *
 * Mutates nothing; returns a new spec object (shallow copy).
 */
export function expandEncodingSugar(spec: Record<string, unknown>): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, EncodingChannel | undefined> | undefined;
  if (!encoding) return spec;

  const generatedTransforms: Transform[] = [];
  const updatedEncoding = { ...encoding };
  let changed = false;

  for (const channel of Object.keys(encoding)) {
    const ch = encoding[channel];
    if (!ch || !ch.field) continue;

    // Expand bin shorthand
    if (ch.bin != null && ch.bin !== false) {
      const field = ch.field;
      const outputField = `bin_${field}`;
      const binTransform: BinTransform = {
        bin: ch.bin === true ? true : (ch.bin as BinParams),
        field,
        as: outputField,
      };
      generatedTransforms.push(binTransform);

      // Update encoding to reference binned output field, remove bin property
      const { bin: _bin, ...rest } = ch;
      updatedEncoding[channel] = { ...rest, field: outputField } as EncodingChannel;
      changed = true;
    }

    // Expand timeUnit shorthand (read from updated encoding in case bin already ran)
    const current = updatedEncoding[channel] ?? ch;
    if (current.timeUnit) {
      const field = current.field;
      const unit = current.timeUnit as TimeUnit;
      const outputField = `${unit}_${field}`;
      const timeUnitTransform: TimeUnitTransform = {
        timeUnit: unit,
        field,
        as: outputField,
      };
      generatedTransforms.push(timeUnitTransform);

      // Update encoding to reference timeUnit output field, remove timeUnit property
      const { timeUnit: _tu, ...rest } = current;
      updatedEncoding[channel] = { ...rest, field: outputField } as EncodingChannel;
      changed = true;
    }
  }

  if (!changed) return spec;

  // Prepend generated transforms before any user-defined transforms
  const existingTransforms = (spec.transform as Transform[] | undefined) ?? [];
  return {
    ...spec,
    encoding: updatedEncoding,
    transform: [...generatedTransforms, ...existingTransforms],
  };
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
  // Expand encoding-level bin/timeUnit sugar before validation + normalization.
  // This converts shorthand (e.g. encoding.x.bin: true) into explicit transforms.
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandEncodingSugar(spec as Record<string, unknown>)
      : spec;

  // Validate + normalize
  const { spec: normalized } = compileSpec(expandedSpec);

  if ('type' in normalized && (normalized as unknown as Record<string, unknown>).type === 'table') {
    throw new Error('compileChart received a table spec. Use compileTable instead.');
  }
  if ('type' in normalized && (normalized as unknown as Record<string, unknown>).type === 'graph') {
    throw new Error('compileChart received a graph spec. Use compileGraph instead.');
  }
  if (
    'type' in normalized &&
    (normalized as unknown as Record<string, unknown>).type === 'sankey'
  ) {
    throw new Error('compileChart received a sankey spec. Use compileSankey instead.');
  }

  let chartSpec = normalized as NormalizedChartSpec;

  // Resolve watermark: explicit spec value wins, then options fallback, then default true.
  const rawWatermark = (expandedSpec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? chartSpec.watermark : (options.watermark ?? true);

  // Run data transforms (filter, bin, calculate, timeUnit) before any other data processing.
  // Transforms are defined on the expanded spec (which includes any auto-generated
  // transforms from encoding-level bin/timeUnit sugar), not the normalized spec,
  // since NormalizedChartSpec doesn't carry the transform field.
  const rawTransforms = (expandedSpec as Record<string, unknown>).transform as
    | import('@opendata-ai/openchart-core').Transform[]
    | undefined;
  if (rawTransforms && rawTransforms.length > 0) {
    chartSpec = { ...chartSpec, data: runTransforms(chartSpec.data, rawTransforms) };
  }

  // Responsive strategy
  const breakpoint = getBreakpoint(options.width);
  const heightClass = getHeightClass(options.height);
  const strategy = getLayoutStrategy(breakpoint, heightClass);

  // Apply breakpoint-conditional overrides from the expanded spec
  const rawSpec = expandedSpec as Record<string, unknown>;
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

  // Resolve animation spec. Breakpoint override wins over base spec (matching
  // chrome, labels, legend, and annotation override precedence).
  const rawAnimationSpec = ((overrides?.[breakpoint] as Record<string, unknown> | undefined)
    ?.animation ?? rawSpec.animation) as AnimationSpec | undefined;
  const resolvedAnimation = resolveAnimation(rawAnimationSpec);

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
  const legendLayout = computeLegend(chartSpec, strategy, theme, preliminaryArea, watermark);

  // Compute dimensions (accounts for chrome + legend + responsive strategy)
  const dims = computeDimensions(chartSpec, options, legendLayout, theme, strategy, watermark);
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
  const finalLegend = computeLegend(chartSpec, strategy, theme, legendArea, watermark);

  // Apply data filtering after legend (so legend retains all series), but before
  // scale computation (so hidden/clipped data doesn't affect domains or marks).
  let renderData = chartSpec.data;

  // Filter hidden series: removed from rendering but kept in legend (dimmed in the adapter)
  if (
    chartSpec.hiddenSeries.length > 0 &&
    chartSpec.encoding.color &&
    'field' in chartSpec.encoding.color
  ) {
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

  // Set default color for single-series charts. If the user set a fill on the mark def
  // (string or gradient), that takes priority over the theme's first categorical color.
  scales.defaultColor = chartSpec.markDef.fill ?? theme.colors.categorical[0];

  // Arc charts (pie/donut) don't use axes or gridlines
  const isRadial = chartSpec.markType === 'arc';

  // Compute axes (skip for radial charts)
  const axes = isRadial
    ? { x: undefined, y: undefined }
    : computeAxes(scales, chartArea, strategy, theme, options.measureText);

  // Compute gridlines (stored in axes, used by adapters via axes.y.gridlines)
  if (!isRadial) {
    computeGridlines(axes, chartArea);
  }

  // Get chart renderer and compute marks (using filtered data).
  // For 'bar' mark, resolve orientation to pick horizontal vs vertical renderer.
  // For 'arc' mark, resolve innerRadius to pick pie vs donut renderer.
  let rendererKey = renderSpec.markType as string;
  if (rendererKey === 'bar') {
    // Infer orientation from encoding: if x is quantitative and y is categorical, horizontal (default)
    // If x is categorical and y is quantitative, vertical (old 'column')
    const xType = renderSpec.encoding.x?.type;
    const yType = renderSpec.encoding.y?.type;
    const isVertical =
      (xType === 'nominal' || xType === 'ordinal' || xType === 'temporal') &&
      yType === 'quantitative';
    if (isVertical) {
      rendererKey = 'bar:vertical';
    }
  } else if (rendererKey === 'arc') {
    const innerRadius = renderSpec.markDef.innerRadius;
    if (innerRadius && innerRadius > 0) {
      rendererKey = 'arc:donut';
    }
  }
  const renderer = getChartRenderer(rendererKey);
  const marks: Mark[] = renderer ? renderer(renderSpec, scales, chartArea, strategy, theme) : [];

  // Compute annotations from spec, passing legend + mark + brand bounds as obstacles
  const obstacles: Rect[] = [];
  if (finalLegend.bounds.width > 0) {
    obstacles.push(finalLegend.bounds);
  }
  obstacles.push(...computeMarkObstacles(marks, scales));

  // Add visible data label bounds as obstacles so annotations avoid overlapping them
  for (const mark of marks) {
    if ('label' in mark && mark.label?.visible) {
      obstacles.push(computeLabelBounds(mark.label));
    }
  }

  // Add brand watermark as an obstacle so annotations avoid overlapping it.
  // The brand is right-aligned on the same baseline as the first bottom chrome element,
  // offset below the chart area by x-axis extent (tick labels + axis title).
  if (watermark) {
    const brandPadding = theme.spacing.padding;
    const brandX = dims.total.width - brandPadding - BRAND_RESERVE_WIDTH;
    const xAxisExtent = axes.x?.label ? 48 : axes.x ? 26 : 0;
    const firstBottomChrome = dims.chrome.source ?? dims.chrome.byline ?? dims.chrome.footer;
    const brandY = firstBottomChrome
      ? chartArea.y + chartArea.height + xAxisExtent + firstBottomChrome.y
      : chartArea.y + chartArea.height + xAxisExtent + theme.spacing.chartToFooter;
    obstacles.push({ x: brandX, y: brandY, width: BRAND_RESERVE_WIDTH, height: 30 });
  }
  const annotations: ResolvedAnnotation[] = computeAnnotations(
    chartSpec,
    scales,
    chartArea,
    strategy,
    theme.isDark,
    obstacles,
    { width: dims.total.width, height: dims.total.height },
  );

  // Compute tooltip descriptors from marks and encoding
  const tooltipDescriptors = computeTooltipDescriptors(chartSpec, marks);

  // Compute accessibility
  const altText = generateAltText(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
      chrome: chartSpec.chrome,
    },
    chartSpec.data,
  );
  const dataTableFallback = generateDataTable(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    },
    chartSpec.data,
  );

  // Assign animationIndex for stagger ordering when animation is enabled
  // Assign animationIndex for value-based stagger ordering. Skip stacked rects
  // since they get group-based indices below (avoids wasted work that gets overwritten).
  if (resolvedAnimation?.enabled && resolvedAnimation.staggerOrder === 'value') {
    const indexed = marks.map((m, i) => ({ mark: m, idx: i }));
    indexed.sort((a, b) => {
      const av = getMarkPrimaryValue(a.mark);
      const bv = getMarkPrimaryValue(b.mark);
      return av - bv;
    });
    for (let i = 0; i < indexed.length; i++) {
      const m = indexed[i].mark;
      if (m.type === 'rect' && (m as RectMark).stackGroup) continue;
      m.animationIndex = i;
    }
  }

  // For stacked bars/columns, assign the same animationIndex to all segments
  // sharing a stackGroup so they animate as one contiguous bar per category.
  // Also compute stackPos (segment position within each group: 0, 1, 2...)
  // so the renderer can chain segment animations sequentially.
  if (resolvedAnimation?.enabled) {
    const groupIndexMap = new Map<string, number>();
    const groupStackPos = new Map<string, number>();
    let nextGroupIndex = 0;
    for (const mark of marks) {
      if (mark.type === 'rect' && (mark as RectMark).stackGroup) {
        const rect = mark as RectMark;
        const group = rect.stackGroup!;
        if (!groupIndexMap.has(group)) {
          groupIndexMap.set(group, nextGroupIndex++);
        }
        rect.animationIndex = groupIndexMap.get(group)!;
        const pos = groupStackPos.get(group) ?? 0;
        rect.stackPos = pos;
        groupStackPos.set(group, pos + 1);
      }
    }
  }

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
    animation: resolvedAnimation,
    watermark,
  };
}

/** Extract the primary quantitative value from a mark for value-based stagger ordering. */
function getMarkPrimaryValue(mark: Mark): number {
  switch (mark.type) {
    case 'rect':
      return mark.height; // bar height is the primary value encoding
    case 'point':
      return mark.cy; // y position for scatter
    case 'arc':
      return mark.endAngle - mark.startAngle; // arc angle extent
    case 'line':
    case 'area':
      return 0; // series marks don't have individual values
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Layer compilation
// ---------------------------------------------------------------------------

/**
 * Compile a LayerSpec into a single ChartLayout.
 *
 * Flattens nested layers, merges inherited data/encoding/transforms,
 * compiles each leaf layer independently, unions scale domains (shared
 * by default), and concatenates marks in layer order.
 *
 * @param spec - A LayerSpec with child layers.
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns A single ChartLayout with combined marks from all layers.
 */
export function compileLayer(spec: LayerSpec, options: CompileOptions): ChartLayout {
  // Flatten nested layers into leaf ChartSpecs with merged data/encoding/transforms
  const leaves = flattenLayers(spec);

  if (leaves.length === 0) {
    throw new Error('LayerSpec has no leaf chart specs after flattening');
  }

  // If there's only one layer, just compile it directly
  if (leaves.length === 1) {
    const singleSpec = buildPrimarySpec(leaves, spec);
    return compileChart(singleSpec, options);
  }

  // Build primary spec with unioned data for shared scale computation.
  // The primary layout provides chrome, axes, dimensions, legend, and a11y.
  const primarySpec = buildPrimarySpec(leaves, spec);
  const primaryLayout = compileChart(primarySpec, options);

  // Compile each leaf layer independently but with the full unioned data
  // so they all share the same scale domains.
  const allMarks: Mark[] = [];
  const seenLabels = new Set<string>();
  const mergedLegendEntries = [...primaryLayout.legend.entries];
  for (const entry of mergedLegendEntries) {
    seenLabels.add(entry.label);
  }

  for (const leaf of leaves) {
    // Compile each leaf with its own data so marks correspond to its rows only.
    // Scale domains may differ slightly between layers, but this prevents
    // duplicate marks from feeding unioned data into every renderer.
    const leafLayout = compileChart(leaf as unknown, options);

    allMarks.push(...leafLayout.marks);

    // Deduplicate legend entries across layers
    for (const entry of leafLayout.legend.entries) {
      if (!seenLabels.has(entry.label)) {
        seenLabels.add(entry.label);
        mergedLegendEntries.push(entry);
      }
    }
  }

  return {
    ...primaryLayout,
    marks: allMarks,
    legend: {
      ...primaryLayout.legend,
      entries: mergedLegendEntries,
    },
  };
}

/**
 * Build the primary ChartSpec from all leaves for shared compilation.
 * Unions all data rows across layers so scales see the full domain.
 * Uses the first leaf's mark/encoding as the base, with layer-level chrome.
 */
function buildPrimarySpec(leaves: ChartSpec[], layerSpec: LayerSpec): ChartSpec {
  // Union all data across layers for domain computation
  const allData = leaves.flatMap((leaf) => leaf.data);

  const primary = {
    ...leaves[0],
    data: allData,
    // Layer-level chrome overrides leaf chrome
    chrome: layerSpec.chrome ?? leaves[0].chrome,
    labels: layerSpec.labels ?? leaves[0].labels,
    legend: layerSpec.legend ?? leaves[0].legend,
    responsive: layerSpec.responsive ?? leaves[0].responsive,
    theme: layerSpec.theme ?? leaves[0].theme,
    darkMode: layerSpec.darkMode ?? leaves[0].darkMode,
    watermark: layerSpec.watermark ?? leaves[0].watermark,
    hiddenSeries: layerSpec.hiddenSeries ?? leaves[0].hiddenSeries,
  };

  return primary;
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

  const normType =
    'type' in normalized ? (normalized as unknown as Record<string, unknown>).type : undefined;
  if (normType !== 'table') {
    throw new Error(`compileTable received a non-table spec. Use compileChart instead.`);
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

  // Resolve watermark: spec-level wins, then options, then default true
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? tableSpec.watermark : (options.watermark ?? true);

  return compileTableLayout({ ...tableSpec, watermark }, options, theme);
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

// ---------------------------------------------------------------------------
// Sankey compilation
// ---------------------------------------------------------------------------

/**
 * Compile a sankey spec into a SankeyLayout.
 *
 * Takes a raw sankey spec, validates, normalizes, resolves theme and chrome,
 * runs the d3-sankey layout algorithm, builds node/link marks with colors and
 * labels, and returns a SankeyLayout ready for rendering.
 *
 * @param spec - Raw sankey spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns SankeyLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a sankey type.
 */
export function compileSankey(
  spec: unknown,
  options: CompileOptions,
): import('@opendata-ai/openchart-core').SankeyLayout {
  return compileSankeyImpl(spec, options);
}
