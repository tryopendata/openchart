/**
 * Faceted (small-multiples) compilation. The figure-level plan, budget and
 * grid are solved once per container height; each panel then compiles as a
 * regular single chart (scales, axes, marks, annotations) inside its cell.
 */

import type {
  AnnotationFootnote,
  ChartLayout,
  CompileOptions,
  Encoding,
  FacetChannel,
  FacetPanelLayout,
  Mark,
  ResolvedAnimation,
  ResolvedTheme,
  ResolveMode,
} from '@opendata-ai/openchart-core';
import { isAxislessMark } from '@opendata-ai/openchart-core';
import { computeAnnotations } from '../annotations/compute';
import { annotationNoteLineCount, wrapAnnotationNotes } from '../annotations/notes';
import { thinAnnotations } from '../annotations/thinning';
import {
  emitValueLabelDiagnostic,
  offsetValueLabelAxes,
  planBarLabels,
} from '../charts/bar/label-plan';
import { assignAnimationIndices, resolveRendererKey } from '../charts/post-process';
import { getChartRenderer } from '../charts/registry';
import { groupByField } from '../charts/utils';
import { collectContrastWarnings } from '../compiler/a11y-warnings';
import { resolveMarkRenderMode } from '../compiler/mark-render-mode';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeAxes } from '../layout/axes';
import { isYAxisHeader, measureYAxisHeader } from '../layout/axis-title-plan';
import {
  annotationMeasureFn,
  NO_REFERENCE_RESERVE,
  noteBandHeight,
  resolveNoteOverflow,
} from '../layout/budget';
import { computeDimensions } from '../layout/dimensions';
import { computeFacetGrid, facetMinHeight, MIN_PANEL_HEIGHT } from '../layout/facet';
import { computeGridlines } from '../layout/gridlines';
import { createMeasureFn, resolveLayoutPlan } from '../layout/plan';
import { computeScales } from '../layout/scales';
import { resolveChromeLayout } from '../layout/shared';
import { placeLegend } from '../legend/compute';
import { computeTooltipDescriptors } from '../tooltips/compute';
import { buildChartA11y } from './accessibility';
import { computeChartScales } from './chart-scales';
import { applyFillPatterns } from './fill-patterns';
import { type HeightContext, isCompactContainer } from './height-context';
import type { FacetDirection } from './render-spec';
import { emitSpecWarnings } from './spec-sugar';

