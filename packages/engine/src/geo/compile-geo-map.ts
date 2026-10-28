import type {
  CategoricalLegendLayout,
  CompileOptions,
  CompileWarning,
  ContinuousLegendLayout,
  EncodingChannel,
  GeoMapBorders,
  GeoMapFeatureMark,
  GeoMapFocus,
  GeoMapFocusLayout,
  GeoMapLayout,
  GeoMapPointMark,
  LegendEntry,
  ResolvedAnimation,
  ResolvedFillPattern,
  ResolvedTheme,
  SizeLegendLayout,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  buildD3Formatter,
  computeChrome,
  estimateTextWidth,
  formatNumber,
  getBreakpoint,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  mergeThemeConfig,
  pickLabelColor,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { geoArea, geoPath } from 'd3-geo';
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { resolveKnockoutColor } from '../charts/utils';
import { buildSizeScale, SIZE_SCALE_DEFAULTS } from '../compile/size-scale';
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { finiteNumber } from '../data/finite-number';
import { resolveChromeLayout } from '../layout/shared';
import {
  type ClassScale,
  CONTINUOUS_BAR_HEIGHT,
  CONTINUOUS_LABEL_GAP,
  classScaleForChannel,
  computeContinuousLegendContentForChannel,
} from '../legend/continuous';
import { computeSizeLegendContent, sizeLegendTitleStyle } from '../legend/size';
import { buildGeoColorKey, geoColorKeyReserve } from './color-key';
import { joinDataToFeatures } from './join';
import { compilePreparedGeoLabels, hasGeoLabels, prepareGeoLabels } from './labels';
import {
  geoMapFullArea,
  geoMapZoomControlsBounds,
  measureGeoContinuousKey,
  measureGeoKeyText,
  measureGeoSizeKey,
  moveGeoMapLegend,
  occupiedBoundsSizeKeyCandidate,
  planGeoMapFrame,
  reserveGeoCalloutNotes,
} from './layout';
import {
  classIntervalText,
  mapLegendCaptionCandidate,
  mapNeutralClassContext,
} from './legend-semantics';
import { createProjection, resolveDefaultProjection } from './projections';
import type { NormalizedGeoMapSpec } from './types';
import {
  decodeGeoViewSource,
  GeoViewGeometryError,
  planGeoInsetViewports,
  projectGeoDetailLayers,
  resolveGeoInsetProjection,
  resolveGeoViewSources,
  selectGeoInsetFeatures,
  selectGeoInsetPoints,
} from './view-geometry';

/**
 * Inset from the map area's edges for overlay ('top-left') point legends.
 * The renderer's backdrop extends 10px left of the legend x, so the visible
 * gap to the frame edge is OVERLAY_LEGEND_INSET - 10.
 */
const OVERLAY_LEGEND_INSET = 18;

/** Gap between the color bar and the detached "no data" swatch. */
const NO_DATA_SWATCH_GAP = 12;

/** Gap between the "no data" swatch and its label. */
const NO_DATA_LABEL_GAP = 5;

/** Categorical legend geometry. Must match `renderCategoricalLegend` in vanilla. */
const CATEGORICAL_SWATCH_SIZE = 10;
const CATEGORICAL_SWATCH_GAP = 6;
const CATEGORICAL_ENTRY_GAP = 16;
/** Row advance the renderer uses when a horizontal legend wraps. */
const CATEGORICAL_ROW_HEIGHT = CATEGORICAL_SWATCH_SIZE + 6;

/** Label style for the map's own categorical legend (also used to size the block). */
function categoricalLegendLabelStyle(theme: ResolvedTheme): TextStyle {
  return {
    fontFamily: theme.fonts.family,
    fontSize: 11,
    fontWeight: 400,
    fill: theme.colors.text,
    lineHeight: 1.2,
  };
}

/** Slot width for one legend entry (swatch + gap + label + trailing entry gap). */
function categoricalEntryWidth(label: string, labelStyle: TextStyle): number {
  return (
    CATEGORICAL_SWATCH_SIZE +
    CATEGORICAL_SWATCH_GAP +
    estimateTextWidth(label, labelStyle.fontSize, labelStyle.fontWeight) +
    CATEGORICAL_ENTRY_GAP
  );
}

/** Width of the detached "no data" block (swatch + gap + label, no trailing gap). */
function noDataBlockWidth(labelStyle: TextStyle): number {
  return (
    CATEGORICAL_SWATCH_SIZE +
    NO_DATA_LABEL_GAP +
    estimateTextWidth('No data', labelStyle.fontSize, labelStyle.fontWeight)
  );
}

/**
 * Wrap entry slots across rows the way the renderer does: an entry that would
 * run past the legend's right edge starts a new row. Returns row-relative x
 * offsets so the engine and the renderer can never disagree about where an
 * entry lands.
 */
function wrapCategoricalEntries(
  widths: number[],
  legendWidth: number,
): { x: number; row: number }[] {
  const placed: { x: number; row: number }[] = [];
  let x = 0;
  let row = 0;
  for (let i = 0; i < widths.length; i++) {
    if (i > 0 && x + widths[i] > legendWidth) {
      x = 0;
      row += 1;
    }
    placed.push({ x, row });
    x += widths[i];
  }
  return placed;
}

/**
 * Categories in legend order: `scale.domain` first, then anything the rows add.
 * Shared by the height reservation (which reads the spec rows, before the join)
 * and the legend build (which reads the joined rows).
 */
function collectCategories(
  rows: Iterable<Record<string, unknown>>,
  field: string,
  domain: unknown,
): string[] {
  const categories: string[] = Array.isArray(domain) ? domain.map((c) => String(c)) : [];
  const seen = new Set<string>(categories);
  for (const row of rows) {
    const raw = row[field];
    if (raw != null) {
      const cat = String(raw);
      if (!seen.has(cat)) {
        seen.add(cat);
        categories.push(cat);
      }
    }
  }
  return categories;
}

/**
 * Legend title: what the colors mean, plus the unit the format implies.
 * A key with bare numbers on it is the single most common newsroom map defect.
 */
function legendTitleFor(colorEncoding: EncodingChannel): string | undefined {
  const base = colorEncoding.title ?? colorEncoding.field;
  if (!base) return undefined;
  const format = colorEncoding.format;
  if (typeof format === 'string') {
    if (format.includes('%')) return `${base} (%)`;
    if (format.includes('$')) return `${base} ($)`;
  }
  return base;
}

function validateGeoFeatures(geo: NormalizedGeoMapSpec['geo']): Topology {
  if (!geo.features) {
    throw new Error(
      'Map spec error: geo.features is required but missing.\n\n' +
        'The map needs a TopoJSON topology object as geo.features. ' +
        'Install a standard atlas package and import it:\n\n' +
        '  npm i us-atlas\n' +
        '  import us from "us-atlas/states-albers-10m.json";\n\n' +
        '  // or for world maps:\n' +
        '  npm i world-atlas\n' +
        '  import world from "world-atlas/countries-110m.json";\n\n' +
        'Then pass it as geo.features:\n\n' +
        '  { type: "map", geo: { features: us }, data: [...], encoding: { ... } }',
    );
  }

  const topo = geo.features as Record<string, unknown>;
  if (typeof topo !== 'object' || topo === null || topo.type !== 'Topology' || !topo.objects) {
    throw new Error(
      'Map spec error: geo.features must be a valid TopoJSON Topology ' +
        '(expected an object with type: "Topology" and an "objects" property).\n\n' +
        'Make sure you are passing the full TopoJSON file, not a GeoJSON FeatureCollection. ' +
        'Atlas packages like us-atlas and world-atlas export TopoJSON by default:\n\n' +
        '  npm i us-atlas\n' +
        '  import us from "us-atlas/states-albers-10m.json";\n' +
        '  { type: "map", geo: { features: us }, ... }',
    );
  }

  const objects = topo.objects as Record<string, unknown>;
  if (Object.keys(objects).length === 0) {
    throw new Error(
      'Map spec error: geo.features.objects is empty (no geometry collections found). ' +
        'The TopoJSON file must contain at least one named geometry collection.',
    );
  }

  return topo as unknown as Topology;
}

export function compileGeoMap(spec: unknown, options: CompileOptions): GeoMapLayout {
  try {
    return compileGeoMapImpl(spec, options);
  } catch (error) {
    if (error instanceof GeoViewGeometryError)
      options.onDiagnostic?.({
        code: error.code,
        message: error.message,
        path: '/geo',
        severity: 'warning',
        status: 'failed',
        origin: 'author',
        viewport: { width: options.width, height: options.height },
      });
    throw error;
  }
}
function compileGeoMapImpl(spec: unknown, options: CompileOptions): GeoMapLayout {
  // 1. Sugar expansion + validate + normalize
  const sugarWarnings: string[] = [];
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandSpecSugar(spec as Record<string, unknown>, sugarWarnings)
      : spec;
  const { spec: normalized, warnings } = compileSpec(expandedSpec);
  emitSpecWarnings([...sugarWarnings, ...warnings], options.onWarn);

  if (!('type' in normalized) || normalized.type !== 'map') {
    throw new Error(
      'compileGeoMap received a non-map spec. Use compileChart, compileTileMap, compileSankey, or compileBarList instead.',
    );
  }

  const mapSpec = normalized as NormalizedGeoMapSpec;

  // 2. Validate geo features
  const topology = validateGeoFeatures(mapSpec.geo);

  // Resolve watermark
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? mapSpec.watermark : (options.watermark ?? true);

  // 3. Resolve theme
  const mergedThemeConfig = mergeThemeConfig(mapSpec.theme, options.theme);
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }
  const isDarkMode = options.darkMode;

  // Chrome and legends share the same responsive gutter.
  const padding =
    getBreakpoint(options.width) === 'compact'
      ? Math.max(HPAD_COMPACT_MIN, Math.round(theme.spacing.padding * HPAD_COMPACT_FRACTION))
      : theme.spacing.padding;

  // 4. Chrome
  const chrome = computeChrome(
    mapSpec.chrome,
    theme,
    options.width,
    options.measureText,
    'full',
    padding,
    watermark,
  );

  // 5. Drawing area
  // In 'grow' mode the plot keeps the full height budget (chrome is not
  // subtracted). The returned SVG height is already content-driven (it sums
  // chrome.bottomHeight + content + padding below), so it grows naturally when
  // the plot area is taller. In the default 'subtract' mode this is unchanged.
  // Read chromeLayout from the raw spec: normalizeGeoMapSpec does not carry it
  // through, and GeoMapSpec has no chromeLayout field, so the option default is the
  // primary control (a user-authored spec.chromeLayout still wins here).
  const chromeLayout = resolveChromeLayout(
    spec as { chromeLayout?: 'subtract' | 'grow' } | undefined,
    options,
  );
  let fullArea = geoMapFullArea(
    options.width,
    options.height,
    padding,
    chrome.topHeight,
    chrome.bottomHeight,
    chromeLayout,
  );

  if ((fullArea.width <= 0 || fullArea.height <= 0) && mapSpec.geo.insets?.length)
    throw new GeoViewGeometryError(
      'GEO_INSET_SPACE',
      'No positive geographic frame is available for the authored insets.',
    );
  if ((fullArea.width <= 0 || fullArea.height <= 0) && !hasGeoLabels(mapSpec)) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // 6. Parse TopoJSON -> GeoJSON
  const viewsEnabled =
    mapSpec.geo.objectKey !== undefined ||
    mapSpec.geo.fitObjectKey !== undefined ||
    mapSpec.geo.sourcePlane !== undefined ||
    !!mapSpec.geo.detailLayers?.length ||
    !!mapSpec.geo.insets?.length;
  const viewSources = viewsEnabled ? resolveGeoViewSources(mapSpec.geo) : undefined;
  const objectKey = viewSources?.primary.objectKey ?? Object.keys(topology.objects)[0];
  const geoCollection =
    viewSources?.primary.collection ??
    topoFeature(topology, topology.objects[objectKey] as GeometryCollection);
  const insetSelection = viewSources
    ? selectGeoInsetFeatures(geoCollection.features, mapSpec.geo.insets ?? [])
    : undefined;
  const geoFeatures = geoCollection.features;

  // 7. Compile warnings
  const compileWarnings: CompileWarning[] = [];

  // Join before measuring keys; missingness does not depend on projection.
  // Join data to features (skip when no key channel, e.g. basemap-only mode)
  let joinWarnings: CompileWarning[] = [];
  let joined = new Map<string | number, Record<string, unknown>>();
  if (mapSpec.encoding.key) {
    const featureObjs = geoFeatures.map((f) => ({
      id: f.id as string | number,
      properties: (f.properties ?? {}) as Record<string, unknown>,
    }));
    const joinResult = joinDataToFeatures(
      featureObjs,
      mapSpec.data,
      mapSpec.encoding.key.field,
      mapSpec.geo.idField,
    );
    joined = joinResult.joined;
    // In basemap-only mode (empty data + points layer), all features are intentionally unmatched
    const filteredJoinWarnings =
      mapSpec.data.length === 0 && mapSpec.points
        ? joinResult.warnings.filter((w) => w.code !== 'UNMATCHED_FEATURES')
        : joinResult.warnings;
    joinWarnings = filteredJoinWarnings;
  }

  // 8. Legend height reserve
  const mapFields = mapSpec.fields;
  const measureKeyText =
    options.measureText ??
    ((text: string, size: number, weight?: number) => ({
      width: estimateTextWidth(text, size, weight),
      height: size,
    }));
  const preparedLabels = prepareGeoLabels(
    mapSpec,
    geoFeatures,
    joined,
    theme,
    measureKeyText,
    Math.max(1, fullArea.width),
  );
  const noteHeight = preparedLabels?.noteHeight ?? 0;
  fullArea = reserveGeoCalloutNotes(fullArea, noteHeight, chromeLayout);
  const labelDiagnostic = (code: string, message: string, path = '/callouts') =>
    options.onDiagnostic?.({
      code,
      message,
      severity: 'warning',
      status: 'failed',
      path,
      origin: 'author',
      viewport: { width: options.width, height: options.height },
    });
  const emptyWithLabels = () => {
    const empty = emptyLayout(chrome, theme, options, watermark);
    if (preparedLabels) {
      labelDiagnostic(
        'MAP_LABEL_FRAME_UNFIT',
        'The authored labels or note capacity leave no map viewport; complete authored text remains in the inventory and note slots.',
      );
      const area = { x: Math.max(0, fullArea.x), y: Math.max(0, fullArea.y), width: 0, height: 0 };
      empty.area = area;
      empty.labels = compilePreparedGeoLabels(
        preparedLabels,
        geoFeatures,
        undefined,
        [],
        area,
        [],
        0,
        labelDiagnostic,
      );
      if (chromeLayout !== 'subtract')
        empty.height = Math.max(empty.height, area.y + noteHeight + chrome.bottomHeight + padding);
    }
    return empty;
  };
  if (fullArea.width <= 0 || fullArea.height <= 0) return emptyWithLabels();
  const showLegend = mapSpec.legend?.show !== false;
  const colorEncoding = mapSpec.encoding.color;
  // Channel-level `legend: null` suppresses the choropleth legend (the VL
  // idiom) — without this, basemap-only maps (empty data + points layer)
  // reserved a phantom swatch row that letterboxed the map.
  const showChoroplethLegend = showLegend && colorEncoding?.legend !== null;
  const isQuantitative = colorEncoding?.type === 'quantitative';
  const legendPosition = mapSpec.legend?.position === 'bottom' ? 'bottom' : 'top';
  // 'top-left' floats the point legend inside the map area (own backdrop, no
  // height reserve) so the geography keeps the full frame.
  const pointLegendOverlay = mapSpec.legend?.position === 'top-left';

  // Compute legend block height. For quantitative maps, use the continuous
  // legend infrastructure; for categorical, estimate a single swatch row.
  let legendBlockHeight = 0;
  let legendTitle: string | undefined;
  let continuousContent: ReturnType<typeof computeContinuousLegendContentForChannel> = null;
  // The one class scale the fills AND the swatches read. Built here (before the
  // marks) so the legend can never key a color no feature carries.
  let classScale: ClassScale | null = null;
  if (colorEncoding && isQuantitative) {
    const colorValues: number[] = [];
    for (const row of mapSpec.data) {
      const value = finiteNumber(row[colorEncoding.field]);
      if (value !== undefined) colorValues.push(value);
    }
    // Maps class their values rather than ramping them continuously, so the
    // legend infra draws swatches. `quantize` (round breaks) is the default;
    // an authored quantile/threshold scale wins.
    const legendChannel: EncodingChannel = {
      ...colorEncoding,
      scale: { ...colorEncoding.scale, type: colorEncoding.scale?.type ?? 'quantize' },
    };
    if (colorValues.length > 0) {
      classScale = classScaleForChannel(colorValues, legendChannel, theme);
    }
    if (showChoroplethLegend) {
      continuousContent = computeContinuousLegendContentForChannel(
        colorValues,
        legendChannel,
        theme,
        fullArea.width,
        classScale ?? undefined,
      );
    }
    if (continuousContent) {
      const caption = mapLegendCaptionCandidate(colorEncoding, mapFields?.[colorEncoding.field]);
      legendTitle = caption.title || undefined;
      const labelRowHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      const titleRowHeight = legendTitle ? labelRowHeight : 0;
      legendBlockHeight =
        titleRowHeight +
        continuousContent.barHeight +
        CONTINUOUS_LABEL_GAP +
        labelRowHeight * (continuousContent.labelRows ?? 1);
    }
  }
  if (colorEncoding && !isQuantitative && showChoroplethLegend)
    legendTitle =
      mapLegendCaptionCandidate(colorEncoding, mapFields?.[colorEncoding.field]).title || undefined;
  if (continuousContent) {
    const barWidth = Math.min(
      fullArea.width,
      350,
      continuousContent.barWidth * Math.max(1, theme.fonts.sizes.small / 12),
    );
    const ratio = barWidth / continuousContent.barWidth;
    continuousContent = {
      ...continuousContent,
      barWidth,
      bins: continuousContent.bins.map((bin) => ({
        ...bin,
        x: bin.x * ratio,
        width: bin.width * ratio,
      })),
      ticks: continuousContent.ticks.map((tick) => ({ ...tick, x: tick.x * ratio })),
    };
  }
  const keyStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.neutral.secondary,
    lineHeight: 1.35,
  };
  const keyTextWidth = Math.min(fullArea.width, Math.max(continuousContent?.barWidth ?? 220, 350));
  const titlePlan = legendTitle
    ? measureGeoKeyText(
        legendTitle,
        keyTextWidth,
        { ...keyStyle, fontWeight: theme.fonts.weights.medium },
        measureKeyText,
      )
    : undefined;
  const unit = colorEncoding
    ? mapLegendCaptionCandidate(colorEncoding, mapFields?.[colorEncoding.field]).unit
    : undefined;
  const unitPlan =
    showChoroplethLegend && colorEncoding && unit
      ? measureGeoKeyText(unit, keyTextWidth, keyStyle, measureKeyText)
      : undefined;
  const keyFormat = colorEncoding?.format ? buildD3Formatter(colorEncoding.format) : undefined;
  const neutralContext = classScale
    ? mapNeutralClassContext(
        classScale,
        keyFormat ?? ((value) => formatNumber(value)),
        Object.values(theme.colors.diverging).map(
          (colors) => colors[Math.floor(colors.length / 2)],
        ),
      )
    : undefined;
  if (continuousContent && neutralContext) {
    const barHeight = Math.max(continuousContent.barHeight, Math.ceil(keyStyle.fontSize * 1.35));
    legendBlockHeight += barHeight - continuousContent.barHeight;
    continuousContent = { ...continuousContent, barHeight };
  }
  const contextPlan =
    continuousContent && neutralContext
      ? measureGeoKeyText(neutralContext.caption, keyTextWidth, keyStyle, measureKeyText)
      : undefined;
  const oldTitleHeight = legendTitle ? Math.ceil(theme.fonts.sizes.small * 1.3) : 0;
  const titleHeight = (titlePlan?.height ?? 0) + (unitPlan?.height ?? 0);
  const contextHeight = contextPlan ? contextPlan.height + 8 : 0;
  const hasNoData =
    colorEncoding &&
    isQuantitative &&
    geoFeatures.some(
      (feature) =>
        finiteNumber(joined.get(feature.id as string | number)?.[colorEncoding.field]) ===
        undefined,
    );
  const noDataRowHeight =
    continuousContent && hasNoData ? Math.ceil(keyStyle.fontSize * 1.35) + 8 : 0;
  if (continuousContent)
    legendBlockHeight += titleHeight - oldTitleHeight + contextHeight + noDataRowHeight;
  if (legendBlockHeight === 0 && showChoroplethLegend && colorEncoding && !isQuantitative) {
    const labelHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
    // The legend wraps once the entries run past the frame, so reserve every
    // row it will use. Categories come from the spec rows (the join hasn't run
    // yet); a row that matches no feature can only over-count, which costs a
    // little whitespace rather than clipping the legend. The "No data" block is
    // always counted for the same reason -- whether the map has holes is not
    // known until the marks are built.
    const labelStyle = categoricalLegendLabelStyle(theme);
    const widths = collectCategories(
      mapSpec.data,
      colorEncoding.field,
      colorEncoding.scale?.domain,
    ).map((cat) => categoricalEntryWidth(cat, labelStyle));
    widths.push(noDataBlockWidth(labelStyle));
    const placed = wrapCategoricalEntries(widths, fullArea.width);
    const rows = placed.length > 0 ? placed[placed.length - 1].row + 1 : 1;
    legendBlockHeight = titleHeight + rows * (Math.max(10, labelHeight) + 6);
  }

  const prepareActiveKey = (
    channel: EncodingChannel | undefined,
    rows: Array<Record<string, unknown>>,
  ) => {
    const labels: Record<string, string[]> = {};
    let lines = 1,
      width = 0;
    if (mapSpec.colorKey?.activeValue && channel) {
      const format = buildD3Formatter(channel.format) ?? formatNumber;
      const domain = channel.scale?.domain;
      const clamp =
        channel.scale?.type !== 'threshold' &&
        channel.scale?.type !== 'quantile' &&
        Array.isArray(domain) &&
        domain.length === 2 &&
        domain.every((value) => typeof value === 'number' && Number.isFinite(value))
          ? (domain as [number, number])
          : undefined;
      for (const raw of [undefined, ...rows.map((row) => row[channel.field])]) {
        const value = finiteNumber(raw);
        const exact =
          raw == null || (channel.type === 'quantitative' && value === undefined)
            ? 'No data'
            : channel.type === 'quantitative'
              ? format(value!)
              : raw === ''
                ? '(empty)'
                : String(raw);
        const outside = value !== undefined && clamp && (value < clamp[0] || value > clamp[1]);
        const text = `A: ${exact}${outside ? ' · outside displayed range' : ''}`;
        const plan = measureGeoKeyText(
          text,
          Math.min(fullArea.width, 220),
          keyStyle,
          measureKeyText,
        );
        labels[`${typeof raw}:${String(raw)}`] = plan.lines;
        lines = Math.max(lines, plan.lines.length);
        width = Math.max(
          width,
          ...plan.lines.map(
            (line) => measureKeyText(line, keyStyle.fontSize, keyStyle.fontWeight).width,
          ),
        );
      }
    }
    return { labels, lines, width };
  };
  const featureActivePlan = prepareActiveKey(colorEncoding, mapSpec.data);
  const featureKeyExtra =
    showChoroplethLegend && colorEncoding && legendBlockHeight > 0
      ? geoColorKeyReserve(mapSpec.colorKey, theme.fonts.sizes.small, featureActivePlan.lines)
      : 0;
  legendBlockHeight += featureKeyExtra;
  const choroplethLegendBlockHeight = legendBlockHeight;
  const pointColor = mapSpec.points?.color;
  const pointColorChannel: EncodingChannel | undefined =
    pointColor?.type === 'quantitative'
      ? { ...pointColor, scale: { ...pointColor.scale, type: 'quantile' } }
      : undefined;
  const pointColorValues = pointColorChannel
    ? mapSpec.points!.data.flatMap((row) => {
        const value = finiteNumber(row[pointColorChannel.field]);
        return value === undefined ? [] : [value];
      })
    : [];
  const pointClassScale =
    pointColorChannel && pointColorValues.length
      ? classScaleForChannel(pointColorValues, pointColorChannel, theme)
      : undefined;
  const pointContinuousContent =
    showLegend && pointColorChannel
      ? computeContinuousLegendContentForChannel(
          pointColorValues,
          pointColorChannel,
          theme,
          fullArea.width,
          pointClassScale,
        )
      : null;

  const pointCaption = pointColor
    ? mapLegendCaptionCandidate(pointColor, mapFields?.[pointColor.field])
    : undefined;
  const pointTitlePlan = pointCaption?.title
    ? measureGeoKeyText(
        pointCaption.title,
        keyTextWidth,
        { ...keyStyle, fontWeight: theme.fonts.weights.medium },
        measureKeyText,
      )
    : undefined;
  const pointUnitPlan = pointCaption?.unit
    ? measureGeoKeyText(pointCaption.unit, keyTextWidth, keyStyle, measureKeyText)
    : undefined;
  const pointTitleHeight = (pointTitlePlan?.height ?? 0) + (pointUnitPlan?.height ?? 0);
  const pointTextRows = (x: number, y: number) => [
    ...(pointTitlePlan?.lines.map((text, index) => ({
      text,
      x,
      y: y + keyStyle.fontSize + index * pointTitlePlan.advance,
      style: { ...keyStyle, fontWeight: theme.fonts.weights.medium },
      role: 'title' as const,
    })) ?? []),
    ...(pointUnitPlan?.lines.map((text, index) => ({
      text,
      x,
      y: y + (pointTitlePlan?.height ?? 0) + keyStyle.fontSize + index * pointUnitPlan.advance,
      style: keyStyle,
      role: 'unit' as const,
    })) ?? []),
  ];
  const pointCategoryRowHeight = Math.max(
    CATEGORICAL_ROW_HEIGHT,
    Math.ceil(theme.fonts.sizes.small * 1.2),
  );
  const pointCategoryWidths =
    pointColor && pointColor.type !== 'quantitative'
      ? collectCategories(mapSpec.points!.data, pointColor.field, pointColor.scale?.domain).map(
          (label) =>
            CATEGORICAL_SWATCH_SIZE +
            CATEGORICAL_SWATCH_GAP +
            estimateTextWidth(label, theme.fonts.sizes.small, theme.fonts.weights.normal) +
            CATEGORICAL_ENTRY_GAP,
        )
      : [];
  const pointCategoryRows = wrapCategoricalEntries(pointCategoryWidths, fullArea.width);
  const pointCategoryRowCount = pointCategoryRows.length
    ? pointCategoryRows[pointCategoryRows.length - 1].row + 1
    : 1;

  const pointActivePlan = prepareActiveKey(pointColor, mapSpec.points?.data ?? []);
  const pointKeyExtra =
    showLegend && pointColor
      ? geoColorKeyReserve(mapSpec.colorKey, theme.fonts.sizes.small, pointActivePlan.lines)
      : 0;
  // Reserve height for point color legend if applicable (overlay legends
  // float inside the map area and reserve nothing)
  if (showLegend && !pointLegendOverlay && mapSpec.points?.color) {
    legendBlockHeight += pointTitleHeight + pointKeyExtra;
    if (mapSpec.points.color.type === 'quantitative') {
      const labelRowHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      legendBlockHeight +=
        (pointContinuousContent?.barHeight ?? CONTINUOUS_BAR_HEIGHT) +
        CONTINUOUS_LABEL_GAP +
        labelRowHeight * (pointContinuousContent?.labelRows ?? 1) +
        8;
    } else {
      const ptLabelHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      legendBlockHeight +=
        Math.max(10, ptLabelHeight) + 6 + 8 + (pointCategoryRowCount - 1) * pointCategoryRowHeight;
    }
  }

  const requestedSide = mapSpec.legend?.position;
  const sidePosition =
    requestedSide === 'right' || requestedSide === 'bottom-right' ? requestedSide : undefined;
  const sideRowHeight = Math.max(22, Math.ceil(theme.fonts.sizes.small * 1.3) + 6);
  const categoryHeight = (channel: EncodingChannel | undefined, rows: Record<string, unknown>[]) =>
    channel && channel.type !== 'quantitative'
      ? (collectCategories(rows, channel.field, channel.scale?.domain).length + 1) * sideRowHeight
      : 0;
  const sizeContent =
    showLegend && mapSpec.points?.size
      ? computeSizeLegendContent(
          {
            ...mapSpec.points.size,
            title: (() => {
              const caption = mapLegendCaptionCandidate(
                mapSpec.points.size!,
                mapFields?.[mapSpec.points.size!.field],
              );
              return [caption.title, caption.unit].filter(Boolean).join('\n');
            })(),
          },
          mapSpec.points.data,
          theme,
          {
            curve: SIZE_SCALE_DEFAULTS.mapPoint.curve,
            range: (mapSpec.points.size.scale?.range as [number, number] | undefined) ?? [
              ...SIZE_SCALE_DEFAULTS.mapPoint.range,
            ],
          },
        )
      : null;
  const sideLabelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };
  const measureSideText =
    options.measureText ??
    ((text: string, size: number, weight?: number) => ({
      width: estimateTextWidth(text, size, weight),
      height: size,
    }));
  const measuredSizeContent = sizeContent
    ? measureGeoSizeKey(
        sizeContent,
        sideLabelStyle,
        measureSideText,
        sidePosition
          ? Math.min(260, fullArea.width - OVERLAY_LEGEND_INSET * 2)
          : fullArea.width - OVERLAY_LEGEND_INSET * 2,
      )
    : null;
  // Missingness is known after joining; conservatively reserve its full key now,
  // just as categorical reservation counts the potential No data entry.
  const choroplethSideExtent =
    sidePosition && continuousContent
      ? measureGeoContinuousKey({
          content: continuousContent,
          labelStyle: sideLabelStyle,
          measureText: measureSideText,
          title: legendTitle
            ? { text: legendTitle, weight: theme.fonts.weights.medium }
            : undefined,
          noData: { label: 'No data', swatchGap: NO_DATA_SWATCH_GAP, labelGap: NO_DATA_LABEL_GAP },
        })
      : undefined;
  const pointKeyExtent = pointContinuousContent
    ? measureGeoContinuousKey({
        content: pointContinuousContent,
        labelStyle: sideLabelStyle,
        measureText: measureSideText,
      })
    : undefined;
  const pointKeyWidth = Math.max(
    pointKeyExtent?.width ?? 0,
    pointActivePlan.width,
    ...pointTextRows(0, 0).map(
      (row) => measureSideText(row.text, row.style.fontSize, row.style.fontWeight).width,
    ),
  );
  const pointFormatter = buildD3Formatter(pointColor?.format) ?? formatNumber;
  const sideRangeLabel = (scale: ClassScale, index: number, format: (value: number) => string) => {
    const lo = index ? scale.breaks[index - 1] : undefined;
    const hi = scale.breaks[index];
    return lo === undefined
      ? hi === undefined
        ? 'All finite values'
        : `< ${format(hi)}`
      : hi === undefined
        ? `≥ ${format(lo)}`
        : `${format(lo)} – < ${format(hi)}`;
  };
  const sideRangeRowHeight = Math.max(14, Math.ceil(sideLabelStyle.fontSize * 1.3)) + 6;
  const rangeWidth = (scale: ClassScale | null | undefined, format: (value: number) => string) =>
    scale
      ? Math.max(
          ...scale.colors.map(
            (_, index) =>
              22 +
              measureSideText(
                sideRangeLabel(scale, index, format),
                sideLabelStyle.fontSize,
                sideLabelStyle.fontWeight,
              ).width,
          ),
        )
      : 0;
  const captionWidth = Math.max(
    0,
    ...(titlePlan?.lines ?? []).map(
      (text) => measureSideText(text, sideLabelStyle.fontSize, theme.fonts.weights.medium).width,
    ),
    ...[...(unitPlan?.lines ?? []), ...(contextPlan?.lines ?? [])].map(
      (text) => measureSideText(text, sideLabelStyle.fontSize, sideLabelStyle.fontWeight).width,
    ),
    ...pointTextRows(0, 0).map(
      (row) => measureSideText(row.text, row.style.fontSize, row.style.fontWeight).width,
    ),
  );
  const sideWidth = sidePosition
    ? Math.max(
        captionWidth,
        featureActivePlan.width,
        pointActivePlan.width,
        hasNoData
          ? sideLabelStyle.fontSize +
              NO_DATA_LABEL_GAP +
              measureSideText('No data', sideLabelStyle.fontSize).width
          : 0,
        rangeWidth(classScale, keyFormat ?? formatNumber),
        rangeWidth(pointClassScale, pointFormatter),
        measuredSizeContent?.width ?? 0,
        ...[colorEncoding, pointColor].flatMap((channel) =>
          channel
            ? [
                options.measureText?.(
                  legendTitleFor(channel) ?? '',
                  theme.fonts.sizes.small,
                  theme.fonts.weights.medium,
                ).width ??
                  estimateTextWidth(legendTitleFor(channel) ?? '', theme.fonts.sizes.small),
                ...collectCategories(
                  channel.type === 'quantitative'
                    ? []
                    : channel === colorEncoding
                      ? mapSpec.data
                      : mapSpec.points!.data,
                  channel.field,
                  channel.scale?.domain,
                ).map(
                  (label) =>
                    CATEGORICAL_SWATCH_SIZE +
                    CATEGORICAL_SWATCH_GAP +
                    CATEGORICAL_ENTRY_GAP +
                    (options.measureText?.(
                      label,
                      theme.fonts.sizes.small,
                      theme.fonts.weights.normal,
                    ).width ?? estimateTextWidth(label, theme.fonts.sizes.small)),
                ),
              ]
            : [],
        ),
      )
    : 0;
  const choroplethSideHeight = continuousContent
    ? titleHeight +
      contextHeight +
      noDataRowHeight +
      featureKeyExtra +
      (classScale?.colors.length ?? 0) * sideRangeRowHeight
    : titleHeight + categoryHeight(colorEncoding, mapSpec.data) + featureKeyExtra;
  const pointSideHeight =
    showLegend && pointColor
      ? pointContinuousContent
        ? pointTitleHeight +
          pointKeyExtra +
          (pointClassScale?.colors.length ?? 0) * sideRangeRowHeight
        : pointTitleHeight + pointKeyExtra + categoryHeight(pointColor, mapSpec.points!.data)
      : 0;
  const sideKeyHeights = [
    showChoroplethLegend && colorEncoding ? choroplethSideHeight : 0,
    pointSideHeight,
    measuredSizeContent?.height ?? 0,
  ].filter((height) => height > 0);
  const sideHeight =
    sideKeyHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, sideKeyHeights.length - 1) * 16;
  const frame = planGeoMapFrame(
    fullArea,
    legendBlockHeight,
    legendPosition,
    showLegend ? requestedSide : undefined,
    sideWidth,
    sideHeight,
    { width: options.width, height: options.height },
  );
  for (const diagnostic of frame.diagnostics) options.onDiagnostic?.(diagnostic);
  const sideFrame = frame.sideLegend ? { area: frame.area, legend: frame.sideLegend } : null;
  const legendReserveGap = frame.legendReserveGap;
  const mapAreaHeight = frame.area.height;
  const zoom = mapSpec.geo.zoom;
  const zoomControlBounds =
    zoom && (zoom === true || zoom.controls !== false)
      ? geoMapZoomControlsBounds(frame.area)
      : undefined;
  if (mapAreaHeight <= 0) {
    if (viewsEnabled)
      throw new GeoViewGeometryError(
        'GEO_INSET_SPACE',
        'Authored keys and notes leave no positive geographic frame for the requested views.',
      );
    return emptyWithLabels();
  }

  // 9. Projection + path generator
  // When points are present, inset the projection by the max point radius so
  // circles at the geographic edges don't get clipped by the viewBox.
  const projectionType = mapSpec.geo.projection ?? resolveDefaultProjection(topology);
  // Dev-only: identity is the only correct answer for a pre-projected atlas, so
  // the inference is a note about what happened, not a problem to fix. Warning
  // on every production compile would train authors to ignore the channel.
  if (options.dev && !mapSpec.geo.projection && projectionType === 'identity') {
    compileWarnings.push({
      code: 'PROJECTION_INFERRED',
      message:
        'No geo.projection was given and the topology looks pre-projected (its bounding box is ' +
        'outside longitude/latitude range), so projection: "identity" was inferred. ' +
        'Set geo.projection explicitly to silence this.',
      context: { projection: projectionType },
    });
  }
  let pointInset = 0;
  if (mapSpec.points) {
    const sizeRange = mapSpec.points.size?.scale?.range as readonly [number, number] | undefined;
    pointInset = sizeRange ? sizeRange[1] : SIZE_SCALE_DEFAULTS.mapPoint.range[1];
  }
  const insetLabels = (mapSpec.geo.insets ?? []).map((inset) => {
    const coverage = (insetSelection?.views.get(inset.id) ?? [])
      .map((feature) => String(feature.properties?.name ?? feature.properties?.NAME ?? feature.id))
      .join(', ');
    const caption = `${inset.label} · Separate scale${coverage === inset.label ? '' : ` · ${coverage}`}`;
    const captionPadding = 6;
    const plan = measureGeoKeyText(
      caption,
      Math.max(1, inset.width - captionPadding * 2),
      sideLabelStyle,
      measureSideText,
    );
    return {
      inset,
      coverage,
      labelHeight: plan.height + captionPadding * 2,
      label: {
        width:
          captionPadding * 2 +
          Math.max(
            ...plan.lines.map((line) => measureSideText(line, sideLabelStyle.fontSize).width),
          ),
        height: plan.height + captionPadding * 2,
        lines: plan.lines.map((text, index) => ({
          text,
          x: captionPadding,
          y: captionPadding + sideLabelStyle.fontSize + index * plan.advance,
          style: sideLabelStyle,
        })),
      },
    };
  });
  const viewFrame = viewSources
    ? planGeoInsetViewports(
        { x: 0, y: 0, width: frame.area.width, height: frame.area.height },
        insetLabels,
      )
    : undefined;
  const rootViewport = viewFrame?.rootViewport ?? {
    x: 0,
    y: 0,
    width: frame.area.width,
    height: frame.area.height,
  };
  const removedIds = new Set(
    (mapSpec.geo.insets ?? [])
      .filter((inset) => inset.removeFromMain !== false)
      .flatMap((inset) => inset.featureIds.map(String)),
  );
  const sourceFeatureId = (feature: {
    id?: string | number;
    properties?: Record<string, unknown> | null;
  }) => String(feature.id);
  const fitCollection = viewSources
    ? {
        ...viewSources.fit.collection,
        features: viewSources.fit.collection.features.filter(
          (feature) => !removedIds.has(sourceFeatureId(feature)),
        ),
      }
    : geoCollection;
  if (viewSources && !fitCollection.features.length)
    throw new GeoViewGeometryError(
      'GEO_VIEW_FIT',
      'No primary fit geometry remains after explicit inset removal.',
    );
  const projection = createProjection(
    projectionType,
    rootViewport.width,
    rootViewport.height,
    fitCollection,
    pointInset,
  );
  const pathGen = geoPath(projection);

  // 10. Check winding order (skip for identity: geoArea uses spherical math
  // and gives false positives on planar pre-projected coordinates)
  if (projectionType !== 'identity') {
    for (const feat of geoFeatures) {
      const area = geoArea(feat);
      if (area > 2 * Math.PI) {
        const name =
          ((feat.properties as Record<string, unknown> | null)?.name as string) ??
          ((feat.properties as Record<string, unknown> | null)?.NAME as string) ??
          String(feat.id);
        compileWarnings.push({
          code: 'INVERTED_WINDING',
          message:
            `Feature "${name}" has inverted winding order (geoArea > 2π). ` +
            'This usually means the exterior ring is wound clockwise (RFC 7946) instead of ' +
            'counter-clockwise (d3-geo convention). Fix with: npx topojson-rewind your-file.json',
          context: { featureId: feat.id, featureName: name },
        });
      }
    }
  }

  compileWarnings.push(...joinWarnings);

  // 12. Check for null-projecting features (albersUsa drops territories)
  const droppedFeatures: string[] = [];

  // 13. Build color scale + feature marks
  const formatter = buildD3Formatter(mapSpec.encoding?.color?.format) ?? formatNumber;
  const formatQuantitative = (value: unknown): string => {
    const number = finiteNumber(value);
    return number === undefined ? 'No data' : formatter(number);
  };
  // The theme's own neutral ramp, so a warm or cool theme gets a warm or cool
  // "no data" gray instead of an uninvited zinc.
  const neutralFill = theme.colors.mapNoDataFill ?? theme.colors.neutral[100];
  // A solid neutral is indistinguishable from the middle class of a diverging
  // ramp (redBlue's center is #f7f7f7), so holes in the join get a diagonal
  // hatch over the same neutral. Only under a color encoding: a basemap-only
  // map has no data to be missing, and hatching every country would be noise.
  const noDataPattern: ResolvedFillPattern = {
    type: 'diagonal',
    base: neutralFill,
    line: theme.colors.mapNoDataHatch ?? theme.colors.neutral[300],
  };

  let featureMarks: GeoMapFeatureMark[];
  let continuousLegend: ContinuousLegendLayout | null = null;
  let categoricalLegend: CategoricalLegendLayout | null = null;

  const isBasemapOnly = !colorEncoding || (mapSpec.data.length === 0 && mapSpec.points != null);
  if (isBasemapOnly) {
    // Basemap-only mode: all features get neutral fill, no legend
    featureMarks = buildBasemapMarks({
      geoFeatures,
      pathGen,
      neutralFill,
      droppedFeatures,
    });
  } else if (isQuantitative) {
    const result = buildQuantitativeMarks({
      geoFeatures,
      pathGen,
      joined,
      colorField: colorEncoding.field,
      classScale,
      neutralFill,
      noDataPattern,
      formatter,
      droppedFeatures,
    });
    featureMarks = result.marks;

    // Build the continuous legend. Maps place it directly (not via placeLegend,
    // which does cartesian-specific positioning above the chart area).
    if (showChoroplethLegend && continuousContent) {
      const labelStyle: TextStyle = {
        fontFamily: theme.fonts.family,
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.normal,
        fill: theme.colors.text,
        lineHeight: 1.3,
        fontVariant: 'tabular-nums',
      };
      const legendX = fullArea.x;
      const legendY =
        legendPosition === 'bottom'
          ? fullArea.y + mapAreaHeight + legendReserveGap
          : fullArea.y + legendReserveGap;
      const titleStyle: TextStyle | undefined = legendTitle
        ? {
            ...labelStyle,
            fontWeight: theme.fonts.weights.medium,
            fill: theme.colors.neutral.secondary,
          }
        : undefined;
      const titleRowHeight = titleHeight;
      const bounds = {
        x: legendX,
        y: legendY,
        width: sideFrame ? sideWidth : continuousContent.barWidth,
        height: choroplethLegendBlockHeight,
      };
      const bar = {
        x: bounds.x + (sideFrame ? (choroplethSideExtent?.inset ?? 0) : 0),
        y: bounds.y + titleRowHeight,
        width: continuousContent.barWidth,
        height: continuousContent.barHeight,
      };
      const labelY = bar.y + bar.height + CONTINUOUS_LABEL_GAP + labelStyle.fontSize;

      // "No data" is a class of its own, detached from the ramp so nobody reads
      // it as the low end of the scale. Only drawn when the map actually has
      // holes in it.
      const hasUnmatched = featureMarks.some((m) => m.noData);
      const noDataX = bounds.x;
      const noDataY = bounds.y + bounds.height - featureKeyExtra - noDataRowHeight + 8;
      const noDataSize = labelStyle.fontSize;
      const noDataLabelWidth = measureSideText(
        'No data',
        labelStyle.fontSize,
        labelStyle.fontWeight,
      ).width;
      const noDataFits =
        noDataX + noDataSize + NO_DATA_LABEL_GAP + noDataLabelWidth <=
        bounds.x + (sideFrame ? sideWidth : fullArea.width);
      const noData =
        hasUnmatched && noDataFits
          ? {
              x: noDataX,
              y: noDataY,
              size: noDataSize,
              fill: neutralFill,
              // Same hatch the no-data features carry, so the key matches what
              // is on the map rather than a neutral the ramp's center mimics.
              pattern: noDataPattern,
              label: 'No data',
              labelX: noDataX + noDataSize + NO_DATA_LABEL_GAP,
              labelY: noDataY + labelStyle.fontSize,
            }
          : undefined;

      continuousLegend = {
        type: 'continuous' as const,
        mode: continuousContent.mode,
        position: legendPosition,
        bounds,
        labelStyle,
        bar,
        colorStops: continuousContent.colorStops,
        bins: continuousContent.bins.map((b) => ({ ...b, x: b.x + bar.x })),
        ticks: continuousContent.ticks.map((t) => ({ ...t, x: t.x + bar.x })),
        labelY,
        title: legendTitle,
        titleStyle,
        titleY: legendTitle ? bounds.y + labelStyle.fontSize : undefined,
        noData,
        textRows: [
          ...(neutralContext &&
          measureKeyText(neutralContext.label, labelStyle.fontSize).width <=
            continuousContent.bins[neutralContext.index].width - 4
            ? [
                {
                  text: neutralContext.label,
                  x:
                    bar.x +
                    continuousContent.bins[neutralContext.index].x +
                    continuousContent.bins[neutralContext.index].width / 2,
                  y: bar.y + (bar.height + labelStyle.fontSize * 0.7) / 2,
                  style: {
                    ...labelStyle,
                    fill: pickLabelColor(continuousContent.bins[neutralContext.index].color),
                  },
                  role: 'midpoint' as const,
                  anchor: 'middle' as const,
                },
              ]
            : []),
          ...(titlePlan?.lines.map((text, index) => ({
            text,
            x: bounds.x,
            y: bounds.y + labelStyle.fontSize + index * titlePlan.advance,
            style: titleStyle!,
            role: 'title' as const,
          })) ?? []),
          ...(unitPlan?.lines.map((text, index) => ({
            text,
            x: bounds.x,
            y: bounds.y + (titlePlan?.height ?? 0) + labelStyle.fontSize + index * unitPlan.advance,
            style: keyStyle,
            role: 'unit' as const,
          })) ?? []),
          ...(contextPlan?.lines.map((text, index) => ({
            text,
            x: bounds.x,
            y:
              bounds.y +
              bounds.height -
              featureKeyExtra -
              noDataRowHeight -
              contextPlan.height +
              labelStyle.fontSize +
              index * contextPlan.advance,
            style: keyStyle,
            role: 'context' as const,
          })) ?? []),
        ],
      };
    }
  } else {
    const result = buildCategoricalMarks({
      geoFeatures,
      pathGen,
      joined,
      colorField: colorEncoding.field,
      colorScale: colorEncoding.scale,
      isDarkMode: !!isDarkMode,
      neutralFill,
      noDataPattern,
      theme,
      palette: lightTheme.colors.categorical,
      fullArea,
      mapAreaHeight,
      legendReserveGap,
      legendPosition,
      showLegend: showChoroplethLegend,
      droppedFeatures,
    });
    featureMarks = result.marks;
    categoricalLegend = result.legend;
    if (categoricalLegend) {
      const key = categoricalLegend;
      if (key.entryPositions)
        key.entryPositions = key.entryPositions.map((entry) => ({
          ...entry,
          y: entry.y + titleHeight,
          labelY: entry.labelY + titleHeight,
        }));
      if (key.noData)
        key.noData = {
          ...key.noData,
          y: key.noData.y + titleHeight,
          labelY: key.noData.labelY + titleHeight,
        };
      key.bounds.height += titleHeight + featureKeyExtra;
      key.textRows = [
        ...(titlePlan?.lines.map((text, index) => ({
          text,
          x: key.bounds.x,
          y: key.bounds.y + keyStyle.fontSize + index * titlePlan.advance,
          style: { ...keyStyle, fontWeight: theme.fonts.weights.medium },
          role: 'title' as const,
        })) ?? []),
        ...(unitPlan?.lines.map((text, index) => ({
          text,
          x: key.bounds.x,
          y: key.bounds.y + (titlePlan?.height ?? 0) + keyStyle.fontSize + index * unitPlan.advance,
          style: keyStyle,
          role: 'unit' as const,
        })) ?? []),
      ];
    }
  }

  // Report dropped features (null-projecting)
  if (droppedFeatures.length > 0) {
    compileWarnings.push({
      code: 'NULL_PROJECTION',
      message:
        `${droppedFeatures.length} feature(s) project to null and were dropped: ${droppedFeatures.join(', ')}. ` +
        'This is common with albersUsa which excludes territories (PR, GU, VI, AS, MP). ' +
        'If your data includes these, consider using projection: "mercator" or "equalEarth".',
      context: { features: droppedFeatures },
    });
  }

  // 15. Borders via topojson mesh
  const interiorMesh = topoMesh(
    topology,
    topology.objects[objectKey] as GeometryCollection,
    (a, b) => a !== b,
  );
  const outlineMesh = topoMesh(
    topology,
    topology.objects[objectKey] as GeometryCollection,
    (a, b) => a === b,
  );

  const interiorPath = pathGen(interiorMesh) ?? '';
  const outlinePath = pathGen(outlineMesh) ?? '';

  // Border hierarchy: interior lines are hairline-thin and quiet so they read as
  // divisions inside one shape; the outline is heavier and darker so the country
  // (or state set) reads as a single silhouette against the page.
  const interiorStroke =
    theme.colors.mapInteriorBorder ?? (isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)');
  const outlineStroke =
    theme.colors.mapOutlineBorder ?? (isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)');
  const borders: GeoMapBorders = {
    interiorPath,
    outlinePath,
    interiorStroke,
    outlineStroke,
    interiorWidth: 0.6,
    outlineWidth: 1.1,
  };

  // 15b. Point marks (symbol layer above choropleth)
  const pointMarks: GeoMapPointMark[] = [];
  const pointViewTemplates: GeoMapPointMark[] = [];
  let pointCategoricalLegend: CategoricalLegendLayout | null = null;
  let pointContinuousLegend: ContinuousLegendLayout | null = null;
  let pointSizeLegend: SizeLegendLayout | null = null;

  if (mapSpec.points) {
    const pts = mapSpec.points;
    const lonField = pts.longitude.field;
    const latField = pts.latitude.field;
    const keyChannel = pts.key;

    // Size scale
    const sizeScale = buildSizeScale(pts.size, pts.data, SIZE_SCALE_DEFAULTS.mapPoint);

    // Color scale (independent from choropleth)
    let pointColorScale: ((val: unknown) => string) | null = null;
    const pointCategories: string[] = [];
    const pointCategoryColors = new Map<string, string>();

    if (pts.color) {
      if (pts.color.type === 'quantitative') {
        if (pointClassScale) {
          pointColorScale = (val: unknown) => {
            const value = finiteNumber(val);
            return value !== undefined ? pointClassScale.color(value) : neutralFill;
          };
        }
      } else {
        // nominal / ordinal: honor scale.domain (category order) and scale.range (explicit colors)
        const explicitDomain = pts.color.scale?.domain as string[] | undefined;
        const explicitRange = pts.color.scale?.range as string[] | undefined;

        if (explicitDomain && Array.isArray(explicitDomain)) {
          for (const cat of explicitDomain) {
            pointCategories.push(String(cat));
          }
        }
        // Also pick up any categories in the data that aren't in the explicit domain
        const seen = new Set<string>(pointCategories);
        for (const row of pts.data) {
          const raw = row[pts.color.field];
          if (raw != null) {
            const cat = String(raw);
            if (!seen.has(cat)) {
              seen.add(cat);
              pointCategories.push(cat);
            }
          }
        }

        const colorSource =
          explicitRange && Array.isArray(explicitRange)
            ? explicitRange
            : lightTheme.colors.categorical;
        for (let i = 0; i < pointCategories.length; i++) {
          pointCategoryColors.set(pointCategories[i], colorSource[i % colorSource.length]);
        }

        pointColorScale = (val: unknown) => {
          if (val == null) return colorSource[0];
          return pointCategoryColors.get(String(val)) ?? colorSource[0];
        };
      }
    }

    const defaultFill = lightTheme.colors.categorical[0];
    // Bubbles read as one map layer, not as tinted glass: the knockout stroke
    // (below) is what separates overlapping circles, so the fill can stay near
    // full ink instead of muddying every overlap into a third color.
    const pointOpacity = pts.opacity ?? 0.85;
    const droppedPoints: Array<[number, number]> = [];

    for (let i = 0; i < pts.data.length; i++) {
      const row = pts.data[i];
      const lon = finiteNumber(row[lonField]);
      const lat = finiteNumber(row[latField]);
      if (lon === undefined || lat === undefined) continue;
      const sizeValue = pts.size ? finiteNumber(row[pts.size.field]) : undefined;
      if (pts.size && sizeValue === undefined) continue;

      const r = sizeScale && sizeValue !== undefined ? sizeScale.scale(sizeValue) : 5;
      if (!Number.isFinite(r) || r < 0) continue;
      const fill =
        pointColorScale && pts.color
          ? pointColorScale(row[pts.color.field])
          : pts.color?.type === 'quantitative'
            ? neutralFill
            : defaultFill;
      const key = keyChannel ? String(row[keyChannel.field] ?? i) : String(i);
      // Knockout ring in the canvas color: overlapping bubbles stay countable.
      const stroke = resolveKnockoutColor(theme);

      const template: GeoMapPointMark = {
        type: 'map-point',
        cx: 0,
        cy: 0,
        r,
        fill,
        stroke,
        strokeWidth: 1,
        fillOpacity: pointOpacity,
        key,
        data: row as Record<string, unknown>,
        aria: { role: 'img', label: key },
        animationIndex: 0,
      };
      pointViewTemplates.push(template);
      const projected = projection([lon, lat]);
      if (!projected || !projected.every(Number.isFinite)) {
        droppedPoints.push([lon, lat]);
        continue;
      }
      pointMarks.push({ ...template, cx: projected[0], cy: projected[1] });
    }

    // Large under small: a big bubble drawn last swallows every small one
    // inside it. Sorting by radius descending puts the small ones on top, and
    // the animation order is reassigned afterwards so the entrance still runs
    // in paint order.
    pointMarks.sort((a, b) => b.r - a.r);
    for (let i = 0; i < pointMarks.length; i++) {
      pointMarks[i].animationIndex = i;
    }

    if (droppedPoints.length > 0) {
      const sample = droppedPoints
        .slice(0, 3)
        .map(([lo, la]) => `[${lo}, ${la}]`)
        .join(', ');
      compileWarnings.push({
        code: 'POINT_NULL_PROJECTION',
        message:
          `${droppedPoints.length} point(s) project to null and were dropped (e.g. ${sample}). ` +
          'This is common with albersUsa which excludes territories. ' +
          'Consider using projection: "mercator" or "equalEarth".',
        context: { count: droppedPoints.length, samples: droppedPoints.slice(0, 5) },
      });
    }

    // Point categorical legend
    if (
      pts.color &&
      pts.color.type !== 'quantitative' &&
      pointCategories.length > 0 &&
      showLegend
    ) {
      const labelStyle: TextStyle = {
        fontFamily: theme.fonts.family,
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.normal,
        fill: theme.colors.text,
        lineHeight: 1.2,
      };

      const entries: LegendEntry[] = pointCategories.map((cat) => ({
        label: cat,
        color: pointCategoryColors.get(cat)!,
        shape: 'circle' as const,
      }));

      // Bottom-band placement is offset by the choropleth key. Top keys
      // are moved into their measured band after all content is built. Overlay
      // ('top-left'): float inside the map area's top-left corner — the
      // renderer's backdrop keeps it readable over geography, and the inset
      // clears the frame edge (plus the backdrop's own 10px x-padding).
      const bottomChoroplethHeight =
        legendPosition === 'bottom'
          ? (continuousLegend?.bounds.height ?? categoricalLegend?.bounds.height ?? 0)
          : 0;
      const choroplethLegendGap = bottomChoroplethHeight > 0 ? 8 : 0;
      const legendX = pointLegendOverlay ? fullArea.x + OVERLAY_LEGEND_INSET : fullArea.x;
      const legendY = pointLegendOverlay
        ? fullArea.y + OVERLAY_LEGEND_INSET
        : fullArea.y +
          mapAreaHeight +
          legendReserveGap +
          bottomChoroplethHeight +
          choroplethLegendGap;
      const legendWidth = pointLegendOverlay
        ? fullArea.width - OVERLAY_LEGEND_INSET * 2
        : fullArea.width;
      const swatchSize = 10;
      const swatchGap = 6;
      const entryGap = 16;

      pointCategoricalLegend = {
        type: 'categorical',
        position: pointLegendOverlay ? 'top-left' : 'bottom',
        bounds: {
          x: legendX,
          y: legendY,
          width: legendWidth,
          height: pointTitleHeight + pointCategoryRowCount * pointCategoryRowHeight + pointKeyExtra,
        },
        ...{
          rowHeight: pointCategoryRowHeight,
          entryPositions: pointCategoryRows.map((position, index) => ({
            x: legendX + position.x,
            y: legendY + pointTitleHeight + position.row * pointCategoryRowHeight,
            labelX: legendX + position.x + swatchSize + swatchGap,
            labelY:
              legendY + pointTitleHeight + position.row * pointCategoryRowHeight + swatchSize / 2,
            width: pointCategoryWidths[index],
            row: position.row,
          })),
        },
        textRows: pointTextRows(legendX, legendY),
        labelStyle,
        entries,
        swatchSize,
        swatchGap,
        entryGap,
        swatchChipFill: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      };
    }

    // Point continuous legend (quantitative color)
    if (pts.color && pts.color.type === 'quantitative' && showLegend) {
      const ptContinuousContent = pointContinuousContent;
      if (ptContinuousContent) {
        const labelStyle: TextStyle = {
          fontFamily: theme.fonts.family,
          fontSize: theme.fonts.sizes.small,
          fontWeight: theme.fonts.weights.normal,
          fill: theme.colors.text,
          lineHeight: 1.3,
          fontVariant: 'tabular-nums',
        };
        const bottomChoroplethH =
          legendPosition === 'bottom'
            ? (continuousLegend?.bounds.height ?? categoricalLegend?.bounds.height ?? 0)
            : 0;
        const choroplethLegendGap = bottomChoroplethH > 0 ? 8 : 0;
        const legendX = pointLegendOverlay ? fullArea.x + OVERLAY_LEGEND_INSET : fullArea.x;
        const legendY = pointLegendOverlay
          ? fullArea.y + OVERLAY_LEGEND_INSET
          : fullArea.y + mapAreaHeight + legendReserveGap + bottomChoroplethH + choroplethLegendGap;
        const ptLabelRowHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
        const ptLegendHeight =
          pointTitleHeight +
          pointKeyExtra +
          ptContinuousContent.barHeight +
          CONTINUOUS_LABEL_GAP +
          ptLabelRowHeight * (ptContinuousContent.labelRows ?? 1);
        const bounds = {
          x: legendX,
          y: legendY,
          width: sideFrame ? sideWidth : pointKeyWidth,
          height: ptLegendHeight,
        };
        const bar = {
          x: bounds.x + (pointKeyExtent?.inset ?? 0),
          y: bounds.y + pointTitleHeight,
          width: ptContinuousContent.barWidth,
          height: ptContinuousContent.barHeight,
        };
        pointContinuousLegend = {
          type: 'continuous' as const,
          mode: ptContinuousContent.mode,
          position: pointLegendOverlay ? ('top-left' as const) : ('bottom' as const),
          bounds,
          labelStyle,
          bar,
          textRows: pointTextRows(bounds.x, bounds.y),
          colorStops: ptContinuousContent.colorStops,
          bins: ptContinuousContent.bins.map((b) => ({ ...b, x: b.x + bar.x })),
          ticks: ptContinuousContent.ticks.map((t) => ({ ...t, x: t.x + bar.x })),
          labelY: bar.y + bar.height + CONTINUOUS_LABEL_GAP + labelStyle.fontSize,
        };
      }
    }

    // Point size key: nested circles, bottom-right over the map. Without it a
    // bubble map asks the reader to guess what "twice the area" is worth.
    if (pts.size && showLegend) {
      const content = measuredSizeContent;
      if (content) {
        const insetObstacles = (viewFrame?.insets ?? []).map((view) => ({
          ...view.frame,
          x: frame.area.x + view.frame.x,
          y: frame.area.y + view.frame.y,
        }));
        const obstacles = [
          ...insetObstacles,
          ...(zoomControlBounds ? [zoomControlBounds] : []),
          ...(pointLegendOverlay
            ? [pointContinuousLegend?.bounds, pointCategoricalLegend?.bounds].filter(
                (bounds): bounds is NonNullable<typeof bounds> => !!bounds,
              )
            : []),
          ...featureMarks.map(({ bounds }) => ({
            ...bounds,
            x: bounds.x + frame.area.x,
            y: bounds.y + frame.area.y,
          })),
          ...pointMarks.map((point) => ({
            x: frame.area.x + point.cx - point.r,
            y: frame.area.y + point.cy - point.r,
            width: point.r * 2,
            height: point.r * 2,
          })),
        ];
        const placement = sideFrame
          ? { ...sideFrame.legend, width: content.width, height: content.height }
          : occupiedBoundsSizeKeyCandidate(
              frame.area,
              content.width,
              content.height,
              obstacles,
              OVERLAY_LEGEND_INSET,
              [...(zoomControlBounds ? [zoomControlBounds] : []), ...insetObstacles],
            );
        if (!placement) {
          options.onDiagnostic?.({
            code: 'MAP_SIZE_LEGEND_UNFIT',
            severity: 'warning',
            status: 'failed',
            path: '/points/size',
            origin: 'default',
            viewport: { width: options.width, height: options.height },
            message: 'The complete size key does not fit the map viewport; the key is omitted.',
          });
        } else {
          pointSizeLegend = {
            type: 'size',
            channel: 'size',
            position: 'bottom-right',
            bounds: placement,
            circles: content.circles,
            stroke: theme.colors.neutral[400],
            labelStyle: {
              fontFamily: theme.fonts.family,
              fontSize: theme.fonts.sizes.small,
              fontWeight: theme.fonts.weights.normal,
              fill: theme.colors.neutral.secondary,
              lineHeight: 1.2,
              fontVariant: 'tabular-nums',
            },
            title: content.title,
            titleStyle: content.title ? sizeLegendTitleStyle(theme) : undefined,
            titleY: content.titleY,
            textRows: content.titleLines?.map((text, index) => ({
              text,
              x: placement.x,
              y: placement.y + sideLabelStyle.fontSize + index * (content.titleAdvance ?? 0),
              role: 'title' as const,
              style: sizeLegendTitleStyle(theme),
            })),
          };
        }
      }
    }
  }

  // 16. Tooltips
  const tooltipChannels = mapSpec.encoding.tooltip
    ? Array.isArray(mapSpec.encoding.tooltip)
      ? mapSpec.encoding.tooltip
      : [mapSpec.encoding.tooltip]
    : null;

  const tooltipDescriptors = new Map<string, TooltipContent>();
  for (const mark of featureMarks) {
    if (!mark.data) continue;
    const fields: TooltipField[] = [];
    const name = mark.name ?? String(mark.id);
    fields.push({
      label: 'Region',
      value: name,
      role: 'series',
      source: { field: mapSpec.geo.idField, channel: 'geo' },
    });

    if (tooltipChannels) {
      for (const ch of tooltipChannels) {
        const val = mark.data[ch.field];
        if (val != null || ch.type === 'quantitative') {
          fields.push({
            label: ch.title ?? ch.field,
            role: 'value',
            source: { field: ch.field, channel: 'tooltip' },
            value: ch.type === 'quantitative' ? formatQuantitative(val) : String(val),
          });
        }
      }
    } else if (colorEncoding && isQuantitative) {
      fields.push({
        label: colorEncoding.title ?? colorEncoding.field,
        role: 'value',
        source: { field: colorEncoding.field, channel: 'color' },
        value: formatQuantitative(mark.data[colorEncoding.field]),
      });
    } else if (colorEncoding && !isQuantitative && mark.data[colorEncoding.field] != null) {
      fields.push({
        label: colorEncoding.title ?? colorEncoding.field,
        role: 'value',
        source: { field: colorEncoding.field, channel: 'color' },
        value: String(mark.data[colorEncoding.field]),
      });
    }
    const colorValue = colorEncoding ? finiteNumber(mark.data[colorEncoding.field]) : undefined;
    if (
      !tooltipChannels &&
      classScale &&
      colorValue !== undefined &&
      classScale.breaks.includes(colorValue)
    ) {
      fields.push({
        label: 'Color range',
        role: 'value',
        source: { field: colorEncoding!.field, channel: 'color' },
        value: classIntervalText(classScale, classScale.binIndex(colorValue), formatter),
      });
    }
    tooltipDescriptors.set(String(mark.id), { fields });
  }

  // Point tooltips (keyed with 'point:' prefix to disambiguate from feature IDs)
  if (mapSpec.points && pointMarks.length > 0) {
    const ptTooltipChannels = mapSpec.points.tooltip
      ? Array.isArray(mapSpec.points.tooltip)
        ? mapSpec.points.tooltip
        : [mapSpec.points.tooltip]
      : null;

    for (const pm of pointMarks) {
      const fields: TooltipField[] = [];
      if (ptTooltipChannels) {
        for (const ch of ptTooltipChannels) {
          const val = pm.data[ch.field];
          if (val != null || ch.type === 'quantitative') {
            fields.push({
              label: ch.title ?? ch.field,
              role: 'value',
              source: { field: ch.field, channel: 'tooltip' },
              value: ch.type === 'quantitative' ? formatQuantitative(val) : String(val),
            });
          }
        }
      } else {
        // Auto-populate from key, color, and size channels
        const pts = mapSpec.points!;
        if (pts.key) {
          const val = pm.data[pts.key.field];
          if (val != null)
            fields.push({
              label: pts.key.title ?? pts.key.field,
              value: String(val),
              role: 'series',
              source: { field: pts.key.field, channel: 'key' },
            });
        }
        if (pts.color) {
          const val = pm.data[pts.color.field];
          if (val != null || pts.color.type === 'quantitative')
            fields.push({
              label: pts.color.title ?? pts.color.field,
              role: 'value',
              source: { field: pts.color.field, channel: 'color' },
              value: pts.color.type === 'quantitative' ? formatQuantitative(val) : String(val),
            });
        }
        if (pts.size) {
          const val = pm.data[pts.size.field];
          fields.push({
            label: pts.size.title ?? pts.size.field,
            value: formatQuantitative(val),
            role: 'value',
            source: { field: pts.size.field, channel: 'size' },
          });
        }
      }
      if (fields.length > 0) {
        tooltipDescriptors.set(`point:${pm.key}`, { fields });
      }
    }
  }

  // 17. Accessibility
  const a11yDataField = colorEncoding?.field;
  const a11y = {
    altText:
      pointMarks.length > 0
        ? colorEncoding
          ? `Map showing ${geoFeatures.length} regions with ${isQuantitative ? 'quantitative' : 'categorical'} data and ${pointMarks.length} point markers`
          : `Map showing ${geoFeatures.length} regions with ${pointMarks.length} point markers`
        : colorEncoding
          ? `Map showing ${geoFeatures.length} regions with ${isQuantitative ? 'quantitative' : 'categorical'} data`
          : `Map showing ${geoFeatures.length} regions`,
    dataTableFallback: [
      ...featureMarks
        .filter((m) => m.data)
        .map((m) => [
          m.name ?? String(m.id),
          a11yDataField ? String(m.data?.[a11yDataField] ?? '') : '',
        ]),
      ...pointMarks.map((pm) => [
        pm.key,
        mapSpec.points?.color ? String(pm.data[mapSpec.points.color.field] ?? '') : '',
      ]),
    ],
    role: 'img' as const,
    keyboardNavigable: featureMarks.length > 0 || pointMarks.length > 0,
  };

  if (showChoroplethLegend && classScale) {
    a11y.altText += `. Color ranges: ${classScale.colors.map((_, index) => classIntervalText(classScale, index, formatter)).join('; ')}.`;
  }

  // 18. Resolve focus
  const resolvedFocus = resolveFocus(mapSpec.geo.focus, featureMarks, pointMarks, compileWarnings);

  // 19. Animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(mapSpec.animation);

  // 20. Map drawing area is owned by the measured geographic frame.
  const mapArea = frame.area;

  // The top band already includes point-color key height. Paint the key in
  // that reservation rather than over the lower part of the geography.
  if (!sideFrame && !pointLegendOverlay && legendPosition === 'top') {
    const key = pointContinuousLegend ?? pointCategoricalLegend;
    if (key) moveGeoMapLegend(key, fullArea.x, mapArea.y - key.bounds.height - 8, 'top');
  }

  if (sideFrame && sidePosition) {
    let keyY = sideFrame.legend.y;
    const keys = [
      continuousLegend,
      categoricalLegend,
      pointContinuousLegend,
      pointCategoricalLegend,
      pointSizeLegend,
    ];
    for (const key of keys) {
      if (!key) continue;
      if (key === continuousLegend) key.bounds.height = choroplethSideHeight;
      if (key === pointContinuousLegend) key.bounds.height = pointSideHeight;
      if (key.type !== 'continuous' && key.type !== 'size') {
        const rowHeight = sideRowHeight;
        key.entryPositions = key.entries.map((_, index) => ({
          x: key.bounds.x,
          y:
            key.bounds.y +
            (key === categoricalLegend ? titleHeight : pointTitleHeight) +
            index * rowHeight,
          labelX: key.bounds.x + key.swatchSize + key.swatchGap,
          labelY:
            key.bounds.y +
            (key === categoricalLegend ? titleHeight : pointTitleHeight) +
            index * rowHeight +
            key.swatchSize / 2,
          width: sideWidth,
          row: index,
        }));
        if (key.noData) {
          const noDataY =
            key.bounds.y +
            (key === categoricalLegend ? titleHeight : pointTitleHeight) +
            key.entries.length * rowHeight;
          key.noData = {
            ...key.noData,
            x: key.bounds.x,
            y: noDataY,
            labelX: key.bounds.x + key.swatchSize + NO_DATA_LABEL_GAP,
            labelY: noDataY + key.swatchSize / 2,
          };
        }
        key.bounds.height = key === categoricalLegend ? choroplethSideHeight : pointSideHeight;
        key.bounds.width = sideWidth;
      }
      if (key.type === 'continuous') {
        const scale = key === continuousLegend ? classScale : pointClassScale;
        const format = key === continuousLegend ? formatter : pointFormatter;
        const headerHeight = key === continuousLegend ? titleHeight : pointTitleHeight;
        key.bounds.width = sideWidth;
        key.rangeEntries = key.bins.map((_, index) => ({
          index,
          bounds: {
            x: key.bounds.x,
            y: key.bounds.y + headerHeight + index * sideRangeRowHeight,
            width: 14,
            height: 14,
          },
        }));
        key.bar = {
          x: key.bounds.x,
          y: key.bounds.y + headerHeight,
          width: 14,
          height: Math.max(14, (scale?.colors.length ?? 0) * sideRangeRowHeight - 6),
        };
        key.ticks = [];
        key.textRows = (key.textRows ?? []).filter((row) => row.role !== 'midpoint');
        let contextLine = 0;
        key.textRows = key.textRows.map((row) =>
          row.role === 'context'
            ? {
                ...row,
                y:
                  key.bounds.y +
                  headerHeight +
                  (scale?.colors.length ?? 0) * sideRangeRowHeight +
                  8 +
                  sideLabelStyle.fontSize +
                  contextLine++ * (contextPlan?.advance ?? sideRangeRowHeight),
              }
            : row,
        );
        for (const entry of key.rangeEntries)
          if (scale)
            key.textRows.push({
              text: sideRangeLabel(scale, entry.index, format),
              x: entry.bounds.x + 22,
              y: entry.bounds.y + sideLabelStyle.fontSize,
              style: sideLabelStyle,
              role: 'context',
            });
        if (key.noData) {
          const y =
            key.bounds.y +
            key.bounds.height -
            (key === continuousLegend ? featureKeyExtra : pointKeyExtra) -
            noDataRowHeight +
            8;
          key.noData = {
            ...key.noData,
            x: key.bounds.x,
            y,
            labelX: key.bounds.x + key.noData.size + NO_DATA_LABEL_GAP,
            labelY: y + sideLabelStyle.fontSize,
          };
        }
      }
      moveGeoMapLegend(key, sideFrame.legend.x, keyY, sidePosition);
      keyY += key.bounds.height + 16;
    }
  }

  let views: import('@opendata-ai/openchart-core').GeoViewLayout[] | undefined;
  const viewProjections = new Map<string, typeof projection>();
  const viewFeatures = new Map<string, GeoJSON.Feature[]>();
  if (viewSources && viewFrame && insetSelection) {
    const rootIds = new Set(insetSelection.root.map((feature) => String(feature.id)));
    featureMarks = featureMarks.filter((mark) => rootIds.has(String(mark.id)));
    const insetPointRows = new Map(
      (mapSpec.geo.insets ?? []).map((inset) => [
        inset.id,
        selectGeoInsetPoints(mapSpec.points?.data ?? [], inset, mapSpec.points?.key?.field),
      ]),
    );
    const removedPointRows = new Set(
      (mapSpec.geo.insets ?? [])
        .filter((inset) => inset.removeFromMain !== false)
        .flatMap((inset) => insetPointRows.get(inset.id) ?? []),
    );
    pointMarks.splice(
      0,
      pointMarks.length,
      ...pointMarks.filter((mark) => !removedPointRows.has(mark.data)),
    );
    const viewBorders = (features: GeoJSON.Feature[], path: ReturnType<typeof geoPath>) => {
      const ids = new Set(features.map(sourceFeatureId));
      const includes = (geometry: unknown) => ids.has(sourceFeatureId(geometry as GeoJSON.Feature));
      return {
        ...borders,
        interiorPath:
          path(
            topoMesh(
              topology,
              topology.objects[objectKey] as GeometryCollection,
              (a, b) => a !== b && includes(a) && includes(b),
            ),
          ) ?? '',
        outlinePath:
          path(
            topoMesh(topology, topology.objects[objectKey] as GeometryCollection, (a, b) =>
              a === b ? includes(a) : includes(a) !== includes(b),
            ),
          ) ?? '',
      };
    };
    const rootBorders = viewBorders(insetSelection.root, pathGen);
    Object.assign(borders, rootBorders);
    viewProjections.set('root', projection);
    viewFeatures.set('root', insetSelection.root);
    views = [
      {
        viewId: 'root',
        frame: rootViewport,
        viewport: rootViewport,
        mapSize: { width: rootViewport.width, height: rootViewport.height },
        features: featureMarks,
        borders,
        pointMarks,
        focus: resolveFocus(mapSpec.geo.focus, featureMarks, pointMarks, []),
        detailLayers: projectGeoDetailLayers(
          mapSpec.geo.detailLayers ?? [],
          projection,
          viewSources.context,
        ),
        projectionContext: viewSources.context,
      },
    ];
    for (const placement of viewFrame.insets) {
      const authored = mapSpec.geo.insets!.find((inset) => inset.id === placement.viewId)!;
      const source = insetSelection.views.get(authored.id)!;
      const context = resolveGeoInsetProjection(authored, viewSources.context);
      const fitted = createProjection(
        context.projection,
        placement.viewport.width,
        placement.viewport.height,
        { type: 'FeatureCollection', features: source },
        pointInset,
      );
      const path = geoPath(fitted);
      viewProjections.set(authored.id, fitted);
      viewFeatures.set(authored.id, source);
      const marks = isBasemapOnly
        ? buildBasemapMarks({
            geoFeatures: source,
            pathGen: path,
            neutralFill,
            droppedFeatures: [],
          })
        : isQuantitative
          ? buildQuantitativeMarks({
              geoFeatures: source,
              pathGen: path,
              joined,
              colorField: colorEncoding.field,
              classScale,
              neutralFill,
              noDataPattern,
              formatter,
              droppedFeatures: [],
            }).marks
          : buildCategoricalMarks({
              geoFeatures: source,
              pathGen: path,
              joined,
              colorField: colorEncoding.field,
              colorScale: colorEncoding.scale,
              isDarkMode: !!isDarkMode,
              neutralFill,
              noDataPattern,
              theme,
              palette: lightTheme.colors.categorical,
              fullArea,
              mapAreaHeight,
              legendReserveGap,
              legendPosition,
              showLegend: false,
              droppedFeatures: [],
            }).marks;
      if (marks.length !== source.length)
        throw new GeoViewGeometryError(
          'GEO_INSET_COVERAGE',
          `Inset ${authored.id} cannot project every explicitly requested feature.`,
        );
      const selected = new Set(insetPointRows.get(authored.id));
      const points = pointViewTemplates
        .filter((mark) => selected.has(mark.data))
        .map((mark) => {
          const row = mark.data;
          const center = fitted([
            Number(row[mapSpec.points!.longitude.field]),
            Number(row[mapSpec.points!.latitude.field]),
          ]);
          if (!center || !center.every(Number.isFinite))
            throw new GeoViewGeometryError(
              'GEO_INSET_POINT',
              `Inset ${authored.id} cannot project an explicitly requested point.`,
            );
          return { ...mark, cx: center[0], cy: center[1] };
        })
        .sort((a, b) => b.r - a.r)
        .map((mark, index) => ({ ...mark, animationIndex: index }));
      const caption = insetLabels.find((entry) => entry.inset.id === authored.id)!;
      views.push({
        viewId: authored.id,
        frame: placement.frame,
        viewport: placement.viewport,
        labelBounds: placement.labelBounds,
        label: caption.label,
        coverage: `${authored.label}. Separate scale. Coverage: ${caption.coverage}.`,
        mapSize: { width: placement.viewport.width, height: placement.viewport.height },
        features: marks,
        borders: viewBorders(source, path),
        pointMarks: points,
        focus: null,
        detailLayers: [],
        projectionContext: context,
      });
    }
  }
  let colorKeys: import('@opendata-ai/openchart-core').GeoColorKeyDescriptor | undefined;
  if (featureKeyExtra || pointKeyExtra) {
    const featureGroups = new Map<string, GeoJSON.Feature[]>();
    for (const feature of geoFeatures) {
      const id = String(feature.id);
      const group = featureGroups.get(id) ?? [];
      group.push(feature);
      featureGroups.set(id, group);
    }
    const representedFeatureIds = new Set(
      (views?.flatMap((view) => view.features) ?? featureMarks).map((mark) => String(mark.id)),
    );
    const countedFeatures = [...featureGroups.values()]
      .filter((group) => group.length === 1 && representedFeatureIds.has(String(group[0].id)))
      .map((group) => joined.get(group[0].id as string | number) ?? null);
    if (
      mapSpec.colorKey?.distribution &&
      [...featureGroups.values()].some((group) => group.length > 1)
    )
      labelDiagnostic(
        'GEO_COLOR_KEY_AMBIGUOUS_ID',
        'Distribution excludes ambiguous duplicate feature identities; each canonical region is counted at most once.',
        '/colorKey/distribution',
      );

    const features = buildGeoColorKey(
      mapSpec.colorKey,
      colorEncoding,
      continuousLegend ?? categoricalLegend,
      countedFeatures,
      classScale ?? undefined,
      theme.fonts.sizes.small,
      featureKeyExtra,
      featureActivePlan,
    );
    const representedPointRows: Array<Record<string, unknown>> = [];
    const retainedPointOccurrences = new Map<Record<string, unknown>, number>();
    for (const marks of views?.map((view) => view.pointMarks) ?? [pointMarks]) {
      const occurrences = new Map<Record<string, unknown>, number>();
      for (const mark of marks) {
        const count = (occurrences.get(mark.data) ?? 0) + 1;
        occurrences.set(mark.data, count);
        if (count <= (retainedPointOccurrences.get(mark.data) ?? 0)) continue;
        retainedPointOccurrences.set(mark.data, count);
        representedPointRows.push(mark.data);
      }
    }
    const points = buildGeoColorKey(
      mapSpec.colorKey,
      pointColor,
      pointContinuousLegend ?? pointCategoricalLegend,
      representedPointRows,
      pointClassScale,
      theme.fonts.sizes.small,
      pointKeyExtra,
      pointActivePlan,
    );
    if (features || points)
      colorKeys = { ...(features ? { features } : {}), ...(points ? { points } : {}) };
  }

  const scopedPrepared = (viewId: string) => {
    if (!preparedLabels || !views) return preparedLabels;
    const view = views.find((view) => view.viewId === viewId)!;
    const ids = new Set(view.features.map((mark) => String(mark.id))),
      points = new Set(view.pointMarks.map((mark) => String(mark.key)));
    return {
      ...preparedLabels,
      candidates: preparedLabels.candidates.filter((candidate) => {
        if (candidate.anchor.viewId)
          return (
            candidate.anchor.viewId === viewId ||
            (viewId === 'root' && !views!.some((view) => view.viewId === candidate.anchor.viewId))
          );
        if (candidate.anchor.kind === 'feature')
          return candidate.anchor.layerId
            ? viewId === 'root'
            : ids.has(String(candidate.anchor.id)) ||
                (viewId === 'root' &&
                  !geoFeatures.some(
                    (feature) =>
                      String(feature.id) ===
                      String(candidate.anchor.kind === 'feature' ? candidate.anchor.id : ''),
                  ));
        if (candidate.anchor.kind === 'point')
          return (
            points.has(String(candidate.anchor.id)) ||
            (viewId === 'root' &&
              !pointViewTemplates.some(
                (mark) =>
                  String(mark.key) ===
                  String(candidate.anchor.kind === 'point' ? candidate.anchor.id : ''),
              ))
          );
        return viewId === 'root';
      }),
    };
  };
  const labelFeatures = (viewId: string) => {
    const features = viewFeatures.get(viewId) ?? geoFeatures;
    if (viewId !== 'root') return features;
    return [
      ...features,
      ...(mapSpec.geo.detailLayers ?? []).flatMap((layer) => {
        const decoded = decodeGeoViewSource(layer.features, layer.objectKey).collection.features;
        const counts = new Map<string, number>();
        for (const feature of decoded)
          if (feature.id !== undefined)
            counts.set(String(feature.id), (counts.get(String(feature.id)) ?? 0) + 1);
        return decoded
          .filter((feature) => feature.id !== undefined && counts.get(String(feature.id)) === 1)
          .map((feature) => ({ ...feature, id: `${layer.id}:${String(feature.id)}` }));
      }),
    ];
  };
  const rootPrepared = scopedPrepared('root');
  const labels = rootPrepared
    ? compilePreparedGeoLabels(
        rootPrepared,
        labelFeatures('root'),
        projection,
        pointMarks,
        { ...mapArea, width: rootViewport.width, height: rootViewport.height },
        [
          zoomControlBounds,
          continuousLegend?.bounds,
          categoricalLegend?.bounds,
          pointContinuousLegend?.bounds,
          pointCategoricalLegend?.bounds,
          pointSizeLegend?.bounds,
        ].filter((bounds): bounds is NonNullable<typeof bounds> => !!bounds),
        fullArea.y + fullArea.height - mapArea.y,
        labelDiagnostic,
        'root',
        new Set((mapSpec.geo.detailLayers ?? []).map((layer) => layer.id)),
      )
    : undefined;
  if (views) {
    views[0].labels = labels;
    for (const view of views.slice(1)) {
      const prepared = scopedPrepared(view.viewId);
      if (prepared)
        view.labels = compilePreparedGeoLabels(
          prepared,
          labelFeatures(view.viewId),
          viewProjections.get(view.viewId),
          view.pointMarks,
          {
            x: mapArea.x + view.viewport.x,
            y: mapArea.y + view.viewport.y,
            width: view.viewport.width,
            height: view.viewport.height,
          },
          zoom && (zoom === true || zoom.controls !== false)
            ? [
                geoMapZoomControlsBounds({
                  x: mapArea.x + view.viewport.x,
                  y: mapArea.y + view.viewport.y,
                  width: view.viewport.width,
                  height: view.viewport.height,
                }),
              ]
            : [],
          fullArea.y + fullArea.height - mapArea.y - view.viewport.y,
          labelDiagnostic,
          view.viewId,
        );
    }
  }
  if (labels) {
    for (const diagnostic of labels.initialOverlay.diagnostics ?? [])
      options.onDiagnostic?.(diagnostic);
  }

  // 21. Anchor bottom chrome below the map + legend, then compute total height
  chrome.bottomAnchorY = fullArea.y + fullArea.height + noteHeight;
  const contentHeight =
    fullArea.y +
    (sideFrame ? fullArea.height : mapAreaHeight + legendReserveGap + legendBlockHeight) +
    chrome.bottomHeight +
    padding +
    noteHeight;

  // 22. Emit compile warnings
  for (const w of compileWarnings) {
    if (options.onWarn) {
      options.onWarn(w.message);
    }
  }

  return {
    area: mapArea,
    ...(labels ? { labels } : {}),
    ...(views ? { views } : {}),
    ...(colorKeys ? { colorKeys } : {}),
    chrome,
    features: featureMarks,
    borders,
    continuousLegend,
    categoricalLegend,
    pointMarks,
    pointCategoricalLegend,
    pointContinuousLegend,
    pointSizeLegend,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: contentHeight,
    animation: resolvedAnimation,
    watermark,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
    warnings: compileWarnings,
    mapSize: views ? views[0].mapSize : { width: frame.area.width, height: mapAreaHeight },
    focus: views ? views[0].focus : resolvedFocus,
  };
}

