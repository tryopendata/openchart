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
  DataRow,
  Encoding,
  EncodingChannel,
  LayerSpec,
  Mark,
  Rect,
  ResolvedAnnotation,
  ResolvedTheme,
  TableLayout,
  TimeUnit,
  TimeUnitTransform,
  Transform,
} from '@opendata-ai/openchart-core';
import {
  AXIS_TITLE_TRAILING_PAD,
  adaptTheme,
  BREAKPOINT_COMPACT_MAX,
  computeLabelBounds,
  estimateTextWidth,
  generateAltText,
  generateDataTable,
  getAxisTitleOffset,
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  resolveTheme,
  TICK_LABEL_OFFSET,
} from '@opendata-ai/openchart-core';
import { format as d3Format } from 'd3-format';
import { scaleLinear } from 'd3-scale';
import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape';
import { computeAnnotations } from './annotations/compute';
// Side-effect import: registers all built-in chart renderers with the
// registry on module load. Tests that clear the registry can import
// `registerBuiltinRenderers` from `./charts/builtin` to restore defaults.
import './charts/builtin';
import { compileBarList as compileBarListImpl } from './barlist/compile-barlist';
import {
  assignAnimationIndices,
  computeMarkObstacles,
  resolveRendererKey,
} from './charts/post-process';
import { getChartRenderer } from './charts/registry';
import { applyColorScaleRange } from './compile/color-scale-range';
import { filterClippedDomains } from './compile/data-clip';
import { computeWatermarkObstacle } from './compile/watermark-obstacle';
import { resolveAnimation } from './compiler/animation';
import { compile as compileSpec, flattenLayers } from './compiler/index';
import type { NormalizedChartSpec, NormalizedTableSpec } from './compiler/types';
import { compileGraph as compileGraphImpl } from './graphs/compile-graph';
import type { GraphCompilation } from './graphs/types';
import { computeAxes } from './layout/axes';
import { computeDimensions } from './layout/dimensions';
import { computeGridlines } from './layout/gridlines';
import { computeScales } from './layout/scales';
import { computeLegend } from './legend/compute';
import { legendGap } from './legend/wrap';
import { compileSankey as compileSankeyImpl } from './sankey/compile-sankey';
import { compileTableLayout } from './tables/compile-table';
import { compileTileMap as compileTileMapImpl } from './tilemap/compile-tilemap';
import { computeTooltipDescriptors } from './tooltips/compute';
import { runTransforms } from './transforms';

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
  let watermark = rawWatermark !== undefined ? chartSpec.watermark : (options.watermark ?? true);

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
  let strategy = getLayoutStrategy(breakpoint, heightClass);

  // Apply breakpoint-conditional overrides from the expanded spec
  const rawSpec = expandedSpec as Record<string, unknown>;
  const overrides = rawSpec.overrides as
    | Partial<
        Record<
          string,
          {
            chrome?: unknown;
            labels?: unknown;
            legend?: unknown;
            annotations?: unknown;
            animation?: unknown;
            display?: unknown;
            encoding?: unknown;
            watermark?: unknown;
            crosshair?: unknown;
          }
        >
      >
    | undefined;

  // Build userExplicit descriptor BEFORE applying any overrides so we capture
  // the union of "user wrote this at top-level" and "user wrote this in the
  // active breakpoint override." Sparkline display mode reads this to decide
  // whether to suppress chrome/axes/legend/etc. by default vs. respecting an
  // explicit user opt-in. Precedence: explicit at any level wins.
  const rawEncoding = rawSpec.encoding as
    | { x?: { axis?: unknown }; y?: { axis?: unknown } }
    | undefined;
  const bpForExplicit = overrides?.[breakpoint];
  const bpEncoding = bpForExplicit?.encoding as
    | { x?: { axis?: unknown }; y?: { axis?: unknown } }
    | undefined;
  // chrome: {} (empty object) is not "explicit" — it's an idiom users write to
  // silence defaults. Require at least one chrome key set to count as opt-in.
  const hasChromeKeys = (v: unknown): boolean =>
    !!v && typeof v === 'object' && Object.keys(v as Record<string, unknown>).length > 0;
  const userExplicit = {
    chrome: hasChromeKeys(rawSpec.chrome) || hasChromeKeys(bpForExplicit?.chrome),
    legend: rawSpec.legend !== undefined || bpForExplicit?.legend !== undefined,
    xAxis: rawEncoding?.x?.axis !== undefined || bpEncoding?.x?.axis !== undefined,
    yAxis: rawEncoding?.y?.axis !== undefined || bpEncoding?.y?.axis !== undefined,
    labels: rawSpec.labels !== undefined || bpForExplicit?.labels !== undefined,
    animation: rawSpec.animation !== undefined || bpForExplicit?.animation !== undefined,
    watermark: rawSpec.watermark !== undefined || bpForExplicit?.watermark !== undefined,
    crosshair: rawSpec.crosshair !== undefined || bpForExplicit?.crosshair !== undefined,
  };
  chartSpec = { ...chartSpec, userExplicit };

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
    if (bp.labels !== undefined) {
      if (typeof bp.labels === 'boolean') {
        chartSpec = {
          ...chartSpec,
          labels: bp.labels
            ? { density: 'auto', format: '', prefix: '' }
            : { density: 'none', format: '', prefix: '' },
        };
      } else {
        chartSpec = {
          ...chartSpec,
          labels: {
            ...chartSpec.labels,
            ...(bp.labels as NormalizedChartSpec['labels']),
          },
        };
      }
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
      // User explicitly provided annotations at this breakpoint — override the
      // responsive strategy so they render inline instead of being stripped.
      strategy = { ...strategy, annotationPosition: 'inline' };
    }
    // New override branches for sparkline mode and related fields:
    if (bp.display !== undefined) {
      chartSpec = {
        ...chartSpec,
        display: bp.display as NormalizedChartSpec['display'],
      };
    }
    if (bp.encoding !== undefined) {
      // Merge encoding so a breakpoint can flip on/off encoding.x.axis or
      // encoding.y.axis (used by sparkline display mode to opt back in to
      // axes at a specific breakpoint). Channels merge per-key, and `axis`
      // and `scale` deep-merge one level so a breakpoint can set
      // `axis: { title: 'foo' }` without dropping the base spec's
      // `axis.tickCount` / `axis.format`.
      const bpEnc = bp.encoding as Record<string, Record<string, unknown> | undefined>;
      const mergedEncoding = { ...chartSpec.encoding } as Record<
        string,
        Record<string, unknown> | undefined
      >;
      const NESTED_CHANNEL_KEYS = ['axis', 'scale'];
      for (const channel of Object.keys(bpEnc)) {
        const baseCh = mergedEncoding[channel];
        const bpCh = bpEnc[channel];
        if (bpCh && baseCh) {
          const merged: Record<string, unknown> = { ...baseCh, ...bpCh };
          for (const key of NESTED_CHANNEL_KEYS) {
            const baseNested = baseCh[key];
            const bpNested = bpCh[key];
            if (
              baseNested &&
              bpNested &&
              typeof baseNested === 'object' &&
              typeof bpNested === 'object' &&
              !Array.isArray(baseNested) &&
              !Array.isArray(bpNested)
            ) {
              merged[key] = { ...baseNested, ...bpNested };
            }
          }
          mergedEncoding[channel] = merged;
        } else if (bpCh) {
          mergedEncoding[channel] = bpCh;
        }
      }
      chartSpec = {
        ...chartSpec,
        encoding: mergedEncoding as unknown as NormalizedChartSpec['encoding'],
      };
    }
    if (typeof bp.watermark === 'boolean') {
      // Update the resolved watermark value used downstream. ChartSpec carries
      // this in its normalized shape; the local `watermark` variable controls
      // chrome computation and rendering.
      watermark = bp.watermark;
      chartSpec = { ...chartSpec, watermark };
    }
  }

  // Sparkline mode: default labels off. Mark renderers draw value labels per
  // labels.density (default 'auto'), which fills tiny sparklines with text and
  // is never what you want. Explicit user labels at any level wins via
  // userExplicit.labels.
  if (chartSpec.display === 'sparkline' && !chartSpec.userExplicit.labels) {
    chartSpec = {
      ...chartSpec,
      labels: { ...chartSpec.labels, density: 'none' },
    };
  }

  // Resolve animation spec. Breakpoint override wins over base spec (matching
  // chrome, labels, legend, and annotation override precedence).
  // Precedence rule for sparkline mode: an explicit user animation at ANY
  // level (top-level OR breakpoint) always wins, regardless of display mode.
  // resolveAnimation handles the explicit-user value; the sparkline default-off
  // behavior is applied below when no explicit value exists.
  let rawAnimationSpec = ((overrides?.[breakpoint] as Record<string, unknown> | undefined)
    ?.animation ?? rawSpec.animation) as AnimationSpec | undefined;
  if (rawAnimationSpec === undefined && chartSpec.display === 'sparkline') {
    // Sparkline mode: animation defaults to false. User-explicit (top OR bp)
    // already short-circuits this branch via userExplicit.animation.
    rawAnimationSpec = false;
  }
  // Sparkline mode: when animation is on but the user didn't specify duration,
  // bump to 1100ms so the line/area reveal feels paced rather than mechanical.
  // The CSS override pairs this with an expo-out easing curve. AnimationConfig
  // nests duration under `enter`, so we set it there.
  if (
    chartSpec.display === 'sparkline' &&
    rawAnimationSpec !== false &&
    rawAnimationSpec !== undefined
  ) {
    const SPARK_DURATION = 1100;
    if (rawAnimationSpec === true) {
      rawAnimationSpec = { enter: { duration: SPARK_DURATION } } as AnimationSpec;
    } else if (typeof rawAnimationSpec === 'object') {
      const cfg = rawAnimationSpec as { enter?: unknown; annotationDelay?: number };
      const enter = cfg.enter;
      if (enter === undefined || enter === true) {
        rawAnimationSpec = {
          ...cfg,
          enter: { duration: SPARK_DURATION },
        } as AnimationSpec;
      } else if (
        typeof enter === 'object' &&
        enter !== null &&
        (enter as { duration?: number }).duration === undefined
      ) {
        rawAnimationSpec = {
          ...cfg,
          enter: { ...(enter as object), duration: SPARK_DURATION },
        } as AnimationSpec;
      }
    }
  }
  const resolvedAnimation = resolveAnimation(rawAnimationSpec);

  // Crosshair: explicit user value at any level wins. In sparkline mode the
  // default is off, otherwise default is off too (crosshair is opt-in). The
  // value is plumbed through ChartLayout so the renderer doesn't need to
  // re-inspect the raw spec.
  const rawCrosshair = (bpForExplicit?.crosshair ?? rawSpec.crosshair) as boolean | undefined;
  const crosshair =
    chartSpec.display === 'sparkline' && !chartSpec.userExplicit.crosshair
      ? false
      : rawCrosshair === true;

  // Watermark default-off in sparkline mode unless user-explicit.
  if (chartSpec.display === 'sparkline' && !chartSpec.userExplicit.watermark) {
    watermark = false;
    chartSpec = { ...chartSpec, watermark: false };
  }

  // Resolve theme: merge spec-level theme with options-level overrides
  const mergedThemeConfig = options.theme
    ? { ...chartSpec.theme, ...options.theme }
    : chartSpec.theme;
  let theme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // INVARIANT 1 — double legend pass: preliminaryArea → computeDimensions → legendArea → final
  // legend. Breaks a dims/legend dependency cycle. Do not collapse into one call.
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
  if ('entries' in legendLayout && legendLayout.entries.length > 0) {
    const gap = legendGap(options.width);
    switch (legendLayout.position) {
      case 'top':
        legendArea.y -= legendLayout.bounds.height + gap;
        legendArea.height += legendLayout.bounds.height + gap;
        break;
      case 'bottom':
        legendArea.height += legendLayout.bounds.height + gap;
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
  renderData = filterClippedDomains(renderData, chartSpec.encoding);

  // Build a filtered spec for scales and marks, keeping all other properties intact
  const renderSpec = renderData !== chartSpec.data ? { ...chartSpec, data: renderData } : chartSpec;

  // Compute scales
  const scales = computeScales(renderSpec, chartArea, renderSpec.data);

  // Update color scale to use theme palette (only when user hasn't provided an explicit range)
  applyColorScaleRange(scales, renderSpec.encoding, theme);

  // INVARIANT 3 — post-hoc defaultColor: must run AFTER computeScales since resolution needs
  // theme context. Do not move into computeScales (would require threading theme through).
  // fill wins for bar/area/arc marks; stroke wins for line marks (the stroke IS the color).
  scales.defaultColor =
    chartSpec.markDef.fill ?? chartSpec.markDef.stroke ?? theme.colors.categorical[0];

  // Arc charts (pie/donut) don't use axes or gridlines
  const isRadial = chartSpec.markType === 'arc';

  // Compute axes (skip for radial charts).
  // Sparkline mode skips axes by default unless the user explicitly opted into
  // an axis on a specific channel.
  const skipX = chartSpec.display === 'sparkline' && !chartSpec.userExplicit.xAxis;
  const skipY = chartSpec.display === 'sparkline' && !chartSpec.userExplicit.yAxis;
  const axes = isRadial
    ? { x: undefined, y: undefined }
    : computeAxes(scales, chartArea, strategy, theme, options.measureText, {
        data: renderSpec.data,
        encoding: renderSpec.encoding as Encoding,
        skipX,
        skipY,
      });

  // INVARIANT 2 — computeGridlines mutates `axes` in place. Downstream consumers read
  // axes.y.gridlines off the same object. Do not introduce a copy-on-write.
  if (!isRadial) {
    computeGridlines(axes, chartArea);
  }

  // Get chart renderer and compute marks (using filtered data).
  const rendererKey = resolveRendererKey(
    renderSpec.markType,
    renderSpec.encoding,
    renderSpec.markDef,
  );
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
  const watermarkRect = computeWatermarkObstacle(dims, watermark, axes, theme);
  if (watermarkRect) obstacles.push(watermarkRect);
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
  assignAnimationIndices(marks, resolvedAnimation);

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
    display: chartSpec.display,
    crosshair,
    measureText: options.measureText,
  };
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

  // Branch: independent y-scales produce dual-axis layout
  if (spec.resolve?.scale?.y === 'independent') {
    return compileLayerIndependent(leaves, spec, options);
  }

  // Shared scales (default): union data and compile together
  const primarySpec = buildPrimarySpec(leaves, spec);
  const primaryLayout = compileChart(primarySpec, options);

  const allMarks: Mark[] = [];
  const seenLabels = new Set<string>();
  const pLegend = primaryLayout.legend;
  const mergedLegendEntries = 'entries' in pLegend ? [...pLegend.entries] : [];
  for (const entry of mergedLegendEntries) {
    seenLabels.add(entry.label);
  }

  // Sort leaves by zIndex for render order while preserving original indices
  // for axis assignment. Default zIndex is the array position.
  const indexedLeaves = leaves.map((leaf, i) => ({
    leaf,
    zIndex: (leaf as ChartSpec).zIndex ?? i,
  }));
  indexedLeaves.sort((a, b) => a.zIndex - b.zIndex);

  for (const { leaf } of indexedLeaves) {
    const leafLayout = compileChart(leaf as unknown, options);

    allMarks.push(...leafLayout.marks);

    const leafLeg = leafLayout.legend;
    if ('entries' in leafLeg) {
      for (const entry of leafLeg.entries) {
        if (!seenLabels.has(entry.label)) {
          seenLabels.add(entry.label);
          mergedLegendEntries.push(entry);
        }
      }
    }
  }

  return {
    ...primaryLayout,
    marks: allMarks,
    legend: {
      ...primaryLayout.legend,
      ...('entries' in pLegend ? { entries: mergedLegendEntries } : {}),
    } as typeof primaryLayout.legend,
  };
}

