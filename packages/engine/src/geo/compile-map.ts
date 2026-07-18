import type {
  CategoricalLegendLayout,
  CompileOptions,
  CompileWarning,
  ContinuousLegendLayout,
  EncodingChannel,
  LegendEntry,
  MapBorders,
  MapFeatureMark,
  MapFocus,
  MapFocusLayout,
  MapLayout,
  MapPointMark,
  ResolvedAnimation,
  ResolvedTheme,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  buildD3Formatter,
  CATEGORICAL_PALETTE,
  computeChrome,
  estimateTextWidth,
  formatNumber,
  getBreakpoint,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  resolveTheme,
  SEQUENTIAL_PALETTES,
} from '@opendata-ai/openchart-core';
import { geoArea, geoPath } from 'd3-geo';
import { scaleQuantile } from 'd3-scale';
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { buildSizeScale, SIZE_SCALE_DEFAULTS } from '../compile/size-scale';
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { resolveChromeLayout } from '../layout/shared';
import {
  CONTINUOUS_BAR_HEIGHT,
  CONTINUOUS_LABEL_GAP,
  computeContinuousLegendContentForChannel,
} from '../legend/continuous';
import { joinDataToFeatures } from './join';
import { createProjection } from './projections';
import type { NormalizedMapSpec } from './types';

/**
 * Inset from the map area's edges for overlay ('top-left') point legends.
 * The renderer's backdrop extends 10px left of the legend x, so the visible
 * gap to the frame edge is OVERLAY_LEGEND_INSET - 10.
 */
const OVERLAY_LEGEND_INSET = 18;