// ---------------------------------------------------------------------------
// Basemap-only marks (neutral fill, no color encoding)
// ---------------------------------------------------------------------------

interface BasemapOptions {
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  neutralFill: string;
  droppedFeatures: string[];
}

function buildBasemapMarks(opts: BasemapOptions): GeoMapFeatureMark[] {
  const { geoFeatures, pathGen, neutralFill, droppedFeatures } = opts;
  const marks: GeoMapFeatureMark[] = [];
  let animIndex = 0;

  for (const feat of geoFeatures) {
    const pathD = pathGen(feat);
    if (!pathD) {
      const name =
        ((feat.properties as Record<string, unknown> | null)?.name as string) ?? String(feat.id);
      droppedFeatures.push(name);
      continue;
    }

    const featureId = feat.id as string | number;
    const props = feat.properties as Record<string, unknown> | null;
    const name = (props?.name as string) ?? (props?.NAME as string);

    const b = pathGen.bounds(feat);
    const bx = Number.isFinite(b[0][0]) ? b[0][0] : 0;
    const by = Number.isFinite(b[0][1]) ? b[0][1] : 0;
    const bw = Number.isFinite(b[1][0]) ? b[1][0] - bx : 0;
    const bh = Number.isFinite(b[1][1]) ? b[1][1] - by : 0;
    const bounds = { x: bx, y: by, width: bw, height: bh };
    const rawCentroid = pathGen.centroid(feat);
    const cx = Number.isFinite(rawCentroid[0]) ? rawCentroid[0] : bx + bw / 2;
    const cy = Number.isFinite(rawCentroid[1]) ? rawCentroid[1] : by + bh / 2;

    marks.push({
      type: 'map-feature',
      path: pathD,
      fill: neutralFill,
      // The border meshes draw every line on this map. A per-feature stroke on
      // top of them double-draws each shared edge into a visible wash.
      stroke: 'none',
      strokeWidth: 0,
      id: featureId,
      name,
      data: null,
      aria: { role: 'img', label: name ?? String(featureId) },
      animationIndex: animIndex++,
      bounds,
      centroid: [cx, cy],
    });
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Quantitative marks (sequential color scale)
// ---------------------------------------------------------------------------

interface QuantitativeOptions {
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  joined: Map<string | number, Record<string, unknown>>;
  colorField: string;
  /** The shared class scale (null only when no numeric values exist). */
  classScale: ClassScale | null;
  neutralFill: string;
  noDataPattern: ResolvedFillPattern;
  formatter: (n: number) => string;
  droppedFeatures: string[];
}

function buildQuantitativeMarks(opts: QuantitativeOptions): {
  marks: GeoMapFeatureMark[];
} {
  const {
    geoFeatures,
    pathGen,
    joined,
    colorField,
    classScale,
    neutralFill,
    noDataPattern,
    formatter,
    droppedFeatures,
  } = opts;

  const marks: GeoMapFeatureMark[] = [];
  let animIndex = 0;

  for (const feat of geoFeatures) {
    const pathD = pathGen(feat);
    if (!pathD) {
      const name =
        ((feat.properties as Record<string, unknown> | null)?.name as string) ?? String(feat.id);
      droppedFeatures.push(name);
      continue;
    }

    const featureId = feat.id as string | number;
    const dataRow = joined.get(featureId) ?? null;

    let fill = neutralFill;
    let binIndex: number | undefined;
    // A value of exactly 0 is data. Only a missing row, a null cell or a
    // non-numeric cell counts as a hole.
    const value = finiteNumber(dataRow?.[colorField]);
    const hasValue = value !== undefined;
    if (value !== undefined && classScale) {
      fill = classScale.color(value);
      binIndex = classScale.binIndex(value);
    }

    const props = feat.properties as Record<string, unknown> | null;
    const name = (props?.name as string) ?? (props?.NAME as string);

    // Compute projected geometry (guard non-finite bounds from degenerate features)
    const b = pathGen.bounds(feat);
    const bx = Number.isFinite(b[0][0]) ? b[0][0] : 0;
    const by = Number.isFinite(b[0][1]) ? b[0][1] : 0;
    const bw = Number.isFinite(b[1][0]) ? b[1][0] - bx : 0;
    const bh = Number.isFinite(b[1][1]) ? b[1][1] - by : 0;
    const bounds = { x: bx, y: by, width: bw, height: bh };
    const rawCentroid = pathGen.centroid(feat);
    const cx = Number.isFinite(rawCentroid[0]) ? rawCentroid[0] : bx + bw / 2;
    const cy = Number.isFinite(rawCentroid[1]) ? rawCentroid[1] : by + bh / 2;

    marks.push({
      type: 'map-feature',
      path: pathD,
      fill,
      stroke: 'none',
      strokeWidth: 0,
      id: featureId,
      name,
      data: dataRow,
      aria: {
        role: 'img',
        label: name
          ? `${name}: ${value !== undefined ? formatter(value) : 'no data'}`
          : String(featureId),
      },
      animationIndex: animIndex++,
      bounds,
      centroid: [cx, cy],
      binIndex,
      ...(hasValue ? {} : { noData: true, pattern: noDataPattern }),
    });
  }

  return { marks };
}

// ---------------------------------------------------------------------------
// Categorical marks (distinct fill colors)
// ---------------------------------------------------------------------------

interface CategoricalOptions {
  palette: string[];
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  joined: Map<string | number, Record<string, unknown>>;
  colorField: string;
  colorScale?: { domain?: unknown; range?: unknown };
  isDarkMode: boolean;
  neutralFill: string;
  noDataPattern: ResolvedFillPattern;
  theme: ResolvedTheme;
  fullArea: { x: number; y: number; width: number; height: number };
  mapAreaHeight: number;
  legendReserveGap: number;
  legendPosition: 'top' | 'bottom';
  showLegend: boolean;
  droppedFeatures: string[];
}

function buildCategoricalMarks(opts: CategoricalOptions): {
  marks: GeoMapFeatureMark[];
  legend: CategoricalLegendLayout | null;
} {
  const {
    geoFeatures,
    pathGen,
    joined,
    colorField,
    colorScale: scaleConfig,
    isDarkMode,
    neutralFill,
    noDataPattern,
    theme,
    fullArea,
    mapAreaHeight,
    legendReserveGap,
    legendPosition,
    showLegend,
    droppedFeatures,
  } = opts;

  // Collect unique categories: honor scale.domain for order, then append any unseen from data
  const categories = collectCategories(joined.values(), colorField, scaleConfig?.domain);

  const explicitRange = scaleConfig?.range;
  const colorSource = explicitRange && Array.isArray(explicitRange) ? explicitRange : opts.palette;
  const categoryColors = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    categoryColors.set(categories[i], colorSource[i % colorSource.length]);
  }

  const marks: GeoMapFeatureMark[] = [];
  let animIndex = 0;

  for (const feat of geoFeatures) {
    const pathD = pathGen(feat);
    if (!pathD) {
      const name =
        ((feat.properties as Record<string, unknown> | null)?.name as string) ?? String(feat.id);
      droppedFeatures.push(name);
      continue;
    }

    const featureId = feat.id as string | number;
    const dataRow = joined.get(featureId) ?? null;
    const hasData = dataRow !== null;

    let fill = neutralFill;
    // A missing row or a null cell is a hole; any present category (including
    // an empty string or "0") is data.
    let hasValue = false;
    if (hasData) {
      const raw = dataRow[colorField];
      if (raw != null) {
        const cat = String(raw);
        hasValue = true;
        fill = categoryColors.get(cat) ?? neutralFill;
      }
    }

    const props = feat.properties as Record<string, unknown> | null;
    const name = (props?.name as string) ?? (props?.NAME as string);

    // Compute projected geometry (guard non-finite bounds from degenerate features)
    const b = pathGen.bounds(feat);
    const bx = Number.isFinite(b[0][0]) ? b[0][0] : 0;
    const by = Number.isFinite(b[0][1]) ? b[0][1] : 0;
    const bw = Number.isFinite(b[1][0]) ? b[1][0] - bx : 0;
    const bh = Number.isFinite(b[1][1]) ? b[1][1] - by : 0;
    const bounds = { x: bx, y: by, width: bw, height: bh };
    const rawCentroid = pathGen.centroid(feat);
    const cx = Number.isFinite(rawCentroid[0]) ? rawCentroid[0] : bx + bw / 2;
    const cy = Number.isFinite(rawCentroid[1]) ? rawCentroid[1] : by + bh / 2;

    marks.push({
      type: 'map-feature',
      path: pathD,
      fill,
      stroke: 'none',
      strokeWidth: 0,
      id: featureId,
      name,
      data: dataRow,
      aria: {
        role: 'img',
        label: name
          ? `${name}: ${hasData ? String(dataRow[colorField]) : 'no data'}`
          : String(featureId),
      },
      animationIndex: animIndex++,
      bounds,
      centroid: [cx, cy],
      ...(hasValue ? {} : { noData: true, pattern: noDataPattern }),
    });
  }

  // Legend
  let legend: CategoricalLegendLayout | null = null;
  if (showLegend && categories.length > 0) {
    const labelStyle = categoricalLegendLabelStyle(theme);

    const entries: LegendEntry[] = categories.map((cat) => ({
      label: cat,
      color: categoryColors.get(cat)!,
      shape: 'square' as const,
    }));

    // Honor legend.position like the continuous path does. The map drawing
    // area (mapAreaY in compileGeoMap) already shifts down for top legends, so
    // the legend row here must agree with it — a bottom-anchored legend with
    // a top-shifted map is how legends used to land on top of Alaska.
    const legendX = fullArea.x;
    const legendY =
      legendPosition === 'bottom'
        ? fullArea.y + mapAreaHeight + legendReserveGap
        : fullArea.y + legendReserveGap;
    const legendWidth = fullArea.width;
    const swatchSize = CATEGORICAL_SWATCH_SIZE;
    const swatchGap = CATEGORICAL_SWATCH_GAP;
    const entryGap = CATEGORICAL_ENTRY_GAP;

    // Entries wrap once they run past the frame, so the engine resolves the
    // positions itself rather than letting the renderer's fallback guess -- the
    // "no data" swatch has to know where the last entry actually landed.
    const entryWidths = entries.map((e) => categoricalEntryWidth(e.label, labelStyle));
    const placed = wrapCategoricalEntries(entryWidths, legendWidth);
    const entryPositions = placed.map((p, i) => {
      const x = legendX + p.x;
      const y = legendY + p.row * CATEGORICAL_ROW_HEIGHT;
      return {
        x,
        y,
        labelX: x + swatchSize + swatchGap,
        labelY: y + swatchSize / 2,
        width: entryWidths[i],
        row: p.row,
      };
    });
    let rows = placed.length > 0 ? placed[placed.length - 1].row + 1 : 1;

    // Unjoined features are hatched, so the hatch needs a key of its own --
    // detached after the last entry, never as one more category. Only drawn
    // when the map actually has holes, and only when it fits (wrapping to a row
    // of its own when the entries filled the last one).
    const hasUnmatched = marks.some((m) => m.noData);
    const last = placed[placed.length - 1];
    const blockWidth = noDataBlockWidth(labelStyle);
    let noDataOffsetX = last ? last.x + entryWidths[entryWidths.length - 1] : 0;
    let noDataRow = last ? last.row : 0;
    if (noDataOffsetX + blockWidth > legendWidth) {
      noDataOffsetX = 0;
      noDataRow += 1;
    }
    const noDataX = legendX + noDataOffsetX;
    const noDataY = legendY + noDataRow * CATEGORICAL_ROW_HEIGHT;
    // Match the entry chips: a rounded 6px square centered in the 10px slot,
    // label on the slot's centerline.
    const chipSize = Math.round(swatchSize * 0.6);
    const noData =
      hasUnmatched && blockWidth <= legendWidth
        ? {
            x: noDataX + (swatchSize - chipSize) / 2,
            y: noDataY + swatchSize / 2 - chipSize / 2,
            size: chipSize,
            fill: neutralFill,
            // The same hatch the no-data features carry, so the key matches
            // what is on the map.
            pattern: noDataPattern,
            label: 'No data',
            labelX: noDataX + swatchSize + NO_DATA_LABEL_GAP,
            labelY: noDataY + swatchSize / 2,
          }
        : undefined;
    if (noData) rows = Math.max(rows, noDataRow + 1);

    legend = {
      type: 'categorical',
      position: legendPosition,
      bounds: {
        x: legendX,
        y: legendY,
        width: legendWidth,
        height: rows * CATEGORICAL_ROW_HEIGHT,
      },
      labelStyle,
      entries,
      entryPositions,
      rowHeight: CATEGORICAL_ROW_HEIGHT,
      swatchSize,
      swatchGap,
      entryGap,
      swatchChipFill: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      noData,
    };
  }

  return { marks, legend };
}

// ---------------------------------------------------------------------------
// Focus resolution
// ---------------------------------------------------------------------------

function resolveFocus(
  focus: GeoMapFocus | null,
  features: GeoMapFeatureMark[],
  pointMarks: GeoMapPointMark[],
  warnings: CompileWarning[],
): GeoMapFocusLayout | null {
  if (focus === null || focus === undefined) return null;

  // Points form fits the union of the point layer's circle bounds (cx +/- r)
  // rather than any feature. Use it when the points cluster in a small part of a
  // large feature, so fitting the feature would leave the cluster small and
  // off-center. `points: true` fits every point; `points: { field, value }`
  // fits only the matching subset, so a story can pan between sub-clusters.
  if (typeof focus === 'object' && !Array.isArray(focus) && 'points' in focus) {
    const filter = focus.points;
    const matched =
      filter === true
        ? pointMarks
        : pointMarks.filter((p) => p.data[filter.field] === filter.value);

    if (matched.length === 0) {
      const detail =
        filter === true
          ? 'the map has no points to fit'
          : `no points match { field: "${filter.field}", value: ${JSON.stringify(filter.value)} }`;
      warnings.push({
        code: 'FOCUS_UNMATCHED',
        message: `geo.focus.points is set but ${detail}`,
        context: {},
      });
      return null;
    }
    const padding = focus.padding ?? 16;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of matched) {
      // Use center points only, not cx ± r: the camera counter-scales point
      // radii to constant screen size, so the base radius doesn't occupy
      // projected space after the transform. Including it inflates the
      // bounding box and produces a much shallower zoom than expected.
      minX = Math.min(minX, p.cx);
      minY = Math.min(minY, p.cy);
      maxX = Math.max(maxX, p.cx);
      maxY = Math.max(maxY, p.cy);
    }
    // Guard against degenerate bounding box (single point or coincident points)
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    return {
      target: { x: minX, y: minY, width: w, height: h, padding },
      // No feature ids: focus-dim is a feature concept, so a points focus
      // dims no features (there are no "other" features to mute).
      ids: [],
    };
  }

  // Normalize to { ids, padding }
  let ids: Array<string | number>;
  let padding = 16;

  if (typeof focus === 'string' || typeof focus === 'number') {
    ids = [focus];
  } else if (Array.isArray(focus)) {
    ids = focus;
  } else {
    // Object form: { features, padding? }
    const feats = focus.features;
    ids = typeof feats === 'string' || typeof feats === 'number' ? [feats] : feats;
    padding = focus.padding ?? 16;
  }

  // Find matching features and compute union bounds
  const idSet = new Set(ids.map(String));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const matchedIds: Array<string | number> = [];

  for (const f of features) {
    if (idSet.has(String(f.id))) {
      matchedIds.push(f.id);
      minX = Math.min(minX, f.bounds.x);
      minY = Math.min(minY, f.bounds.y);
      maxX = Math.max(maxX, f.bounds.x + f.bounds.width);
      maxY = Math.max(maxY, f.bounds.y + f.bounds.height);
    }
  }

  // Warn on unmatched ids
  const unmatchedIds = ids.filter((id) => !matchedIds.some((m) => String(m) === String(id)));
  if (unmatchedIds.length > 0) {
    warnings.push({
      code: 'FOCUS_UNMATCHED',
      message: `geo.focus references feature id(s) not found in the map: ${unmatchedIds.join(', ')}`,
      context: { unmatchedIds },
    });
  }

  if (matchedIds.length === 0) return null;

  return {
    target: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      padding,
    },
    ids: matchedIds,
  };
}

// ---------------------------------------------------------------------------
// Empty layout fallback
// ---------------------------------------------------------------------------

function emptyLayout(
  chrome: ReturnType<typeof computeChrome>,
  theme: ResolvedTheme,
  options: CompileOptions,
  watermark: boolean,
): GeoMapLayout {
  return {
    area: { x: 0, y: 0, width: 0, height: 0 },
    chrome,
    features: [],
    borders: {
      interiorPath: '',
      outlinePath: '',
      interiorStroke: 'rgba(0,0,0,0.25)',
      outlineStroke: 'rgba(0,0,0,0.55)',
      interiorWidth: 0.6,
      outlineWidth: 1.1,
    },
    continuousLegend: null,
    categoricalLegend: null,
    pointMarks: [],
    pointCategoricalLegend: null,
    pointContinuousLegend: null,
    pointSizeLegend: null,
    tooltipDescriptors: new Map(),
    a11y: {
      altText: 'Empty map',
      dataTableFallback: [],
      role: 'img',
      keyboardNavigable: false,
    },
    theme,
    width: options.width,
    height: options.height,
    animation: undefined,
    watermark,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
    warnings: [],
    mapSize: { width: 0, height: 0 },
    focus: null,
  };
}