// ---------------------------------------------------------------------------
// Independent y-scale compilation (dual-axis charts)
// ---------------------------------------------------------------------------

/**
 * Estimate the pixel width needed for a right-side y-axis based on data values.
 * Mirrors the left-margin estimation logic in computeDimensions.
 */
function estimateYAxisLabelWidth(
  data: DataRow[],
  encoding: Encoding | undefined,
  baseFontSize: number,
): number {
  if (!encoding?.y) return 40;
  const yEnc = encoding.y;
  const yField = yEnc.field;
  if (!yField) return 40;

  const yType = yEnc.type;
  if (yType === 'nominal' || yType === 'ordinal') {
    let maxWidth = 0;
    for (const row of data) {
      const label = String(row[yField] ?? '');
      const w = estimateTextWidth(label, baseFontSize, 400);
      if (w > maxWidth) maxWidth = w;
    }
    return maxWidth > 0 ? maxWidth + 10 : 40;
  }

  // Quantitative/temporal: estimate from the largest value
  const yAxisFormat = (encoding.y.axis as Record<string, unknown> | undefined)?.format as
    | string
    | undefined;
  let maxAbsVal = 0;
  for (const row of data) {
    const v = Number(row[yField]);
    if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
  }
  let sampleLabel: string;
  if (yAxisFormat) {
    try {
      const fmt = d3Format(yAxisFormat);
      sampleLabel = fmt(maxAbsVal);
    } catch {
      sampleLabel = String(maxAbsVal);
    }
  } else {
    if (maxAbsVal >= 1_000_000_000) sampleLabel = '1.5B';
    else if (maxAbsVal >= 1_000_000) sampleLabel = '1.5M';
    else if (maxAbsVal >= 1_000) sampleLabel = '1.5K';
    else if (maxAbsVal >= 100) sampleLabel = '100';
    else if (maxAbsVal >= 10) sampleLabel = '10';
    else sampleLabel = '0.0';
  }
  const hasNeg = data.some((r) => Number(r[yField]) < 0);
  const labelEst = (hasNeg ? '-' : '') + sampleLabel;
  return estimateTextWidth(labelEst, baseFontSize, 400) + 10;
}

