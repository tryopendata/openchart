import { attachMarkMetadata } from '../charts/_shared/mark-metadata';
import { fitAxisLabels } from '../layout/axes/fit-labels';
/**
 * Single-chart compilation, in phases:
 *
 *   prepare spec (sugar, validate, transforms, breakpoint override, display
 *   defaults) -> resolve theme -> height context -> render spec (filtered
 *   data) -> [faceted path] -> layout plan -> dimensions -> scales -> axes ->
 *   marks -> endpoint column -> legend -> annotations -> notes -> layout
 */

import type {
  AnnotationFootnote,
  ChartLayout,
  ChartSpec,
  CompileOptions,
  Encoding,
  LayoutStrategy,
  LegendLayout,
  Mark,
  Rect,
  ResolvedAnnotation,
  ResolvedTheme,
  ResponsiveConfig,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  estimateTextWidth,
  isAxislessMark,
  mergeThemeConfig,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { collectPinnedOverlapWarnings } from '../annotations/collisions';
import { computeAnnotations } from '../annotations/compute';
import { annotationNoteLineCount, wrapAnnotationNotes } from '../annotations/notes';
import { resolvePosition } from '../annotations/position';
import { admitReferenceRows } from '../annotations/reference-layout';
import { thinAnnotations } from '../annotations/thinning';
import type { BarLabelPlan } from '../charts/bar/label-plan';
import { emitValueLabelDiagnostic, offsetValueLabelAxes } from '../charts/bar/label-plan';
import {
  assignAnimationIndices,
  isBinnedBarEncoding,
  resolveRendererKey,
} from '../charts/post-process';
import { getChartRenderer } from '../charts/registry';
import { collectContrastWarnings, seriesIdentificationWarnings } from '../compiler/a11y-warnings';
import { resolveMarkRenderMode } from '../compiler/mark-render-mode';
import type { NormalizedChartSpec } from '../compiler/types';
import { diagnoseChart, noteCapacityDiagnostic } from '../design/diagnostics';
import { computeEndpointLabels } from '../endpoint-labels/compute';
import { computeAxes } from '../layout/axes';
import {
  annotationMeasureFn,
  buildSeriesSummary,
  noteBandHeight,
  type ReferenceXResolver,
  referenceLaneFor,
  resolveNoteOverflow,
  scaleAreaFor,
  seriesSummaryLineCount,
} from '../layout/budget';
import { computeDimensions } from '../layout/dimensions';
import { MIN_CHART_WIDTH } from '../layout/frame';
import { computeGridlines } from '../layout/gridlines';
import { createMeasureFn, endpointLabelsDemotedAt, resolveLayoutPlan } from '../layout/plan';
import { computeScales, type ResolvedScales } from '../layout/scales';
import { resolveChromeLayout } from '../layout/shared';
import { placeLegend } from '../legend/compute';
import { placeSizeLegend } from '../legend/size';
import { computeTooltipDescriptors } from '../tooltips/compute';
import { buildChartA11y } from './accessibility';
import { chromeBottomY, collectAnnotationObstacles } from './annotation-obstacles';
import { computeChartScales } from './chart-scales';
import { applySparklineDefaults } from './display-defaults';
import { compileFaceted } from './faceted';
import { applyFillPatterns } from './fill-patterns';
import { type HeightContext, heightContextResolver, isCompactContainer } from './height-context';
import type { InternalCompileOptions } from './internal-options';
import { type PreparedChart, prepareChartSpec } from './prepare';
import { buildRenderSpec, desugarRowColumn } from './render-spec';
import { resolveScaleInvert } from './scale-invert';
import { previewSeriesSummary } from './series-summary';
import { emitSpecWarnings } from './spec-sugar';
import { resolveYouDrawIt } from './you-draw-it';

/** Merge the spec theme with host overrides, then adapt for dark mode. */
export function resolveCompileTheme(
  specTheme: Parameters<typeof mergeThemeConfig>[0],
  options: CompileOptions,
): ResolvedTheme {
  const theme = resolveTheme(mergeThemeConfig(specTheme, options.theme));
  return options.darkMode ? adaptTheme(theme) : theme;
}

/** Internal passes use options validated at the public authored boundary. */
export function compileChartInternal(
  spec: unknown,
  optionsInput: InternalCompileOptions,
): ChartLayout {
  const prepared = prepareChartSpec(spec, optionsInput);
  const { options } = prepared;
  let { chartSpec } = prepared;

  const theme = resolveCompileTheme(chartSpec.theme, options);

  // Emitted once the layout resolves (facets emit them with their panels).
  const seriesWarnings = seriesIdentificationWarnings(chartSpec);

  const heightContext = heightContextResolver({
    options,
    breakpoint: prepared.breakpoint,
    chartSpec,
    theme,
    annotationsInline: prepared.annotationsInline,
    watermarkAt: prepared.watermarkAt,
  });
  const sizing = heightContext(options.height);

  // Sparkline mode: inject smart defaults that depend on the resolved theme
  // (trend-aware color, area gradient, default endpoint dot, pill cornerRadius
  // for bars). Each default backs off when the user has set the corresponding
  // field explicitly. Must run AFTER theme resolution (color depends on theme)
  // and BEFORE computeDimensions (which reads markDef.point for sparkline padding).
  if (chartSpec.display === 'sparkline') {
    chartSpec = applySparklineDefaults(chartSpec, theme);
  }

  const desugared = desugarRowColumn(chartSpec, buildRenderSpec(chartSpec));
  chartSpec = desugared.chartSpec;
  const renderSpec = desugared.renderSpec;

  const facetChannel = renderSpec.encoding.facet;
  if (facetChannel?.field) {
    // An authored fixed height in subtract mode is a hard budget: the grid
    // never grows past it.
    const fixedHeight =
      typeof prepared.rawSpec.height === 'number' &&
      (prepared.rawSpec.chromeLayout ?? options.chromeLayout) === 'subtract';
    const layout = compileFaceted(
      chartSpec,
      renderSpec,
      facetChannel,
      desugared.direction,
      theme,
      prepared.resolvedAnimation,
      prepared.crosshair,
      seriesWarnings,
      sizing,
      fixedHeight
        ? undefined
        : (height) => {
            const grown = heightContext(height);
            // The figure-level reserve never shrinks as the grid grows.
            return { ...grown, noteReserve: Math.max(sizing.noteReserve, grown.noteReserve) };
          },
      options.onDiagnostic,
    );
    const diagnostic = noteCapacityDiagnostic(layout);
    if (diagnostic) options.onDiagnostic?.(diagnostic);
    return layout;
  }

  const layout = layoutSingleChart({
    spec,
    prepared,
    chartSpec,
    renderSpec,
    theme,
    sizing,
  });
  emitSpecWarnings(seriesWarnings, options.onWarn);
  if (options.onDiagnostic) {
    // Diagnostics inspect the same rows/fields as the compiled scene, including
    // data.values and derived channels. Fixes still target the authored document.
    const diagnosticSpec = {
      ...(prepared.expandedSpec as ChartSpec),
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    } as ChartSpec;
    for (const diagnostic of diagnoseChart(diagnosticSpec, layout)) {
      if (diagnostic.fix) diagnostic.fix.precondition = JSON.stringify(spec);
      options.onDiagnostic(diagnostic);
    }
  }
  return layout;
}

interface SingleChartInput {
  /** The authored spec, before sugar expansion. */
  spec: unknown;
  prepared: PreparedChart;
  chartSpec: NormalizedChartSpec;
  renderSpec: NormalizedChartSpec;
  theme: ResolvedTheme;
  sizing: HeightContext;
}

/** Lay out a non-faceted chart: plan, plot, scales, axes, marks, annotations. */
function layoutSingleChart(input: SingleChartInput): ChartLayout {
  const { prepared, chartSpec, renderSpec, theme, sizing } = input;
  const { options, economy, watermark } = prepared;
  const { strategy, reserves } = sizing;
  const noteCapacity = reserves.noteLines;
  let noteReserve = sizing.noteReserve;
  const responsive = (input.spec as ChartSpec).responsive;
  const responsiveConfig =
    typeof responsive === 'object' ? (responsive as ResponsiveConfig) : undefined;

  // Layout plan: measure real labels, freeze gutter + chrome + legend content.
  const measure = createMeasureFn(options.measureText);
  // Rule positions for packing the top reference lane, from the same x scale
  // the marks and annotations resolve against.
  const referenceX: ReferenceXResolver | undefined =
    reserves.reference.labels.length > 0
      ? (area) => {
          const xScale = computeScales(renderSpec, area, renderSpec.data).x;
          return (index) => {
            const annotation = chartSpec.annotations[index];
            return annotation?.type === 'refline' && annotation.x !== undefined
              ? resolvePosition(annotation.x, xScale)
              : null;
          };
        }
      : undefined;
  // Responsive series summary: its text depends only on the series and their
  // last values, never on plot geometry, so it is measured before the plot is
  // sized and joins the note reserve.
  const wantsSummary = !!responsiveConfig?.labelSummary;
  let endpointSummaryBand = 0;
  if (wantsSummary && !options.frozenBudget) {
    const endpointLabelsDemoted = endpointLabelsDemotedAt(
      chartSpec,
      theme,
      options.width,
      options.measureText,
    );
    const summaryLines = seriesSummaryLineCount(
      previewSeriesSummary(chartSpec, renderSpec, strategy, theme, options, {
        endpointLabelsDemoted,
      }),
    );
    if (summaryLines > 0)
      noteReserve = Math.max(noteReserve, noteBandHeight(noteCapacity, summaryLines, theme));
    // Complete fallback strings are known now. The frame activates this reserve
    // only if its measured endpoint fit chooses fallback; no late re-budget.
    const fallbackLines = seriesSummaryLineCount(
      previewSeriesSummary(chartSpec, renderSpec, strategy, theme, options, {
        endpointLabelsDemoted: true,
      }),
    );
    if (fallbackLines > 0) endpointSummaryBand = noteBandHeight(noteCapacity, fallbackLines, theme);
  }

  // The plan and the budget build the same figure frame from these reserves.
  const budgetReserves = {
    noteBand: noteReserve,
    endpointSummaryBand,
    reference: reserves.reference,
    referenceX,
  };
  const plan = resolveLayoutPlan(
    chartSpec,
    renderSpec,
    options,
    theme,
    strategy,
    watermark,
    measure,
    budgetReserves,
  );

  if (plan.endpointLabelsDemoted) noteReserve = Math.max(noteReserve, endpointSummaryBand);

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
  const dims = computeDimensions(
    chartSpec,
    options,
    legendStub,
    theme,
    strategy,
    watermark,
    plan,
    budgetReserves,
  );
  if (options.leafContext) {
    options.leafContext.budget = dims;
    options.leafContext.plan = plan;
  }
  // A frozen area (set by compileLayer for leaf layers) overrides the computed
  // one so all layers share the primary layout's coordinate space.
  const chartArea = options.frozenBudget?.chartArea ?? dims.chartArea;

  // Inline y-axis labels: inset the x-scale range start by the widest tick
  // label width so data marks start to the right of the labels. The plan
  // already measured the real tick labels.
  const scaleArea = scaleAreaFor(
    chartArea,
    options.frozenBudget?.inlineYLabelInset ?? plan.inlineYLabelInset,
  );

  // A frozen plot can sit at different x than the budget packed the top lane
  // for: repack against it, within the lane height the budget reserved.
  let referenceReserve = dims.reference;
  if (options.frozenBudget && referenceReserve.labels.length > 0) {
    const lane = referenceLaneFor(
      referenceReserve,
      referenceX,
      chartArea,
      scaleArea,
      options.width,
    );
    referenceReserve = admitReferenceRows(referenceReserve, lane.rows, referenceReserve.top);
  }

  // A histogram has one bar per bin, so a number over every bar buries the
  // distribution it exists to show. The binned-bar renderer emits no value
  // labels; say so rather than letting `labels` silently do nothing.
  if (
    chartSpec.userExplicit.labels &&
    chartSpec.labels?.density !== 'none' &&
    isBinnedBarEncoding(chartSpec.markType, renderSpec.encoding)
  ) {
    emitSpecWarnings(
      [
        "[openchart] `labels` has no effect on a histogram (binned bar): a value over every bin obscures the distribution. Remove it, or use mark: 'bar' over pre-aggregated categories if you need per-bar values.",
      ],
      options.onWarn,
    );
  }

  const { scales, warnings: paletteWarnings } = computeChartScales(
    renderSpec,
    scaleArea,
    theme,
    chartSpec,
  );
  emitSpecWarnings(paletteWarnings, options.onWarn);

  // Dev-mode WCAG contrast diagnostics. Host-gated via options.dev (never an
  // env sniff; the engine is isomorphic). Advisory console.warn only.
  if (options.dev) {
    emitSpecWarnings(collectContrastWarnings(scales, chartSpec.markType, theme), options.onWarn);
  }

  // Axisless marks (arc, waffle, calendar, parliament) don't use axes or
  // gridlines: arcs and parliament hemicycles are radial, waffles and calendars
  // compute their own grid geometry.
  const isRadial = isAxislessMark(chartSpec.markType);

  // Compute axes (skip for radial charts).
  // Sparkline mode skips axes by default unless the user explicitly opted into
  // an axis on a specific channel.
  const axisless = chartSpec.display === 'sparkline' || !economy.axes;
  const skipX = axisless && !chartSpec.userExplicit.xAxis;
  const skipY = axisless && !chartSpec.userExplicit.yAxis;
  const axes = isRadial
    ? { x: undefined, y: undefined }
    : computeAxes(scales, chartArea, strategy, theme, options.measureText, {
        data: renderSpec.data,
        axisTitleHeader: plan.axisTitleHeader,
        preserveEnd: responsiveConfig ? responsiveConfig.preserveEnd : false,
        encoding: renderSpec.encoding as Encoding,
        skipX,
        skipY,
        suppressGrid: !economy.gridlines,
        maxXTicks: economy.maxXTicks,
        markType: chartSpec.markType,
        totalWidth: options.width,
        // If the guardrail stripped chrome, the plan's y-ticks were sized
        // against the pre-strip (shorter) plot. Drop them so computeAxes
        // regenerates against the final (taller) chartArea.
        precomputedYTicks:
          !dims.chromeStripped && plan.yTickValues.length > 0 ? plan.yTickValues : undefined,
      });

  if (chartSpec.frame?.left !== undefined && axes.y && axes.y.tickPosition !== 'inline') {
    const style = axes.y.tickLabelStyle;
    const available = Math.max(0, chartSpec.frame.left - (axes.y.labelPadding ?? 6) - 4);
    const fitted = fitAxisLabels(axes.y.ticks, available, (text) =>
      options.measureText
        ? options.measureText(text, style.fontSize, style.fontWeight).width
        : estimateTextWidth(text, style.fontSize, style.fontWeight),
    );
    axes.y.ticks = fitted.ticks;
    if (fitted.shortened)
      emitSpecWarnings(
        ['[openchart] Y-axis labels were shortened to fit frame.left.'],
        options.onWarn,
      );
  }

  offsetValueLabelAxes(axes, plan.valueLabelPlan);
  emitValueLabelDiagnostic(plan.valueLabelPlan, options);

  // Intentional post-hoc mutation: axes must resolve before we know the x-axis extent.
  const xAxisExtent = axes.x?.extent ?? 0;
  dims.chrome.bottomAnchorY =
    chartArea.y + chartArea.height + xAxisExtent + (plan.valueLabelPlan?.reserveBottom ?? 0);

  // INVARIANT 2 — computeGridlines mutates `axes` in place. Downstream consumers read
  // axes.y.gridlines off the same object. Do not introduce a copy-on-write.
  if (!isRadial) {
    computeGridlines(axes, chartArea);
  }

  const { marks, markRenderMode } = computeChartMarks(
    chartSpec,
    renderSpec,
    scales,
    chartArea,
    strategy,
    theme,
    options,
    plan.valueLabelPlan,
  );

  // Resolve "you draw it" geometry (pixel fromX, x-sample positions, target
  // line color/key). Reads marks so it must run after they're computed.
  const xFieldForYdi =
    chartSpec.encoding.x && 'field' in chartSpec.encoding.x
      ? (chartSpec.encoding.x.field as string | undefined)
      : undefined;
  const youDrawIt = resolveYouDrawIt(chartSpec.youDrawIt, marks, scales, chartArea, xFieldForYdi);

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
    options.measureText,
    scales.x?.type,
  );
  // Inline ticks occupy scale space inside the chart rect. The public geometry
  // diagnostic cannot infer that private inset from the outer rect alone.
  if (
    endpointLabels.entries.length > 0 &&
    chartArea.width >= MIN_CHART_WIDTH &&
    chartArea.width - plan.inlineYLabelInset < MIN_CHART_WIDTH
  ) {
    options.onDiagnostic?.({
      code: 'endpoint-labels.constrained',
      path: '/endpointLabels',
      severity: 'warning',
      status: 'failed',
      origin: chartSpec.endpointLabels !== undefined ? 'author' : 'default',
      viewport: { width: options.width, height: options.height },
      message:
        'Endpoint columns and inline ticks leave less than the minimum usable plot width. Increase the figure width, shorten endpoint text, disable one endpoint column, or enable an identification fallback.',
    });
  }

  // Place legend in its final position relative to the computed chart area.
  // effectiveAxisGap lifts a top legend above the inline-tick overhang zone
  // the margin stack reserved below it.
  const finalLegend = placeLegend(
    plan.legendContent,
    // Dimensions reserve both columns; place the legend after the resolved
    // endpoint column instead of drawing both at the plot's right edge.
    (plan.legendContent.position === 'right' || plan.legendContent.position === 'bottom-right') &&
      endpointLabels.entries.length > 0
      ? {
          ...chartArea,
          width: chartArea.width + theme.spacing.endpointColumnGap + endpointLabels.bounds.width,
        }
      : chartArea,
    options.width,
    theme,
    plan.xAxisExtent,
    dims.effectiveAxisGap,
  );

  // Every legend on the chart. The color legend is primary (and stays in the
  // singular `legend` slot); a size legend joins it when a quantitative `size`
  // channel is encoded. Consumers that reserve space or hit-test must iterate
  // this rather than read `legend` -- see ChartLayout.legends.
  const sizeLegend = plan.sizeLegendContent
    ? placeSizeLegend(plan.sizeLegendContent, chartArea, theme, finalLegend)
    : null;
  const allLegends: LegendLayout[] = [finalLegend, ...(sizeLegend ? [sizeLegend] : [])];

  // Compute annotations from spec, passing legend + mark + brand bounds as obstacles
  const obstacles = collectAnnotationObstacles({
    legend: finalLegend,
    marks,
    scales,
    dims,
    watermark,
    axes,
    theme,
    endpointLabels,
    measureText: options.measureText,
  });

  const annotationMeasure = annotationMeasureFn(options.measureText);

  let annotations: ResolvedAnnotation[] = computeAnnotations(chartSpec, {
    scales,
    chartArea,
    strategy,
    isDark: theme.isDark,
    obstacles,
    svg: { width: dims.total.width, height: dims.total.height },
    measure: annotationMeasure,
    fontFamily: theme.fonts.family,
    colors: theme.colors,
    padding: theme.spacing.padding,
    smallFontSize: theme.fonts.sizes.small,
    onWarn: (message) => emitSpecWarnings([message], options.onWarn),
    autoThin: chartSpec.autoThin,
    referenceReserve,
    // Hand-placed blocks skip every nudge pass, so the clamp is the only lever
    // that keeps an author's offset from parking a callout on the title.
    topBound: dims.chrome.topHeight > 0 ? chromeBottomY(dims) : undefined,
    pointMarkers: endpointLabels.entries.flatMap((entry) => (entry.marker ? [entry.marker] : [])),
  });

  // Dev-mode diagnostic: hand-placed annotations that sit on the data. Advisory
  // only -- a pinned block is never moved by the engine, so the fix is authorial.
  if (options.dev) {
    emitSpecWarnings(
      collectPinnedOverlapWarnings(
        annotations,
        chartSpec.annotations,
        obstacles,
        annotationMeasure,
      ),
      options.onWarn,
    );
  }

  // Auto-thinning: demote overlapping text annotations to footnote markers.
  // Pass the full spec annotations (not filtered to text-only) so index
  // alignment with the resolved array is preserved.
  let footnotes: AnnotationFootnote[] | undefined;
  if (chartSpec.autoThin && (annotations.length > 1 || chartSpec.compactAnnotationLimit != null)) {
    const result = thinAnnotations(
      annotations,
      chartSpec.annotations,
      annotationMeasure,
      chartArea,
      { x: 0, y: 0, width: dims.total.width, height: dims.total.height },
      isCompactContainer(options) ? chartSpec.compactAnnotationLimit : undefined,
    );
    annotations = result.annotations;
    if (result.footnotes.length > 0) {
      footnotes = wrapAnnotationNotes(
        result.footnotes,
        dims.total.width,
        theme,
        options.measureText,
      );
    }
  }

  const seriesSummary =
    wantsSummary && endpointLabels.entries.length === 0
      ? buildSeriesSummary(
          computeEndpointLabels(
            chartSpec,
            marks,
            theme,
            chartArea,
            undefined,
            false,
            options.measureText,
            scales.x?.type,
          ).entries,
          options.width,
          theme,
          options.measureText,
        )
      : [];

  // Compute tooltip descriptors from marks and encoding
  const tooltipDescriptors = computeTooltipDescriptors(chartSpec, marks);
  const a11y = buildChartA11y(chartSpec, marks);

  // Assign animationIndex for stagger ordering when animation is enabled
  assignAnimationIndices(marks, prepared.resolvedAnimation);

  const resolvedNoteBand = Math.max(
    noteReserve,
    noteBandHeight(
      Math.max(noteCapacity, annotationNoteLineCount(footnotes ?? [])),
      seriesSummaryLineCount(seriesSummary),
      theme,
    ),
  );
  const noteOverflow = resolveNoteOverflow(
    dims,
    resolvedNoteBand - noteReserve,
    resolveChromeLayout(chartSpec, options),
    options.onDiagnostic,
  );
  const chrome = {
    ...dims.chrome,
    ...(noteOverflow > 0 ? { grownHeight: (dims.chrome.grownHeight ?? 0) + noteOverflow } : {}),
    ...(resolvedNoteBand > 0 ? { noteBandHeight: resolvedNoteBand } : {}),
    ...(footnotes ? { footnotes } : {}),
    ...(seriesSummary.length ? { seriesSummary } : {}),
  };

  // Scale inversion anchors for edit-mode anchor drag (pixel -> data-space)
  const xInvert = resolveScaleInvert(scales.x);
  const yInvert = resolveScaleInvert(scales.y);

  return {
    area: chartArea,
    chrome,
    metrics: dims.metrics,
    ...(dims.seriesSearch ? { seriesSearch: dims.seriesSearch } : {}),
    ...(youDrawIt ? { youDrawIt } : {}),
    axes: {
      x: axes.x,
      y: axes.y,
    },
    marks,
    annotations,
    legend: finalLegend,
    legends: allLegends,
    ...(endpointLabels.entries.length > 0 ? { endpointLabels } : {}),
    tooltipDescriptors,
    a11y,
    theme,
    dimensions: {
      width: options.width,
      // In chromeLayout 'grow' mode, computeDimensions grows total.height by the
      // chrome height so the plot keeps its full budget. In the default
      // 'subtract' mode total.height === options.height, so this is a no-op.
      height: dims.total.height,
    },
    animation: prepared.resolvedAnimation,
    watermark,
    display: chartSpec.display,
    crosshair: prepared.crosshair,
    measureText: options.measureText,
    ...(xInvert ? { xInvert } : {}),
    ...(yInvert ? { yInvert } : {}),
    ...(markRenderMode === 'canvas' ? { markRenderMode } : {}),
  };
}