function validateGeoFeatures(geo: NormalizedMapSpec['geo']): Topology {
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

export function compileMap(spec: unknown, options: CompileOptions): MapLayout {
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
      'compileMap received a non-map spec. Use compileChart, compileTileMap, compileSankey, or compileBarList instead.',
    );
  }

  const mapSpec = normalized as NormalizedMapSpec;

  // 2. Validate geo features
  const topology = validateGeoFeatures(mapSpec.geo);

  // Resolve watermark
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? mapSpec.watermark : (options.watermark ?? true);

  // 3. Resolve theme
  const mergedThemeConfig = options.theme ? { ...mapSpec.theme, ...options.theme } : mapSpec.theme;
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }
  const isDarkMode = options.darkMode;

  // 4. Chrome
  const chrome = computeChrome(
    {
      title: mapSpec.chrome.title,
      subtitle: mapSpec.chrome.subtitle,
      source: mapSpec.chrome.source,
      byline: mapSpec.chrome.byline,
      footer: mapSpec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );

  // 5. Drawing area
  const padding =
    getBreakpoint(options.width) === 'compact'
      ? Math.max(HPAD_COMPACT_MIN, Math.round(theme.spacing.padding * HPAD_COMPACT_FRACTION))
      : theme.spacing.padding;
  // In 'grow' mode the plot keeps the full height budget (chrome is not
  // subtracted). The returned SVG height is already content-driven (it sums
  // chrome.bottomHeight + content + padding below), so it grows naturally when
  // the plot area is taller. In the default 'subtract' mode this is unchanged.
  // Read chromeLayout from the raw spec: normalizeMapSpec does not carry it
  // through, and MapSpec has no chromeLayout field, so the option default is the
  // primary control (a user-authored spec.chromeLayout still wins here).
  const chromeLayout = resolveChromeLayout(
    spec as { chromeLayout?: 'subtract' | 'grow' } | undefined,
    options,
  );
  const fullArea = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height:
      chromeLayout === 'grow'
        ? options.height - padding * 2
        : options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
  };

  if (fullArea.width <= 0 || fullArea.height <= 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // 6. Parse TopoJSON -> GeoJSON
  const objectKey = Object.keys(topology.objects)[0];
  const geoCollection = topoFeature(topology, topology.objects[objectKey] as GeometryCollection);
  const geoFeatures = geoCollection.features;

  // 7. Compile warnings
  const compileWarnings: CompileWarning[] = [];

  // 8. Legend height reserve
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
  let continuousContent: ReturnType<typeof computeContinuousLegendContentForChannel> = null;
  if (showChoroplethLegend && colorEncoding && isQuantitative) {
    const colorValues: number[] = [];
    for (const row of mapSpec.data) {
      const v = row[colorEncoding.field];
      if (v != null) {
        const n = Number(v);
        if (!Number.isNaN(n)) colorValues.push(n);
      }
    }
    // Maps always use a quantile color scale, so tell the legend infra
    // to produce binned swatches rather than a gradient bar.
    const legendChannel: EncodingChannel = {
      ...colorEncoding,
      scale: { ...colorEncoding.scale, type: 'quantile' },
    };
    continuousContent = computeContinuousLegendContentForChannel(
      colorValues,
      legendChannel,
      theme,
      fullArea.width,
    );
    if (continuousContent) {
      const labelRowHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      legendBlockHeight = continuousContent.barHeight + CONTINUOUS_LABEL_GAP + labelRowHeight;
    }
  } else if (showChoroplethLegend && colorEncoding) {
    const labelHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
    legendBlockHeight = Math.max(10, labelHeight) + 6;
  }

  // Reserve height for point color legend if applicable (overlay legends
  // float inside the map area and reserve nothing)
  if (showLegend && !pointLegendOverlay && mapSpec.points?.color) {
    if (mapSpec.points.color.type === 'quantitative') {
      const labelRowHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      legendBlockHeight += CONTINUOUS_BAR_HEIGHT + CONTINUOUS_LABEL_GAP + labelRowHeight + 8;
    } else {
      const ptLabelHeight = Math.ceil(theme.fonts.sizes.small * 1.3);
      legendBlockHeight += Math.max(10, ptLabelHeight) + 6 + 8; // swatch row + gap
    }
  }

  const legendReserveGap = legendBlockHeight > 0 ? 8 : 0;

  const mapAreaHeight = fullArea.height - legendBlockHeight - legendReserveGap;
  if (mapAreaHeight <= 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // 9. Projection + path generator
  // When points are present, inset the projection by the max point radius so
  // circles at the geographic edges don't get clipped by the viewBox.
  const projectionType = mapSpec.geo.projection;
  let pointInset = 0;
  if (mapSpec.points) {
    const sizeRange = mapSpec.points.size?.scale?.range as readonly [number, number] | undefined;
    pointInset = sizeRange ? sizeRange[1] : SIZE_SCALE_DEFAULTS.mapPoint.range[1];
  }
  const projection = createProjection(
    projectionType,
    fullArea.width,
    mapAreaHeight,
    geoCollection,
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

  // 11. Join data to features (skip when no key channel, e.g. basemap-only mode)
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
    compileWarnings.push(...filteredJoinWarnings);
  }

  // 12. Check for null-projecting features (albersUsa drops territories)
  const droppedFeatures: string[] = [];

  // 13. Build color scale + feature marks
  const formatter =
    buildD3Formatter(mapSpec.encoding?.color?.format ?? mapSpec.valueFormat) ?? formatNumber;
  const neutralFill = isDarkMode ? '#2a2a2a' : '#e8e8e8';
  const neutralStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  let featureMarks: MapFeatureMark[];
  let continuousLegend: ContinuousLegendLayout | null = null;
  let categoricalLegend: CategoricalLegendLayout | null = null;

  if (!colorEncoding) {
    // Basemap-only mode: all features get neutral fill, no legend
    featureMarks = buildBasemapMarks({
      geoFeatures,
      pathGen,
      neutralFill,
      neutralStroke,
      droppedFeatures,
    });
  } else if (isQuantitative) {
    const result = buildQuantitativeMarks({
      geoFeatures,
      pathGen,
      joined,
      colorField: colorEncoding.field,
      palette: colorEncoding.scale?.scheme ?? 'blue',
      isDarkMode: !!isDarkMode,
      neutralFill,
      neutralStroke,
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
      const bounds = {
        x: legendX,
        y: legendY,
        width: continuousContent.barWidth,
        height: legendBlockHeight,
      };
      const bar = {
        x: bounds.x,
        y: bounds.y,
        width: continuousContent.barWidth,
        height: continuousContent.barHeight,
      };
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
        labelY: bar.y + bar.height + CONTINUOUS_LABEL_GAP + labelStyle.fontSize,
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
      neutralStroke,
      theme,
      fullArea,
      mapAreaHeight,
      legendReserveGap,
      legendPosition,
      showLegend: showChoroplethLegend,
      droppedFeatures,
    });
    featureMarks = result.marks;
    categoricalLegend = result.legend;
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

  const interiorStroke = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';
  const outlineStroke = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
  const borders: MapBorders = { interiorPath, outlinePath, interiorStroke, outlineStroke };

  // 15b. Point marks (symbol layer above choropleth)
  const pointMarks: MapPointMark[] = [];
  let pointCategoricalLegend: CategoricalLegendLayout | null = null;
  let pointContinuousLegend: ContinuousLegendLayout | null = null;

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
        const colorValues: number[] = [];
        for (const row of pts.data) {
          const raw = row[pts.color.field];
          if (raw != null) {
            const v = Number(raw);
            if (Number.isFinite(v)) colorValues.push(v);
          }
        }
        if (colorValues.length > 0) {
          const palette = pts.color.scale?.scheme ?? 'blue';
          const paletteStops = [...(SEQUENTIAL_PALETTES[palette] ?? SEQUENTIAL_PALETTES.blue)];
          const qScale = scaleQuantile<string>().domain(colorValues).range(paletteStops);
          pointColorScale = (val: unknown) => {
            const v = Number(val);
            return Number.isFinite(v) ? qScale(v) : CATEGORICAL_PALETTE[0];
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
          explicitRange && Array.isArray(explicitRange) ? explicitRange : CATEGORICAL_PALETTE;
        for (let i = 0; i < pointCategories.length; i++) {
          pointCategoryColors.set(pointCategories[i], colorSource[i % colorSource.length]);
        }

        pointColorScale = (val: unknown) => {
          if (val == null) return colorSource[0];
          return pointCategoryColors.get(String(val)) ?? colorSource[0];
        };
      }
    }

    const defaultFill = CATEGORICAL_PALETTE[0];
    const pointOpacity = pts.opacity ?? 0.65;
    let animIndex = 0;
    const droppedPoints: Array<[number, number]> = [];

    for (let i = 0; i < pts.data.length; i++) {
      const row = pts.data[i];
      const lon = Number(row[lonField]);
      const lat = Number(row[latField]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

      const projected = projection([lon, lat]);
      if (!projected) {
        droppedPoints.push([lon, lat]);
        continue;
      }

      const r = sizeScale ? sizeScale.scale(Number(row[sizeScale.field])) : 5;
      const fill =
        pointColorScale && pts.color ? pointColorScale(row[pts.color.field]) : defaultFill;
      const key = keyChannel ? String(row[keyChannel.field] ?? i) : String(i);
      const stroke = isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';

      pointMarks.push({
        type: 'map-point',
        cx: projected[0],
        cy: projected[1],
        r,
        fill,
        stroke,
        strokeWidth: 1,
        fillOpacity: pointOpacity,
        key,
        data: row as Record<string, unknown>,
        aria: { role: 'img', label: key },
        animationIndex: animIndex++,
      });
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

      // Default: position below the map, offset by choropleth legend height
      // when that legend is also at the bottom (not 'top'). Overlay
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
        bounds: { x: legendX, y: legendY, width: legendWidth, height: swatchSize + 6 },
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
      const ptColorValues: number[] = [];
      for (const row of pts.data) {
        const v = row[pts.color.field];
        if (v != null) {
          const n = Number(v);
          if (Number.isFinite(n)) ptColorValues.push(n);
        }
      }
      const ptLegendChannel: EncodingChannel = {
        ...pts.color,
        scale: { ...pts.color.scale, type: 'quantile' },
      };
      const ptContinuousContent = computeContinuousLegendContentForChannel(
        ptColorValues,
        ptLegendChannel,
        theme,
        fullArea.width,
      );
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
          ptContinuousContent.barHeight + CONTINUOUS_LABEL_GAP + ptLabelRowHeight;
        const bounds = {
          x: legendX,
          y: legendY,
          width: ptContinuousContent.barWidth,
          height: ptLegendHeight,
        };
        const bar = {
          x: bounds.x,
          y: bounds.y,
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
          colorStops: ptContinuousContent.colorStops,
          bins: ptContinuousContent.bins.map((b) => ({ ...b, x: b.x + bar.x })),
          ticks: ptContinuousContent.ticks.map((t) => ({ ...t, x: t.x + bar.x })),
          labelY: bar.y + bar.height + CONTINUOUS_LABEL_GAP + labelStyle.fontSize,
        };
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
    fields.push({ label: 'Region', value: name });

    if (tooltipChannels) {
      for (const ch of tooltipChannels) {
        const val = mark.data[ch.field];
        if (val != null) {
          fields.push({
            label: ch.title ?? ch.field,
            value: ch.type === 'quantitative' ? formatter(Number(val)) : String(val),
          });
        }
      }
    } else if (colorEncoding && isQuantitative && mark.data[colorEncoding.field] != null) {
      fields.push({
        label: colorEncoding.title ?? colorEncoding.field,
        value: formatter(Number(mark.data[colorEncoding.field])),
      });
    } else if (colorEncoding && !isQuantitative && mark.data[colorEncoding.field] != null) {
      fields.push({
        label: colorEncoding.title ?? colorEncoding.field,
        value: String(mark.data[colorEncoding.field]),
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
          if (val != null) {
            fields.push({
              label: ch.title ?? ch.field,
              value: ch.type === 'quantitative' ? formatter(Number(val)) : String(val),
            });
          }
        }
      } else {
        // Auto-populate from key, color, and size channels
        const pts = mapSpec.points!;
        if (pts.key) {
          const val = pm.data[pts.key.field];
          if (val != null)
            fields.push({ label: pts.key.title ?? pts.key.field, value: String(val) });
        }
        if (pts.color) {
          const val = pm.data[pts.color.field];
          if (val != null)
            fields.push({
              label: pts.color.title ?? pts.color.field,
              value: pts.color.type === 'quantitative' ? formatter(Number(val)) : String(val),
            });
        }
        if (pts.size) {
          const val = pm.data[pts.size.field];
          if (val != null)
            fields.push({ label: pts.size.title ?? pts.size.field, value: formatter(Number(val)) });
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

  // 18. Resolve focus
  const resolvedFocus = resolveFocus(mapSpec.geo.focus, featureMarks, pointMarks, compileWarnings);

  // 19. Animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(mapSpec.animation);

  // 20. Compute the map drawing area (offset when legend is at top)
  const mapAreaY =
    legendPosition === 'top' && legendBlockHeight > 0
      ? fullArea.y + legendBlockHeight + legendReserveGap
      : fullArea.y;
  const mapArea = {
    x: fullArea.x,
    y: mapAreaY,
    width: fullArea.width,
    height: mapAreaHeight,
  };

  // 21. Anchor bottom chrome below the map + legend, then compute total height
  chrome.bottomAnchorY = fullArea.y + fullArea.height;
  const contentHeight =
    fullArea.y +
    mapAreaHeight +
    legendReserveGap +
    legendBlockHeight +
    chrome.bottomHeight +
    padding;

  // 22. Emit compile warnings
  for (const w of compileWarnings) {
    if (options.onWarn) {
      options.onWarn(w.message);
    }
  }

  return {
    area: mapArea,
    chrome,
    features: featureMarks,
    borders,
    continuousLegend,
    categoricalLegend,
    pointMarks,
    pointCategoricalLegend,
    pointContinuousLegend,
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
    mapSize: { width: fullArea.width, height: mapAreaHeight },
    focus: resolvedFocus,
  };
}

// ---------------------------------------------------------------------------
// Basemap-only marks (neutral fill, no color encoding)
// ---------------------------------------------------------------------------

interface BasemapOptions {
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  neutralFill: string;
  neutralStroke: string;
  droppedFeatures: string[];
}

function buildBasemapMarks(opts: BasemapOptions): MapFeatureMark[] {
  const { geoFeatures, pathGen, neutralFill, neutralStroke, droppedFeatures } = opts;
  const marks: MapFeatureMark[] = [];
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
      stroke: neutralStroke,
      strokeWidth: 0.5,
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
  palette: string;
  isDarkMode: boolean;
  neutralFill: string;
  neutralStroke: string;
  formatter: (n: number) => string;
  droppedFeatures: string[];
}

function buildQuantitativeMarks(opts: QuantitativeOptions): {
  marks: MapFeatureMark[];
} {
  const {
    geoFeatures,
    pathGen,
    joined,
    colorField,
    palette,
    isDarkMode,
    neutralFill,
    neutralStroke,
    formatter,
    droppedFeatures,
  } = opts;

  // Collect values for scale domain
  const values: number[] = [];
  for (const row of joined.values()) {
    const raw = row[colorField];
    if (raw != null) {
      const v = Number(raw);
      if (!Number.isNaN(v)) values.push(v);
    }
  }

  const paletteStops = [...(SEQUENTIAL_PALETTES[palette] ?? SEQUENTIAL_PALETTES.blue)];
  const colorScale = scaleQuantile<string>().domain(values).range(paletteStops);

  const marks: MapFeatureMark[] = [];
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
    let stroke = neutralStroke;
    if (hasData) {
      const raw = dataRow[colorField];
      if (raw != null) {
        const v = Number(raw);
        if (!Number.isNaN(v)) {
          fill = colorScale(v);
        }
      }
      stroke = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
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
      stroke,
      strokeWidth: 0.5,
      id: featureId,
      name,
      data: dataRow,
      aria: {
        role: 'img',
        label: name
          ? `${name}: ${hasData && dataRow[colorField] != null && !Number.isNaN(Number(dataRow[colorField])) ? formatter(Number(dataRow[colorField])) : 'no data'}`
          : String(featureId),
      },
      animationIndex: animIndex++,
      bounds,
      centroid: [cx, cy],
    });
  }

  return { marks };
}

// ---------------------------------------------------------------------------
// Categorical marks (distinct fill colors)
// ---------------------------------------------------------------------------

interface CategoricalOptions {
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  joined: Map<string | number, Record<string, unknown>>;
  colorField: string;
  colorScale?: { domain?: unknown; range?: unknown };
  isDarkMode: boolean;
  neutralFill: string;
  neutralStroke: string;
  theme: ResolvedTheme;
  fullArea: { x: number; y: number; width: number; height: number };
  mapAreaHeight: number;
  legendReserveGap: number;
  legendPosition: 'top' | 'bottom';
  showLegend: boolean;
  droppedFeatures: string[];
}

function buildCategoricalMarks(opts: CategoricalOptions): {
  marks: MapFeatureMark[];
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
    neutralStroke,
    theme,
    fullArea,
    mapAreaHeight,
    legendReserveGap,
    legendPosition,
    showLegend,
    droppedFeatures,
  } = opts;

  // Collect unique categories: honor scale.domain for order, then append any unseen from data
  const categories: string[] = [];
  const explicitDomain = scaleConfig?.domain;
  if (explicitDomain && Array.isArray(explicitDomain)) {
    for (const cat of explicitDomain) {
      categories.push(String(cat));
    }
  }
  const seen = new Set<string>(categories);
  for (const row of joined.values()) {
    const raw = row[colorField];
    if (raw != null) {
      const cat = String(raw);
      if (!seen.has(cat)) {
        seen.add(cat);
        categories.push(cat);
      }
    }
  }

  const explicitRange = scaleConfig?.range;
  const colorSource =
    explicitRange && Array.isArray(explicitRange) ? explicitRange : CATEGORICAL_PALETTE;
  const categoryColors = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    categoryColors.set(categories[i], colorSource[i % colorSource.length]);
  }

  const marks: MapFeatureMark[] = [];
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
    let stroke = neutralStroke;
    if (hasData) {
      const raw = dataRow[colorField];
      if (raw != null) {
        const cat = String(raw);
        fill = categoryColors.get(cat) ?? neutralFill;
      }
      stroke = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
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
      stroke,
      strokeWidth: 0.5,
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
    });
  }

  // Legend
  let legend: CategoricalLegendLayout | null = null;
  if (showLegend && categories.length > 0) {
    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: 11,
      fontWeight: 400,
      fill: theme.colors.text,
      lineHeight: 1.2,
    };

    const entries: LegendEntry[] = categories.map((cat) => ({
      label: cat,
      color: categoryColors.get(cat)!,
      shape: 'square' as const,
    }));

    // Honor legend.position like the continuous path does. The map drawing
    // area (mapAreaY in compileMap) already shifts down for top legends, so
    // the legend row here must agree with it — a bottom-anchored legend with
    // a top-shifted map is how legends used to land on top of Alaska.
    const legendX = fullArea.x;
    const legendY =
      legendPosition === 'bottom'
        ? fullArea.y + mapAreaHeight + legendReserveGap
        : fullArea.y + legendReserveGap;
    const legendWidth = fullArea.width;
    const swatchSize = 10;
    const swatchGap = 6;
    const entryGap = 16;

    legend = {
      type: 'categorical',
      position: legendPosition,
      bounds: { x: legendX, y: legendY, width: legendWidth, height: swatchSize + 6 },
      labelStyle,
      entries,
      swatchSize,
      swatchGap,
      entryGap,
      swatchChipFill: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    };
  }

  return { marks, legend };
}

// ---------------------------------------------------------------------------
// Focus resolution
// ---------------------------------------------------------------------------

function resolveFocus(
  focus: MapFocus | null,
  features: MapFeatureMark[],
  pointMarks: MapPointMark[],
  warnings: CompileWarning[],
): MapFocusLayout | null {
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
): MapLayout {
  return {
    area: { x: 0, y: 0, width: 0, height: 0 },
    chrome,
    features: [],
    borders: {
      interiorPath: '',
      outlinePath: '',
      interiorStroke: 'rgba(0,0,0,0.15)',
      outlineStroke: 'rgba(0,0,0,0.3)',
    },
    continuousLegend: null,
    categoricalLegend: null,
    pointMarks: [],
    pointCategoricalLegend: null,
    pointContinuousLegend: null,
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