/**
 * Compile a LayerSpec with independent y-scales (dual-axis chart).
 *
 * Layer 0 gets the left y-axis, layer 1 gets the right y-axis.
 * Both layers share the x-axis. Limited to exactly 2 layers.
 */
function compileLayerIndependent(
  leaves: ChartSpec[],
  layerSpec: LayerSpec,
  options: CompileOptions,
): ChartLayout {
  if (leaves.length > 2) {
    throw new Error(
      'Independent y-scales support at most 2 layers (left and right y-axis). ' +
        `Got ${leaves.length} layers.`,
    );
  }

  const leaf0 = leaves[0];
  const leaf1 = leaves[1];

  // Validate x-field types are compatible
  const xType0 = leaf0.encoding?.x?.type;
  const xType1 = leaf1.encoding?.x?.type;
  if (xType0 && xType1 && xType0 !== xType1) {
    throw new Error(
      `Dual-axis charts require matching x-field types across layers. ` +
        `Layer 0 has '${xType0}', layer 1 has '${xType1}'.`,
    );
  }

  // Estimate right-axis label width to reserve margin space.
  // Tick labels sit at chartEdge+6 and extend rightward by their width.
  // The rotated title sits at chartEdge+45 and extends by half the font height.
  // These overlap spatially, so use max (not sum) to mirror the left-margin pattern.
  const theme = resolveTheme(layerSpec.theme ?? leaf1.theme);
  const axisFontSize = theme.fonts?.sizes?.axisTick ?? 11;
  const rightAxisWidth = estimateYAxisLabelWidth(leaf1.data, leaf1.encoding, axisFontSize);
  const yAxisConfig = leaf1.encoding?.y?.axis || undefined;
  const hasRightAxisTitle = !!yAxisConfig?.title;
  const tickExtent = TICK_LABEL_OFFSET + rightAxisWidth;
  const bodyFontSize = theme.fonts?.sizes?.body ?? 13;
  const axisTitleOffset = getAxisTitleOffset(options.width);
  const halfGlyph = Math.ceil(bodyFontSize / 2);
  const titleExtent = hasRightAxisTitle
    ? axisTitleOffset +
      halfGlyph +
      (options.width < BREAKPOINT_COMPACT_MAX ? 0 : AXIS_TITLE_TRAILING_PAD)
    : 0;
  const rightReserve = Math.max(tickExtent, titleExtent);

  const optionsWithReserve: CompileOptions = {
    ...options,
    rightAxisReserve: rightReserve,
  };

  // Union x-data so both layers see the full x-domain.
  // Each layer keeps its own y-data for independent y-scales.
  const xField0 = leaf0.encoding?.x?.field;
  const xField1 = leaf1.encoding?.x?.field;
  const unionXValues = new Set<unknown>();
  if (xField0) for (const row of leaf0.data) unionXValues.add(row[xField0]);
  if (xField1) for (const row of leaf1.data) unionXValues.add(row[xField1]);

  // Add missing x-values from leaf1 into leaf0's data as stub rows,
  // and vice versa, so both scales see the full x-domain.
  let leaf0WithUnionX = ensureXDomainCoverage(leaf0, xField0, unionXValues);
  let leaf1WithUnionX = ensureXDomainCoverage(leaf1, xField1, unionXValues);

  // Align y-domains so zero maps to the same pixel position on both axes
  const aligned = alignYDomains(leaf0WithUnionX, leaf1WithUnionX);
  if (aligned) {
    leaf0WithUnionX = withYDomain(leaf0WithUnionX, aligned.domain0);
    leaf1WithUnionX = withYDomain(leaf1WithUnionX, aligned.domain1);
  }

  // Compile layer 0 as the primary layout (chrome, x-axis, left y-axis)
  const primary0 = buildPrimarySpec([leaf0WithUnionX], layerSpec);
  const layout0 = compileChart(primary0, optionsWithReserve);

  // Compile layer 1 independently for its own y-axis and marks.
  // Keep chrome identical to layer 0 so both compile against the same chart area dimensions.
  // layout1's chrome is never rendered -- we spread layout0 into the final return value.
  const primary1 = buildPrimarySpec([leaf1WithUnionX], layerSpec);
  primary1.annotations = [];
  const layout1 = compileChart(primary1, optionsWithReserve);

  // Extract layer 1's y-axis, reposition it to the right side
  const y2Axis = layout1.axes.y
    ? {
        ...layout1.axes.y,
        orient: 'right' as const,
        gridlines: [], // Only left y-axis produces gridlines
        start: {
          x: layout0.area.x + layout0.area.width,
          y: layout0.area.y,
        },
        end: {
          x: layout0.area.x + layout0.area.width,
          y: layout0.area.y + layout0.area.height,
        },
      }
    : undefined;

  // Build a per-category x-position map from whichever layer uses a band scale (bars).
  // Band-scale tick positions are band centers -- the canonical x positions that both
  // layers should align to. Line/area marks use a point scale and land at different pixels.
  // We remap line/area mark x-coordinates by looking up each data row's x-field value
  // in the band-center map, replacing point-scale positions with exact band centers.
  const layer0HasBars = layout0.marks.some((m) => m.type === 'rect');
  const layer1HasBars = layout1.marks.some((m) => m.type === 'rect');

  // Build category → band-center-pixel map from the bar layer's x-axis ticks
  const bandCenterByCategory = new Map<string, number>();
  if (layer0HasBars && layout0.axes.x?.ticks) {
    for (const tick of layout0.axes.x.ticks) {
      bandCenterByCategory.set(String(tick.label), tick.position);
    }
  } else if (layer1HasBars && layout1.axes.x?.ticks) {
    for (const tick of layout1.axes.x.ticks) {
      bandCenterByCategory.set(String(tick.label), tick.position);
    }
  }

  // Remap line/area/point mark x-coordinates to band centers using data rows.
  // The SVG path strings are kept as-is (the smooth curve is close enough to correct
  // after a small x-shift). Only the discrete coordinate arrays and dot positions
  // are remapped so tooltips and point markers land on bar centers.
  const remapMarkX = (xField: string | undefined, mark: Mark): Mark => {
    if (!xField || bandCenterByCategory.size === 0) return mark;
    if (mark.type === 'line') {
      const newPoints = mark.points.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newDataPoints = mark.dataPoints?.map((dp, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...dp, x: bx } : dp;
      });
      // Regenerate the smooth monotone path from remapped points so the rendered
      // line passes through bar centers with the same curve quality as the original.
      // Uses curveMonotoneX regardless of the original interpolation -- preserving the
      // user-specified curve across x-remapping would require re-resolving the mark's
      // interpolation setting, which isn't stored on LineMark post-compilation.
      const newPath =
        d3line<{ x: number; y: number }>()
          .x((p) => p.x)
          .y((p) => p.y)
          .curve(curveMonotoneX)(newPoints) ?? undefined;
      return { ...mark, points: newPoints, dataPoints: newDataPoints, path: newPath };
    }
    if (mark.type === 'area') {
      const newTopPoints = mark.topPoints.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newBottomPoints = mark.bottomPoints.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newDataPoints = mark.dataPoints?.map((dp, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...dp, x: bx } : dp;
      });
      // Regenerate area fill path and top-line stroke path from remapped points.
      const areaGen = d3area<{ x: number; yTop: number; yBottom: number }>()
        .x((p) => p.x)
        .y0((p) => p.yBottom)
        .y1((p) => p.yTop)
        .curve(curveMonotoneX);
      const topLineGen = d3line<{ x: number; yTop: number }>()
        .x((p) => p.x)
        .y((p) => p.yTop)
        .curve(curveMonotoneX);
      const combined = newTopPoints.map((tp, i) => ({
        x: tp.x,
        yTop: tp.y,
        yBottom: newBottomPoints[i]?.y ?? tp.y,
      }));
      const newPath = areaGen(combined) ?? '';
      const newTopPath = topLineGen(combined) ?? '';
      return {
        ...mark,
        topPoints: newTopPoints,
        bottomPoints: newBottomPoints,
        dataPoints: newDataPoints,
        path: newPath,
        topPath: newTopPath,
      };
    }
    if (mark.type === 'point') {
      const bx = bandCenterByCategory.get(String(mark.data[xField] ?? ''));
      return bx !== undefined ? { ...mark, cx: bx } : mark;
    }
    return mark;
  };

  // Apply remapping to whichever layer has line/area marks (point scale)
  const adjustedMarks0 =
    bandCenterByCategory.size > 0 && !layer0HasBars
      ? layout0.marks.map((m) => remapMarkX(xField0, m))
      : layout0.marks;

  // Tag layer 1 marks with yScale: 'y2' and remap x if needed
  const taggedMarks1 = layout1.marks.map((mark) => {
    const tagged = { ...mark, yScale: 'y2' as const };
    if (bandCenterByCategory.size > 0 && !layer1HasBars) {
      return remapMarkX(xField1, tagged) as typeof tagged;
    }
    return tagged;
  });

  // Merge legend entries with deduplication
  const seenLabels = new Set<string>();
  const l0Legend = layout0.legend;
  const l1Legend = layout1.legend;
  const mergedLegendEntries = 'entries' in l0Legend ? [...l0Legend.entries] : [];
  for (const entry of mergedLegendEntries) seenLabels.add(entry.label);
  const l1Entries = 'entries' in l1Legend ? l1Legend.entries : [];
  for (const entry of l1Entries) {
    if (!seenLabels.has(entry.label)) {
      seenLabels.add(entry.label);
      mergedLegendEntries.push(entry);
    }
  }

  // Merge tooltip descriptors. Layer 1 marks are appended after layer 0's marks,
  // so their render indices start at layout0.marks.length. The descriptor keys
  // for discrete marks (rect, point, arc) are "type-${index}" where index is the
  // mark's position in the final combined array. Re-key them with the correct offset.
  const l0Count = layout0.marks.length;
  const mergedTooltips = new Map(layout0.tooltipDescriptors);
  for (const [key, value] of layout1.tooltipDescriptors) {
    const match = /^(rect|point|arc)-(\d+)$/.exec(key);
    if (match) {
      const offsetKey = `${match[1]}-${Number(match[2]) + l0Count}`;
      mergedTooltips.set(offsetKey, value);
    } else {
      // Line/area tooltips are keyed by series name, not index -- pass through as-is
      mergedTooltips.set(key, value);
    }
  }

  // Determine mark render order. By default, layer 0 paints first (behind),
  // layer 1 paints second (on top). zIndex on the original leaf specs can
  // reverse this so e.g. a line in layer 0 renders on top of bars in layer 1.
  const z0 = leaf0.zIndex ?? 0;
  const z1 = leaf1.zIndex ?? 1;
  const marks =
    z0 <= z1 ? [...adjustedMarks0, ...taggedMarks1] : [...taggedMarks1, ...adjustedMarks0];

  return {
    ...layout0,
    axes: {
      x: layout0.axes.x,
      y: layout0.axes.y,
      y2: y2Axis,
    },
    marks,
    legend: {
      ...layout0.legend,
      ...('entries' in l0Legend ? { entries: mergedLegendEntries } : {}),
    } as typeof layout0.legend,
    tooltipDescriptors: mergedTooltips,
  };
}

