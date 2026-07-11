/**
 * Main compile API: the public entry points for the engine.
 *
 * Pipeline for charts:
 *   validate spec -> normalize -> resolve theme -> dark mode adapt ->
 *   filter data -> resolveLayoutPlan (measure real labels) ->
 *   compute dimensions (with plan) -> placeLegend ->
 *   compute scales -> compute axes (with pinned ticks) -> compute gridlines ->
 *   get chart renderer -> compute marks -> compute a11y -> return ChartLayout
 *
 * Table compiler handles full data pipeline (sort, search, pagination, visual enhancements).
 * Graph compiler is a stub for future implementation.
 */

import type {
  AnimationSpec,
  ChartLayout,
  ChartSpec,
  CompileOptions,
  CompileTableOptions,
  Encoding,
  FacetChannel,
  FacetPanelLayout,
  LayerSpec,
  LayoutStrategy,
  Mark,
  ResolvedAnimation,
  ResolvedAnnotation,
  ResolvedTheme,
  TableLayout,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  computeLabelBounds,
  generateAltText,
  generateDataTable,
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { computeAnnotations } from './annotations/compute';
import { type AnnotationMeasureTextFn, heuristicMeasure } from './annotations/geometry';
import type { PlacementObstacle } from './annotations/placement';
import { thinAnnotations } from './annotations/thinning';
import { computeEndpointLabels } from './endpoint-labels/compute';
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
import { groupByField } from './charts/utils';
import { applyColorScaleRange } from './compile/color-scale-range';
import { filterClippedDomains } from './compile/data-clip';
import { compileLayer as compileLayerImpl } from './compile/layer';
import { emitSpecWarnings, expandSpecSugar } from './compile/spec-sugar';
import { computeWatermarkObstacle } from './compile/watermark-obstacle';
import { resolveAnimation } from './compiler/animation';
import { compile as compileSpec } from './compiler/index';
import {
  buildSparklineAreaGradient,
  computeTrendFromData,
  hasExplicitColor,
  trendColor,
} from './compiler/sparkline-defaults';
import type { NormalizedChartSpec, NormalizedTableSpec } from './compiler/types';
import { compileGraph as compileGraphImpl } from './graphs/compile-graph';
import type { GraphCompilation } from './graphs/types';
import { computeAxes } from './layout/axes';
import { computeDimensions } from './layout/dimensions';
import { computeFacetGrid } from './layout/facet';
import { computeGridlines } from './layout/gridlines';
import { createMeasureFn, resolveLayoutPlan } from './layout/plan';
import { computeScales } from './layout/scales';
import { placeLegend } from './legend/compute';
import { compileSankey as compileSankeyImpl } from './sankey/compile-sankey';
import { compileTableLayout } from './tables/compile-table';
import { compileTileMap as compileTileMapImpl } from './tilemap/compile-tilemap';
import { computeTooltipDescriptors } from './tooltips/compute';
import { runTransforms } from './transforms';

// ---------------------------------------------------------------------------
// Spec sugar expansion (VL idioms, bin/timeUnit, deprecation warnings)
// ---------------------------------------------------------------------------

// Implementation lives in ./compile/spec-sugar; re-exported here so existing
// deep imports (`import { expandEncodingSugar } from '.../compile'`) keep working.
export { expandEncodingSugar, expandSpecSugar } from './compile/spec-sugar';

/**
 * Apply top-level spec `width`/`height` (VL fixed-size sugar) as overrides on
 * the compile options. Returns the options untouched when the spec carries no
 * size.
 */
function applySpecSize(spec: unknown, options: CompileOptions): CompileOptions {
  if (!spec || typeof spec !== 'object') return options;
  const sized = spec as Record<string, unknown>;
  if (typeof sized.width !== 'number' && typeof sized.height !== 'number') return options;
  return {
    ...options,
    width: typeof sized.width === 'number' ? sized.width : options.width,
    height: typeof sized.height === 'number' ? sized.height : options.height,
  };
}

// ---------------------------------------------------------------------------
// Chart compilation
// ---------------------------------------------------------------------------

/**
 * Inject sparkline-mode visual defaults that depend on the resolved theme.
 *
 * Trend-aware color (positive/negative/neutral), default endpoint dot,
 * default area gradient, and default pill cornerRadius for bars. Each
 * default backs off when the user has set the corresponding markDef
 * field. Bar marks do NOT get trend coloring — the design intent is a
 * single palette color across all bars.
 */
function applySparklineDefaults(
  spec: NormalizedChartSpec,
  theme: ResolvedTheme,
): NormalizedChartSpec {
  const markType = spec.markType;
  const isLineFamily = markType === 'line' || markType === 'area';
  const isBar = markType === 'bar';
  if (!isLineFamily && !isBar) return spec;

  const yField = spec.encoding.y && 'field' in spec.encoding.y ? spec.encoding.y.field : undefined;
  const trend = computeTrendFromData(spec.data, yField);
  const color = trendColor(trend, theme);

  const encodingHasColor =
    !!spec.encoding.color && (spec.encoding.color as { field?: unknown }).field !== undefined;
  const explicit = hasExplicitColor(spec.markDef, encodingHasColor);

  const newMarkDef = { ...spec.markDef };

  if (isLineFamily) {
    if (!explicit.stroke) newMarkDef.stroke = color;
    if (markType === 'area' && !explicit.fill) {
      newMarkDef.fill = buildSparklineAreaGradient(color);
    }
    // Endpoint dot is wired in the line compute path. We skip the default
    // when the encoding has a color field, because the multi-series area
    // path (linesFromAreas()) ignores markDef.point — the dot would be set
    // on the spec but never rendered, and the line compute path's dot logic
    // is per-series, not "one dot for the chart."
    if (newMarkDef.point === undefined && !encodingHasColor) {
      newMarkDef.point = 'last';
    }
  }

  if (isBar) {
    // Pill cornerRadius is safe on stacked bars too — the column compute
    // path applies the radius only to the topmost segment via
    // `cornerRadiusSides`, leaving the seams between segments square so
    // they stay flush. Single-series bars get all four corners rounded
    // since there's nothing below them to align against.
    if (newMarkDef.cornerRadius === undefined) {
      newMarkDef.cornerRadius = 'pill';
    }
  }

  return { ...spec, markDef: newMarkDef };
}

/**
 * Compile a chart spec into a ChartLayout.
 *
 * This is the main engine entry point. Takes a raw spec (any shape,
 * validated at runtime) and compile options, produces a fully resolved
 * ChartLayout with positions, colors, and marks ready for rendering.
 *
 * @param spec - Raw chart spec (validated and normalized internally).
 * @param optionsInput - Compile options (width, height, theme, darkMode).
 *   Top-level spec width/height, when present, override the option values.
 * @returns ChartLayout with all computed positions.
 * @throws Error if spec is invalid or not a chart type.
 */
export function compileChart(spec: unknown, optionsInput: CompileOptions): ChartLayout {
  // Expand VL-idiom and encoding-level sugar (data {values}, top-level title,
  // sort-by-value, value defs, scheme names, theta, bin/timeUnit, ...) before
  // validation + normalization, surfacing any deprecation warnings.
  const sugarWarnings: string[] = [];
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandSpecSugar(spec as Record<string, unknown>, sugarWarnings)
      : spec;
  emitSpecWarnings(sugarWarnings);

  // Top-level width/height are fixed-size overrides (VL alignment): the
  // authored size wins over the container-derived compile options.
  const options = applySpecSize(expandedSpec, optionsInput);

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
    endpointLabels:
      rawSpec.endpointLabels !== undefined ||
      (bpForExplicit as Record<string, unknown> | undefined)?.endpointLabels !== undefined,
    // Axis explicitness tracks "user opted IN to render the axis" — `axis: false`
    // is an explicit opt-OUT and must not flip these flags on. Sparkline mode
    // reads them to decide whether to reserve axis space; treating `false` as
    // explicit would leave a phantom gutter for an axis that won't render.
    xAxis:
      (rawEncoding?.x?.axis !== undefined && rawEncoding.x.axis !== false) ||
      (bpEncoding?.x?.axis !== undefined && bpEncoding.x.axis !== false),
    yAxis:
      (rawEncoding?.y?.axis !== undefined && rawEncoding.y.axis !== false) ||
      (bpEncoding?.y?.axis !== undefined && bpEncoding.y.axis !== false),
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

  // Crosshair: explicit user value at any level wins. Default is ON for line
  // and area marks in full mode (the hover guideline + per-series tooltip is
  // the standard interaction pattern for time-series charts). Sparkline mode
  // defaults off. The value is plumbed through ChartLayout so the renderer
  // doesn't need to re-inspect the raw spec.
  const rawCrosshair = (bpForExplicit?.crosshair ?? rawSpec.crosshair) as boolean | undefined;
  const isLineOrAreaMark = chartSpec.markType === 'line' || chartSpec.markType === 'area';
  const crosshairDefault = chartSpec.display === 'sparkline' ? false : isLineOrAreaMark;
  const crosshair = chartSpec.userExplicit.crosshair ? rawCrosshair === true : crosshairDefault;

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

  // Sparkline mode: inject smart defaults that depend on the resolved theme
  // (trend-aware color, area gradient, default endpoint dot, pill cornerRadius
  // for bars). Each default backs off when the user has set the corresponding
  // field explicitly. Must run AFTER theme resolution (color depends on theme)
  // and BEFORE computeDimensions (which reads markDef.point for sparkline padding).
  if (chartSpec.display === 'sparkline') {
    chartSpec = applySparklineDefaults(chartSpec, theme);
  }

  // ---------------------------------------------------------------------------
  // Data filtering: move BEFORE layout plan so the plan measures real labels
  // from the filtered data set. Legend retains all series via chartSpec
  // (unfiltered); scales and marks use renderSpec (filtered).
  // ---------------------------------------------------------------------------
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
  let renderSpec = renderData !== chartSpec.data ? { ...chartSpec, data: renderData } : chartSpec;

  // Lock the color scale domain to the unfiltered series list so palette
  // assignments stay stable across legend toggles. Without this, hiding a
  // series shrinks the ordinal scale's domain and shifts every remaining
  // series down one palette index -- the visible lines would mismatch the
  // legend swatches that still represent the original assignment.
  // Skipped when the user already supplied an explicit domain.
  const colorEnc = chartSpec.encoding.color;
  if (
    chartSpec.hiddenSeries.length > 0 &&
    colorEnc &&
    'field' in colorEnc &&
    colorEnc.type !== 'quantitative' &&
    colorEnc.scale?.domain == null
  ) {
    const colorField = colorEnc.field;
    const stableDomain = Array.from(new Set(chartSpec.data.map((row) => String(row[colorField]))));
    renderSpec = {
      ...renderSpec,
      encoding: {
        ...renderSpec.encoding,
        color: {
          ...colorEnc,
          scale: { ...(colorEnc.scale ?? {}), domain: stableDomain },
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Faceted compilation: when encoding.facet is present, take the faceted path
  // ---------------------------------------------------------------------------
  const facetChannel = renderSpec.encoding.facet;
  if (facetChannel?.field) {
    return compileFaceted(
      chartSpec,
      renderSpec,
      facetChannel,
      options,
      theme,
      strategy,
      watermark,
      resolvedAnimation,
      crosshair,
    );
  }

  // ---------------------------------------------------------------------------
  // Layout plan: measure real labels, freeze gutter + chrome + legend content
  // ---------------------------------------------------------------------------
  const measure = createMeasureFn(options.measureText);
  const plan = resolveLayoutPlan(
    chartSpec,
    renderSpec,
    options,
    theme,
    strategy,
    watermark,
    measure,
  );

  // Compute dimensions (accounts for chrome + legend + responsive strategy).
  // The plan provides measured leftGutter, xAxisExtent, and chrome so
  // dimensions.ts skips its guess blocks.
  const legendStub = placeLegend(
    plan.legendContent,
    { x: 0, y: 0, width: options.width, height: options.height },
    options.width,
    theme,
    plan.xAxisExtent,
  );
  const dims = computeDimensions(chartSpec, options, legendStub, theme, strategy, watermark, plan);
  // A frozen area (set by compileLayer for leaf layers) overrides the computed
  // one so all layers share the primary layout's coordinate space.
  const chartArea = options.frozenChartArea ?? dims.chartArea;

  // Place legend in its final position relative to the computed chart area.
  // effectiveAxisGap lifts a top legend above the inline-tick overhang zone
  // the margin stack reserved below it.
  const finalLegend = placeLegend(
    plan.legendContent,
    chartArea,
    options.width,
    theme,
    plan.xAxisExtent,
    dims.effectiveAxisGap,
  );

  // Inline y-axis labels: inset the x-scale range start by the widest tick
  // label width so data marks start to the right of the labels. The plan
  // already measured the real tick labels.
  let scaleArea = chartArea;
  if (plan.inlineYLabelInset > 0 && plan.inlineYLabelInset < chartArea.width) {
    scaleArea = {
      x: chartArea.x + plan.inlineYLabelInset,
      y: chartArea.y,
      width: chartArea.width - plan.inlineYLabelInset,
      height: chartArea.height,
    };
  }

  // Compute scales
  const scales = computeScales(renderSpec, scaleArea, renderSpec.data);

  // Update color scale to use theme palette (only when user hasn't provided an explicit range).
  // When highlight is active, assign palette colors to highlighted series and mute the rest.
  applyColorScaleRange(scales, renderSpec.encoding, theme, renderSpec.highlight);

  // INVARIANT 3 -- post-hoc defaultColor: must run AFTER computeScales since resolution needs
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
        markType: chartSpec.markType,
        totalWidth: options.width,
        precomputedYTicks: plan.yTickValues.length > 0 ? plan.yTickValues : undefined,
      });

  // Intentional post-hoc mutation: axes must resolve before we know the x-axis extent.
  const xAxisExtent = axes.x?.extent ?? 0;
  dims.chrome.bottomAnchorY = chartArea.y + chartArea.height + xAxisExtent;

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
  const marks: Mark[] = renderer
    ? renderer(renderSpec, scales, chartArea, strategy, theme, options.width)
    : [];

  // Compute the right-side endpoint labels column for multi-series line/area
  // charts. Reads `mark.dataPoints` so it must run AFTER marks are computed.
  // dimensions.ts already reserved the right margin via predictEndpointLabelsWidth.
  const endpointLabels = computeEndpointLabels(
    chartSpec,
    marks,
    theme,
    chartArea,
    strategy,
    plan.endpointLabelsDemoted,
  );

  // Compute annotations from spec, passing legend + mark + brand bounds as obstacles
  const obstacles: PlacementObstacle[] = [];
  if (finalLegend.bounds.width > 0) {
    obstacles.push({ ...finalLegend.bounds, kind: 'legend' });
  }
  obstacles.push(...computeMarkObstacles(marks, scales));

  // Add visible data label bounds as obstacles so annotations avoid overlapping them
  for (const mark of marks) {
    if ('label' in mark && mark.label?.visible) {
      obstacles.push({ ...computeLabelBounds(mark.label), kind: 'data-label' });
    }
  }

  // Add brand watermark as an obstacle so annotations avoid overlapping it.
  const watermarkRect = computeWatermarkObstacle(dims, watermark, axes, theme);
  if (watermarkRect) obstacles.push({ ...watermarkRect, kind: 'watermark' });

  // Add endpoint label bounds as obstacles
  if (endpointLabels.entries.length > 0 && endpointLabels.bounds.width > 0) {
    obstacles.push({ ...endpointLabels.bounds, kind: 'endpoint-label' });
  }

  const annotationMeasure: AnnotationMeasureTextFn = options.measureText
    ? (text, font) => options.measureText!(text, font.fontSize, font.fontWeight).width
    : heuristicMeasure;

  let annotations: ResolvedAnnotation[] = computeAnnotations(chartSpec, {
    scales,
    chartArea,
    strategy,
    isDark: theme.isDark,
    obstacles,
    svg: { width: dims.total.width, height: dims.total.height },
    measure: annotationMeasure,
    autoThin: chartSpec.autoThin,
  });

  // Auto-thinning: demote overlapping text annotations to footnote markers.
  // Pass the full spec annotations (not filtered to text-only) so index
  // alignment with the resolved array is preserved.
  let footnotes: import('@opendata-ai/openchart-core').AnnotationFootnote[] | undefined;
  if (chartSpec.autoThin && annotations.length > 1) {
    const result = thinAnnotations(annotations, chartSpec.annotations, annotationMeasure);
    annotations = result.annotations;
    if (result.footnotes.length > 0) {
      footnotes = result.footnotes;
    }
  }

  // Compute tooltip descriptors from marks and encoding
  const tooltipDescriptors = computeTooltipDescriptors(chartSpec, marks);

  // Compute accessibility
  const altText = generateAltText(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
      chrome: chartSpec.chrome,
    } as ChartSpec,
    chartSpec.data,
  );
  const dataTableFallback = generateDataTable(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    } as ChartSpec,
    chartSpec.data,
  );

  // Assign animationIndex for stagger ordering when animation is enabled
  assignAnimationIndices(marks, resolvedAnimation);

  const chrome = footnotes ? { ...dims.chrome, footnotes } : dims.chrome;

  return {
    area: chartArea,
    chrome,
    metrics: dims.metrics,
    axes: {
      x: axes.x,
      y: axes.y,
    },
    marks,
    annotations,
    legend: finalLegend,
    ...(endpointLabels.entries.length > 0 ? { endpointLabels } : {}),
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
// Faceted (small-multiples) compilation
// ---------------------------------------------------------------------------

function compileFaceted(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  facetChannel: FacetChannel,
  options: CompileOptions,
  theme: ResolvedTheme,
  strategy: LayoutStrategy,
  watermark: boolean,
  resolvedAnimation: ResolvedAnimation | undefined,
  crosshair: boolean,
): ChartLayout {
  const measure = createMeasureFn(options.measureText);

  // Strip facet from encoding before passing to per-panel pipeline (panels
  // don't know they're faceted -- they compile as regular single charts).
  const panelEncoding = { ...renderSpec.encoding };
  delete (panelEncoding as Record<string, unknown>).facet;
  const panelSpec = { ...renderSpec, encoding: panelEncoding };
  const panelChartSpec = { ...chartSpec, encoding: panelEncoding };

  // Partition data by facet field
  const groups = groupByField(renderSpec.data, facetChannel.field);
  const facetValues = Array.from(groups.keys());
  if (facetChannel.sort !== null) {
    const dir = facetChannel.sort === 'descending' ? -1 : 1;
    facetValues.sort((a, b) => dir * a.localeCompare(b));
  }

  // Compute figure-level chrome and dimensions using the full dataset
  // (no facet channel so it compiles normally). We use a representative
  // single-panel spec to get chrome + legend measurements.
  const plan = resolveLayoutPlan(
    panelChartSpec,
    panelSpec,
    options,
    theme,
    strategy,
    watermark,
    measure,
  );
  const legendStub = placeLegend(
    plan.legendContent,
    { x: 0, y: 0, width: options.width, height: options.height },
    options.width,
    theme,
    plan.xAxisExtent,
  );
  const dims = computeDimensions(
    panelChartSpec,
    options,
    legendStub,
    theme,
    strategy,
    watermark,
    plan,
  );
  const chartArea = dims.chartArea;

  // Same effectiveAxisGap threading as the regular (non-faceted) path.
  const finalLegend = placeLegend(
    plan.legendContent,
    chartArea,
    options.width,
    theme,
    plan.xAxisExtent,
    dims.effectiveAxisGap,
  );

  // Estimate y-axis gutter width (used as left reservation for outer axes)
  const leftReservation = plan.leftGutter;
  // Estimate x-axis extent (used as bottom reservation for outer axes)
  const bottomReservation = plan.xAxisExtent;

  // Compute facet grid geometry
  const grid = computeFacetGrid(facetValues, facetChannel.columns, chartArea, {
    left: leftReservation,
    bottom: bottomReservation,
  });

  // Resolve scale for determining if we use 'independent' or 'shared'
  const resolveConfig = chartSpec.resolve;
  const yResolve = resolveConfig?.scale?.y ?? 'shared';
  const xResolve = resolveConfig?.scale?.x ?? 'shared';

  // Compute shared scale domains from the full dataset (when shared)
  const fullScales = computeScales(panelSpec, chartArea, renderSpec.data);
  const sharedXDomain =
    xResolve === 'shared' && fullScales.x ? fullScales.x.scale.domain() : undefined;
  const sharedYDomain =
    yResolve === 'shared' && fullScales.y ? fullScales.y.scale.domain() : undefined;

  const isRadial = chartSpec.markType === 'arc';
  const rendererKey = resolveRendererKey(
    renderSpec.markType,
    panelEncoding as Encoding,
    renderSpec.markDef,
  );
  const renderer = getChartRenderer(rendererKey);

  const allMarks: Mark[] = [];
  const panelLayouts: FacetPanelLayout[] = [];

  for (const gridPanel of grid.panels) {
    const panelData = groups.get(gridPanel.key) ?? [];
    const panelSpecLocal = { ...panelSpec, data: panelData };

    // Inject shared domains via scale.domain on the encoding channels
    let panelEnc = { ...panelEncoding } as Record<string, unknown>;
    if (sharedXDomain && panelEnc.x) {
      const xCh = panelEnc.x as Record<string, unknown>;
      panelEnc = {
        ...panelEnc,
        x: { ...xCh, scale: { ...((xCh.scale as object) ?? {}), domain: sharedXDomain } },
      };
    }
    if (sharedYDomain && panelEnc.y) {
      const yCh = panelEnc.y as Record<string, unknown>;
      panelEnc = {
        ...panelEnc,
        y: { ...yCh, scale: { ...((yCh.scale as object) ?? {}), domain: sharedYDomain } },
      };
    }
    const panelSpecWithDomains = {
      ...panelSpecLocal,
      encoding: panelEnc as unknown as typeof panelSpec.encoding,
    };

    // Compute scales for this panel's area
    const panelScales = computeScales(panelSpecWithDomains, gridPanel.area, panelData);
    applyColorScaleRange(panelScales, panelSpecWithDomains.encoding, theme, renderSpec.highlight);
    panelScales.defaultColor =
      chartSpec.markDef.fill ?? chartSpec.markDef.stroke ?? theme.colors.categorical[0];

    // Outer-axis economy: only leftmost column gets y ticks, only bottom row gets x ticks.
    // Exception: when scales are independent, every panel needs its own axis ticks.
    const isLeftCol = gridPanel.col === 0;
    const isBottomRow = gridPanel.row === grid.rows - 1;

    const panelAxes = isRadial
      ? { x: undefined, y: undefined }
      : computeAxes(panelScales, gridPanel.area, strategy, theme, options.measureText, {
          data: panelData,
          encoding: panelSpecWithDomains.encoding as Encoding,
          skipX: xResolve === 'shared' ? !isBottomRow : false,
          skipY: yResolve === 'shared' ? !isLeftCol : false,
          markType: chartSpec.markType,
          totalWidth: gridPanel.area.width,
        });

    if (!isRadial) {
      computeGridlines(panelAxes, gridPanel.area);
    }

    // Compute marks for this panel
    const panelMarks: Mark[] = renderer
      ? renderer(
          panelSpecWithDomains,
          panelScales,
          gridPanel.area,
          strategy,
          theme,
          gridPanel.area.width,
        )
      : [];

    // Compute annotations for this panel
    const annotationMeasure: AnnotationMeasureTextFn = options.measureText
      ? (text, font) => options.measureText!(text, font.fontSize, font.fontWeight).width
      : heuristicMeasure;
    const panelAnnotations = computeAnnotations(panelSpecWithDomains, {
      scales: panelScales,
      chartArea: gridPanel.area,
      strategy,
      isDark: theme.isDark,
      obstacles: [],
      svg: { width: options.width, height: options.height },
      measure: annotationMeasure,
      autoThin: panelSpecWithDomains.autoThin,
    });

    allMarks.push(...panelMarks);

    panelLayouts.push({
      key: gridPanel.key,
      area: gridPanel.area,
      marks: panelMarks,
      axes: { x: panelAxes.x, y: panelAxes.y },
      annotations: panelAnnotations,
      header: {
        text: gridPanel.key,
        x: gridPanel.headerPos.x,
        y: gridPanel.headerPos.y,
        fontSize: theme.fonts.sizes.body,
        fontWeight: theme.fonts.weights.medium,
      },
    });
  }

  // Compute tooltip descriptors from all marks across panels
  const tooltipDescriptors = computeTooltipDescriptors(panelChartSpec, allMarks);

  // A11y: mention faceting in alt text
  const panelCount = facetValues.length;
  const baseAltText = generateAltText(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
      chrome: chartSpec.chrome,
    } as ChartSpec,
    chartSpec.data,
  );
  const altText = `${baseAltText} Faceted into ${panelCount} panels by ${facetChannel.field}.`;

  const dataTableFallback = generateDataTable(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    } as ChartSpec,
    chartSpec.data,
  );

  // Assign animation indices across all panels
  assignAnimationIndices(allMarks, resolvedAnimation);

  // Figure-level axes are null (axes live in panels)
  // Figure-level marks are the union of all panel marks (for tooltip/keyboard nav)
  return {
    area: chartArea,
    chrome: dims.chrome,
    metrics: dims.metrics,
    axes: { x: undefined, y: undefined },
    marks: allMarks,
    annotations: [],
    legend: finalLegend,
    tooltipDescriptors,
    a11y: {
      altText,
      dataTableFallback,
      role: 'img',
      keyboardNavigable: allMarks.length > 0,
    },
    theme,
    dimensions: { width: options.width, height: options.height },
    animation: resolvedAnimation,
    watermark,
    display: chartSpec.display,
    crosshair,
    measureText: options.measureText,
    facet: {
      panels: panelLayouts,
      facetField: facetChannel.field,
      columns: grid.columns,
      sharedScales: yResolve === 'shared' && xResolve === 'shared',
    },
  };
}

// ---------------------------------------------------------------------------
// Layer compilation
// ---------------------------------------------------------------------------

export function compileLayer(spec: LayerSpec, options: CompileOptions): ChartLayout {
  // Expand VL-idiom sugar on the layer spec and every child up front. Leaf
  // compiles re-run the (idempotent) expansion after encoding inheritance;
  // warning triggers are stripped or stamped here so each warns exactly once.
  const sugarWarnings: string[] = [];
  const expanded = expandSpecSugar(
    spec as unknown as Record<string, unknown>,
    sugarWarnings,
  ) as unknown as LayerSpec;
  emitSpecWarnings(sugarWarnings);
  const resolvedOptions = applySpecSize(expanded, options);
  return compileLayerImpl(expanded, resolvedOptions, compileChart);
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