/** Marks from the chart renderer, with fill patterns and the render backend resolved. */
function computeChartMarks(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  options: InternalCompileOptions,
  valueLabelPlan?: BarLabelPlan,
): { marks: Mark[]; markRenderMode: ReturnType<typeof resolveMarkRenderMode> } {
  // Get chart renderer and compute marks (using filtered data).
  const rendererKey = resolveRendererKey(
    renderSpec.markType,
    renderSpec.encoding,
    renderSpec.markDef,
  );
  const renderer = getChartRenderer(rendererKey);
  const markWarnings: string[] = [];
  const marks: Mark[] = renderer
    ? renderer(
        { ...renderSpec, markWarnings },
        scales,
        chartArea,
        strategy,
        theme,
        options.width,
        valueLabelPlan,
        options.measureText,
      )
    : [];

  const metadataWarnings: string[] = [];
  attachMarkMetadata(
    marks,
    renderSpec.encoding,
    renderSpec.sourceMarkType ?? renderSpec.markType,
    metadataWarnings,
  );
  emitSpecWarnings([...markWarnings, ...metadataWarnings], options.onWarn);

  // Opt-in per-series fill patterns (mark.fillPattern: 'auto'). Mutates
  // filled marks in place; assignment is deterministic and theme-aware.
  applyFillPatterns(marks, chartSpec.markDef, theme);

  // Rendering backend for the point marks. Advisory metadata: only stamped on
  // the layout when it resolves to 'canvas', so an SVG-mode layout is byte
  // identical to what this function produced before the field existed.
  const markRenderModeWarnings: string[] = [];
  const markRenderMode = resolveMarkRenderMode(
    {
      requested: options.renderer,
      markType: chartSpec.markType,
      pointCount: marks.reduce((n, m) => (m.type === 'point' ? n + 1 : n), 0),
      display: chartSpec.display,
      faceted: false,
      layered: options.layered ?? false,
    },
    markRenderModeWarnings,
  );
  emitSpecWarnings(markRenderModeWarnings, options.onWarn);
  return { marks, markRenderMode };
}