/**
 * Ensure a leaf's data covers the full x-domain by adding stub rows for
 * missing x-values. This keeps scales consistent across layers without
 * injecting scale.domain directly.
 */
function ensureXDomainCoverage(
  leaf: ChartSpec,
  xField: string | undefined,
  allXValues: Set<unknown>,
): ChartSpec {
  if (!xField || allXValues.size === 0) return leaf;

  const existingXValues = new Set<unknown>();
  for (const row of leaf.data) existingXValues.add(row[xField]);

  const missingRows: DataRow[] = [];
  for (const xVal of allXValues) {
    if (!existingXValues.has(xVal)) {
      missingRows.push({ [xField]: xVal });
    }
  }

  if (missingRows.length === 0) return leaf;

  return {
    ...leaf,
    data: [...leaf.data, ...missingRows],
  };
}

/**
 * Compute aligned y-domains for two layers so that zero maps to the same
 * pixel position on both axes. Returns explicit [min, max] domains for each
 * layer, or undefined if alignment isn't applicable (non-quantitative axes,
 * or neither domain spans zero).
 */
function alignYDomains(
  leaf0: ChartSpec,
  leaf1: ChartSpec,
): { domain0: [number, number]; domain1: [number, number] } | undefined {
  const yEnc0 = leaf0.encoding?.y;
  const yEnc1 = leaf1.encoding?.y;
  if (!yEnc0 || !yEnc1) return undefined;
  if (yEnc0.type !== 'quantitative' || yEnc1.type !== 'quantitative') return undefined;

  // Skip if either layer has an explicit domain already set by the user
  if (yEnc0.scale?.domain || yEnc1.scale?.domain) return undefined;

  const includeZero0 = yEnc0.scale?.zero !== false;
  const includeZero1 = yEnc1.scale?.zero !== false;

  const vals0 = leaf0.data.map((r) => Number(r[yEnc0.field])).filter(Number.isFinite);
  const vals1 = leaf1.data.map((r) => Number(r[yEnc1.field])).filter(Number.isFinite);
  if (vals0.length === 0 || vals1.length === 0) return undefined;

  // Compute nice domains for each (mirroring buildLinearScale behavior)
  const niced = (vals: number[], includeZero: boolean): [number, number] => {
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (includeZero) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    }
    const s = scaleLinear().domain([lo, hi]);
    s.nice();
    const [dLo, dHi] = s.domain();
    return [dLo, dHi];
  };

  const [min0, max0] = niced(vals0, includeZero0);
  const [min1, max1] = niced(vals1, includeZero1);

  const span0 = max0 - min0;
  const span1 = max1 - min1;
  if (span0 === 0 || span1 === 0) return undefined;

  // Zero fraction: how far up from the bottom zero sits (0 = bottom, 1 = top).
  // Only align when BOTH domains naturally contain zero. If one axis is entirely
  // positive or entirely negative (zero is outside the domain), forcing alignment
  // would push the other axis into an unnatural range. In that case, let each
  // axis render its natural domain independently.
  const zf0 = (0 - min0) / span0;
  const zf1 = (0 - min1) / span1;

  const zeroInDomain0 = zf0 >= -0.001 && zf0 <= 1.001;
  const zeroInDomain1 = zf1 >= -0.001 && zf1 <= 1.001;
  if (!zeroInDomain0 || !zeroInDomain1) return undefined;

  // If both zeros are at the same position (within tolerance), no adjustment needed
  if (Math.abs(zf0 - zf1) < 0.001) {
    return { domain0: [min0, max0], domain1: [min1, max1] };
  }

  // Align by extending domains so zero sits at the same proportional position.
  // Keep the niced boundaries on the side that doesn't need extending, and
  // compute the exact extended boundary (no re-nicing) so zero stays locked.
  const targetZf = Math.max(zf0, zf1);

  const align = (dMin: number, dMax: number, currentZf: number): [number, number] => {
    if (Math.abs(currentZf - targetZf) < 0.001) return [dMin, dMax];

    if (targetZf > currentZf) {
      // Need more negative range: newMin = -(targetZf / (1 - targetZf)) * dMax
      const newMin = -(targetZf / (1 - targetZf)) * dMax;
      return [newMin, dMax];
    }
    // Need more positive range: newMax = -dMin * (1 - targetZf) / targetZf
    const newMax = (-dMin * (1 - targetZf)) / targetZf;
    return [dMin, newMax];
  };

  const domain0 = align(min0, max0, zf0);
  const domain1 = align(min1, max1, zf1);

  return { domain0, domain1 };
}