export function compileFaceted(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  facetChannel: FacetChannel,
  facetDirection: FacetDirection,
  theme: ResolvedTheme,
  resolvedAnimation: ResolvedAnimation | undefined,
  crosshair: boolean,
  seriesWarnings: string[],
  initial: HeightContext,
  growTo: ((height: number) => HeightContext) | undefined,
  diagnosticSink: CompileOptions['onDiagnostic'],
): ChartLayout {
  const measure = createMeasureFn(initial.options.measureText);

  // Strip facet from encoding before passing to per-panel pipeline (panels
  // don't know they're faceted -- they compile as regular single charts).
  const panelEncoding = { ...renderSpec.encoding };
  delete (panelEncoding as Record<string, unknown>).facet;
  const panelSpec = { ...renderSpec, encoding: panelEncoding };
  const panelChartSpec = { ...chartSpec, encoding: panelEncoding };
  // Value lanes belong to each panel, never also to the outer figure frame.
  let figureSpec = renderSpec.labels.placement
    ? { ...panelSpec, labels: { ...panelSpec.labels, placement: undefined } }
    : panelSpec;
  const hasAxisHeader = isYAxisHeader(panelEncoding.y);
  if (hasAxisHeader && figureSpec.encoding.y?.axis) {
    figureSpec = {
      ...figureSpec,
      encoding: {
        ...figureSpec.encoding,
        y: { ...figureSpec.encoding.y, axis: { ...figureSpec.encoding.y.axis, title: '' } },
      },
    };
  }

  // Partition data by facet field
  const groups = groupByField(renderSpec.data, facetChannel.field);
  const facetValues = Array.from(groups.keys());
  if (facetChannel.sort !== null) {
    const dir = facetChannel.sort === 'descending' ? -1 : 1;
    facetValues.sort((a, b) => dir * a.localeCompare(b));
  }
  const effectiveColumns = facetDirection === 'column' ? facetValues.length : facetChannel.columns;
  const hasOutsideReferences = chartSpec.annotations.some(
    (a) => a.type === 'refline' && a.labelPlacement === 'outside' && !!a.label,
  );

  // Figure-level plan, budget and grid for one container height. Chrome and
  // legend are measured against a representative single-panel spec over the
  // full dataset (no facet channel, so it compiles normally).
  const solve = (sizing: HeightContext) => {
    const { options, strategy, watermark } = sizing;
    // Outside reference lanes are reserved per panel by the grid, not here.
    const reserves = { noteBand: sizing.noteReserve, reference: NO_REFERENCE_RESERVE };
    const plan = resolveLayoutPlan(
      panelChartSpec,
      figureSpec,
      options,
      theme,
      strategy,
      watermark,
      measure,
      reserves,
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
      reserves,
    );
    // Compute facet grid geometry. The y-axis gutter needs no left reservation
    // here: chartArea's left margin already includes plan.leftGutter (applied by
    // the budget), so leftmost-panel tick labels render into that margin just
    // like the single-chart path. The x-axis extent is the bottom reservation
    // for the outer axes.
    const labelMeasurements = new Map<string, { width: number; height: number }>();
    const measureLabel: typeof options.measureText = options.measureText
      ? (text, fontSize, weight) => {
          const key = JSON.stringify([text, fontSize, weight]);
          const cached = labelMeasurements.get(key);
          if (cached) return cached;
          const measured = options.measureText!(text, fontSize, weight);
          labelMeasurements.set(key, measured);
          return measured;
        }
      : undefined;
    const valueInsets =
      renderSpec.markType === 'bar' && renderSpec.labels.placement
        ? {
            measure: (width: number, height?: number) =>
              planBarLabels(panelSpec, theme, {
                availableWidth: width,
                availableHeight: height,
                measureText: measureLabel,
              }),
            innerAxisWidth:
              (chartSpec.resolve?.scale?.y ??
                (facetDirection === 'row' ? 'independent' : 'shared')) === 'independent'
                ? plan.leftGutter
                : 0,
          }
        : undefined;
    const grid = computeFacetGrid(
      facetValues,
      effectiveColumns,
      dims.chartArea,
      { left: 0, bottom: plan.xAxisExtent },
      hasOutsideReferences
        ? {
            measure: sizing.reserves.referenceAt,
            innerAxisWidth:
              (chartSpec.resolve?.scale?.y ??
                (facetDirection === 'row' ? 'independent' : 'shared')) === 'independent'
                ? plan.leftGutter
                : 0,
          }
        : undefined,
      valueInsets,
      hasAxisHeader
        ? (width) => measureYAxisHeader(panelEncoding.y, theme, width, options.measureText)
        : undefined,
    );
    return { sizing, plan, dims, grid };
  };

  let solved = solve(initial);
  // Panels too short: grow the container to the grid's minimum and re-solve
  // the figure once at that height (strategy, watermark, reserve, plan, budget).
  let heightGrowth = 0;
  if (
    growTo &&
    solved.grid.panels.length > 0 &&
    solved.grid.panels[0].area.height < MIN_PANEL_HEIGHT
  ) {
    const neededChartHeight =
      solved.grid.minimumHeight ?? facetMinHeight(facetValues.length, solved.grid.columns);
    const growth = neededChartHeight - solved.dims.chartArea.height;
    if (growth > 0) {
      heightGrowth = growth;
      solved = solve(growTo(initial.options.height + growth));
    }
  }
  const { plan, dims, grid } = solved;
  const { options, strategy, watermark, noteReserve } = solved.sizing;
  const chartArea = dims.chartArea;
  emitValueLabelDiagnostic(grid.valueLabelPlan, options);

  // Same effectiveAxisGap threading as the regular (non-faceted) path.
  const finalLegend = placeLegend(
    plan.legendContent,
    chartArea,
    options.width,
    theme,
    plan.xAxisExtent,
    dims.effectiveAxisGap,
  );

  // Resolve scale: defaults depend on facet direction.
  // row: x shared (comparable values), y independent (different categories)
  // column: y shared (comparable values), x independent (different categories)
  // wrap: both shared (original facet behavior)
  const resolveConfig = chartSpec.resolve;
  const xDefault: ResolveMode = facetDirection === 'column' ? 'independent' : 'shared';
  const yDefault: ResolveMode = facetDirection === 'row' ? 'independent' : 'shared';
  const yResolve = resolveConfig?.scale?.y ?? yDefault;
  const xResolve = resolveConfig?.scale?.x ?? xDefault;

  // Compute shared scale domains from the full dataset (when shared)
  const fullScales = computeScales(panelSpec, chartArea, renderSpec.data);
  const sharedXDomain =
    xResolve === 'shared' && fullScales.x ? fullScales.x.scale.domain() : undefined;
  const sharedYDomain =
    yResolve === 'shared' && fullScales.y ? fullScales.y.scale.domain() : undefined;

  const isRadial = isAxislessMark(chartSpec.markType);
  const rendererKey = resolveRendererKey(
    renderSpec.markType,
    panelEncoding as Encoding,
    renderSpec.markDef,
  );
  const renderer = getChartRenderer(rendererKey);

  const allMarks: Mark[] = [];
  const panelLayouts: FacetPanelLayout[] = [];
  // Footnotes pool across panels into one figure-level list (the renderer draws
  // a single list below the grid from `chrome.footnotes`), so the numbering is
  // continuous and each panel's markers index into it.
  const allFootnotes: AnnotationFootnote[] = [];
  const footnoteNumberBySpecIndex = new Map<number, number>();

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
    const { scales: panelScales } = computeChartScales(
      panelSpecWithDomains,
      gridPanel.area,
      theme,
      chartSpec,
    );

    // Dev-mode contrast diagnostics: panels share one palette resolution, so
    // checking the first panel covers the figure without repeating warnings.
    if (options.dev && panelLayouts.length === 0) {
      emitSpecWarnings(
        collectContrastWarnings(panelScales, chartSpec.markType, theme),
        options.onWarn,
      );
    }

    const isLeftCol = gridPanel.col === 0;

    const panelAxes = isRadial
      ? { x: undefined, y: undefined }
      : computeAxes(panelScales, gridPanel.area, strategy, theme, options.measureText, {
          data: panelData,
          axisTitleHeader: grid.axisTitleHeader,
          encoding: panelSpecWithDomains.encoding as Encoding,
          markType: chartSpec.markType,
          // Outside-label cells use figure coordinates throughout, including
          // the tick-label clamp. Keep the legacy path unchanged in 8.x.
          totalWidth: gridPanel.referenceContainer
            ? gridPanel.area.x + gridPanel.area.width
            : gridPanel.area.width,
        });

    offsetValueLabelAxes(panelAxes, grid.valueLabelPlan);
    if (!isRadial) {
      computeGridlines(panelAxes, gridPanel.area);
    }

    // Strip y-axis tick labels from non-leftmost panels (gridlines stay).
    if (yResolve === 'shared' && !isLeftCol && panelAxes.y) {
      panelAxes.y = {
        ...panelAxes.y,
        ticks: [],
        label: undefined,
        domainLine: false,
        tickMarks: false,
      };
    }

    // Strip x-axis tick labels from non-bottom panels for row faceting.
    const isBottomRow = gridPanel.row === grid.rows - 1;
    if (xResolve === 'shared' && facetDirection === 'row' && !isBottomRow && panelAxes.x) {
      panelAxes.x = {
        ...panelAxes.x,
        ticks: [],
        label: undefined,
        domainLine: false,
        tickMarks: false,
      };
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
          grid.valueLabelPlan,
          options.measureText,
        )
      : [];

    // Compute annotations for this panel
    const annotationMeasure = annotationMeasureFn(options.measureText);
    let panelAnnotations = computeAnnotations(panelSpecWithDomains, {
      scales: panelScales,
      chartArea: gridPanel.area,
      referenceContainer: gridPanel.referenceContainer,
      referenceReserve: gridPanel.referenceReserve,
      strategy,
      isDark: theme.isDark,
      obstacles: [],
      svg: { width: dims.total.width, height: dims.total.height },
      measure: annotationMeasure,
      fontFamily: theme.fonts.family,
      colors: theme.colors,
      padding: theme.spacing.padding,
      smallFontSize: theme.fonts.sizes.small,
      onWarn: (message) => emitSpecWarnings([message], options.onWarn),
      autoThin: panelSpecWithDomains.autoThin,
      topBound: dims.chrome.topHeight > 0 ? dims.topPad + dims.chrome.topHeight : undefined,
    });

    // Auto-thinning, per panel. A panel is its own little chart: the box a label
    // must stay inside is the panel, not the figure. Thinning against the whole
    // SVG (what the single-chart path passes) would let a label from the left
    // column sprawl across its neighbour and still count as "fits".
    //
    // The spec's annotations resolve into *every* panel, so the same annotation
    // can demote in more than one. The footnote list is figure-level and its text
    // is per-spec-annotation, so number by spec index and reuse that number in
    // every panel that demoted it -- otherwise the list repeats itself once per
    // panel.
    if (
      chartSpec.autoThin &&
      (panelAnnotations.length > 1 || chartSpec.compactAnnotationLimit != null)
    ) {
      const thinned = thinAnnotations(
        panelAnnotations,
        chartSpec.annotations,
        annotationMeasure,
        gridPanel.area,
        gridPanel.area,
        isCompactContainer(options) ? chartSpec.compactAnnotationLimit : undefined,
      );
      panelAnnotations = thinned.annotations;
      // Every facet instance shares its source text ordinal and a single note.
      for (const note of thinned.footnotes) {
        if (note.specIndex === undefined || footnoteNumberBySpecIndex.has(note.specIndex)) continue;
        footnoteNumberBySpecIndex.set(note.specIndex, note.index);
        allFootnotes.push(note);
      }
      allFootnotes.sort((a, b) => a.index - b.index);
    }

    allMarks.push(...panelMarks);

    panelLayouts.push({
      key: gridPanel.key,
      area: gridPanel.area,
      marks: panelMarks,
      axes: { x: panelAxes.x, y: panelAxes.y },
      annotations: panelAnnotations,
      header: {
        text: gridPanel.key,
        x: facetDirection === 'row' ? gridPanel.area.x : gridPanel.headerPos.x,
        y: gridPanel.headerPos.y,
        fontSize: theme.fonts.sizes.body,
        fontWeight: theme.fonts.weights.medium,
        ...(facetDirection === 'row' ? { textAnchor: 'start' as const } : {}),
      },
    });
  }

  // Facets share the source-capacity preflight. Reconcile an unexpected
  // measurement overflow once at figure level, never once per panel.
  const wrappedFootnotes = wrapAnnotationNotes(
    allFootnotes,
    dims.total.width,
    theme,
    options.measureText,
  );
  const resolvedNoteBand = Math.max(
    noteReserve,
    noteBandHeight(annotationNoteLineCount(wrappedFootnotes), 0, theme),
  );
  const noteOverflow = resolveNoteOverflow(
    dims,
    resolvedNoteBand - noteReserve,
    resolveChromeLayout(panelChartSpec, options),
    diagnosticSink,
  );

  // Compute tooltip descriptors from all marks across panels
  const tooltipDescriptors = computeTooltipDescriptors(panelChartSpec, allMarks);

  // Opt-in per-series fill patterns across all panels at once so a series
  // gets the same pattern in every panel.
  applyFillPatterns(allMarks, chartSpec.markDef, theme);

  // Assign animation indices across all panels
  assignAnimationIndices(allMarks, resolvedAnimation);

  // Rendering backend, resolved against the pooled panel marks. The canvas
  // layer cannot express a facet grid, so this always answers 'svg' and never
  // stamps the layout; it runs purely so the refusal is reported -- an explicit
  // renderer: 'canvas' gets told it was ignored, and a dense facet grid gets
  // told why it is painting every point as a DOM node.
  const facetRenderModeWarnings: string[] = [];
  resolveMarkRenderMode(
    {
      requested: options.renderer,
      markType: chartSpec.markType,
      pointCount: allMarks.reduce((n, m) => (m.type === 'point' ? n + 1 : n), 0),
      display: chartSpec.display,
      faceted: true,
      layered: options.layered ?? false,
    },
    facetRenderModeWarnings,
  );
  emitSpecWarnings([...seriesWarnings, ...facetRenderModeWarnings], options.onWarn);

  // Figure-level axes are null (axes live in panels)
  // Figure-level marks are the union of all panel marks (for tooltip/keyboard nav)
  return {
    area: chartArea,
    chrome: {
      ...dims.chrome,
      ...(noteOverflow > 0 ? { grownHeight: (dims.chrome.grownHeight ?? 0) + noteOverflow } : {}),
      // Grid growth is engine-owned figure growth too.
      ...(heightGrowth > 0 && dims.chrome.grownHeight !== undefined
        ? { grownHeight: dims.chrome.grownHeight + Math.max(0, noteOverflow) + heightGrowth }
        : {}),
      noteBandHeight: resolvedNoteBand,
      ...(allFootnotes.length > 0 ? { footnotes: wrappedFootnotes } : {}),
    },
    metrics: dims.metrics,
    ...(dims.seriesSearch ? { seriesSearch: dims.seriesSearch } : {}),
    axes: { x: undefined, y: undefined },
    marks: allMarks,
    annotations: [],
    legend: finalLegend,
    // Facets share one color legend across the grid; the size channel isn't
    // supported in facet specs, so there is no second legend to carry.
    legends: [finalLegend],
    tooltipDescriptors,
    // A11y: an author description is used verbatim (the author already
    // describes the whole figure); generated text mentions the faceting.
    a11y: buildChartA11y(chartSpec, allMarks, {
      panelCount: facetValues.length,
      field: facetChannel.field,
    }),
    theme,
    dimensions: { width: dims.total.width, height: dims.total.height },
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
      direction: facetDirection,
    },
  };
}