/**
 * Inject an explicit y-scale domain override into a leaf spec.
 */
function withYDomain(leaf: ChartSpec, domain: [number, number]): ChartSpec {
  if (!leaf.encoding?.y) return leaf;
  return {
    ...leaf,
    encoding: {
      ...leaf.encoding,
      y: {
        ...leaf.encoding.y,
        scale: {
          ...leaf.encoding.y.scale,
          domain,
        },
      },
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
    annotations: layerSpec.annotations ?? leaves[0].annotations,
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

// ---------------------------------------------------------------------------
// TileMap compilation
// ---------------------------------------------------------------------------

/**
 * Compile a tilemap spec into a TileMapLayout.
 *
 * Takes a raw tilemap spec, validates, normalizes, resolves theme and chrome,
 * computes tile positions, builds tile marks with colors and labels, and
 * returns a TileMapLayout ready for rendering.
 *
 * @param spec - Raw tilemap spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns TileMapLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a tilemap type.
 */
export function compileTileMap(
  spec: unknown,
  options: CompileOptions,
): import('@opendata-ai/openchart-core').TileMapLayout {
  return compileTileMapImpl(spec, options);
}

// ---------------------------------------------------------------------------
// BarList compilation
// ---------------------------------------------------------------------------

/**
 * Compile a barlist spec into a BarListLayout.
 *
 * Takes a raw barlist spec, validates, normalizes, resolves theme and chrome,
 * computes row layout with proportional bars, builds tooltips, and returns
 * a BarListLayout ready for rendering.
 *
 * @param spec - Raw barlist spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns BarListLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a barlist type.
 */
export function compileBarList(
  spec: unknown,
  options: CompileOptions,
): import('@opendata-ai/openchart-core').BarListLayout {
  return compileBarListImpl(spec, options);
}
