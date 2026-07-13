import type {
  CategoricalLegendLayout,
  CompileOptions,
  CompileWarning,
  GradientColorStop,
  GradientLegendLayout,
  LegendEntry,
  MapBorders,
  MapFeatureMark,
  MapLayout,
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
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { joinDataToFeatures } from './join';
import { createProjection } from './projections';
import type { NormalizedMapSpec } from './types';

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
  const fullArea = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height: options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
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
  const legendBarHeight = 6;
  const legendLabelGap = 6;
  const legendTotalHeight = showLegend ? legendBarHeight + legendLabelGap + 14 : 0;
  const legendGap = showLegend ? 8 : 0;

  const mapAreaHeight = fullArea.height - legendTotalHeight - legendGap;
  if (mapAreaHeight <= 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // 9. Projection + path generator
  const projectionType = mapSpec.geo.projection;
  const projection = createProjection(projectionType, fullArea.width, mapAreaHeight, geoCollection);
  const pathGen = projection ? geoPath(projection) : geoPath(null);

  // 10. Check winding order
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

  // 11. Join data to features
  const featureObjs = geoFeatures.map((f) => ({
    id: f.id as string | number,
    properties: (f.properties ?? {}) as Record<string, unknown>,
  }));
  const { joined, warnings: joinWarnings } = joinDataToFeatures(
    featureObjs,
    mapSpec.data,
    mapSpec.encoding.key.field,
    mapSpec.geo.idField,
  );
  compileWarnings.push(...joinWarnings);

  // 12. Check for null-projecting features (albersUsa drops territories)
  const droppedFeatures: string[] = [];

  // 13. Determine color mode
  const colorEncoding = mapSpec.encoding.color;
  const isQuantitative = colorEncoding.type === 'quantitative';

  // 14. Build color scale + feature marks
  const formatter = buildD3Formatter(mapSpec.valueFormat) ?? formatNumber;
  const neutralFill = isDarkMode ? '#2a2a2a' : '#e8e8e8';
  const neutralStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  let featureMarks: MapFeatureMark[];
  let gradientLegend: GradientLegendLayout | null = null;
  let categoricalLegend: CategoricalLegendLayout | null = null;

  if (isQuantitative) {
    const result = buildQuantitativeMarks({
      geoFeatures,
      pathGen,
      joined,
      colorField: colorEncoding.field,
      palette: mapSpec.encoding.color.scale?.scheme ?? 'blue',
      isDarkMode: !!isDarkMode,
      neutralFill,
      neutralStroke,
      formatter,
      theme,
      fullArea,
      mapAreaHeight,
      legendGap,
      showLegend,
      legendBarHeight,
      droppedFeatures,
    });
    featureMarks = result.marks;
    gradientLegend = result.legend;
  } else {
    const result = buildCategoricalMarks({
      geoFeatures,
      pathGen,
      joined,
      colorField: colorEncoding.field,
      isDarkMode: !!isDarkMode,
      neutralFill,
      neutralStroke,
      theme,
      fullArea,
      mapAreaHeight,
      legendGap,
      showLegend,
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

  // 16. Tooltips
  const tooltipDescriptors = new Map<string, TooltipContent>();
  for (const mark of featureMarks) {
    if (!mark.data) continue;
    const fields: TooltipField[] = [];
    const name = mark.name ?? String(mark.id);
    fields.push({ label: 'Region', value: name });
    if (isQuantitative && mark.data[colorEncoding.field] != null) {
      fields.push({
        label: colorEncoding.field,
        value: formatter(Number(mark.data[colorEncoding.field])),
      });
    } else if (!isQuantitative && mark.data[colorEncoding.field] != null) {
      fields.push({
        label: colorEncoding.field,
        value: String(mark.data[colorEncoding.field]),
      });
    }
    tooltipDescriptors.set(String(mark.id), { fields });
  }

  // 17. Accessibility
  const a11y = {
    altText: `Map showing ${geoFeatures.length} regions with ${isQuantitative ? 'quantitative' : 'categorical'} data`,
    dataTableFallback: featureMarks
      .filter((m) => m.data)
      .map((m) => [m.name ?? String(m.id), String(m.data?.[colorEncoding.field] ?? '')]),
    role: 'img' as const,
    keyboardNavigable: featureMarks.length > 0,
  };

  // 18. Animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(mapSpec.animation);

  // 19. Content height
  const contentHeight =
    fullArea.y + mapAreaHeight + legendGap + legendTotalHeight + chrome.bottomHeight + padding;

  // 20. Emit compile warnings
  for (const w of compileWarnings) {
    if (options.onWarn) {
      options.onWarn(w.message);
    }
  }

  return {
    area: fullArea,
    chrome,
    features: featureMarks,
    borders,
    gradientLegend,
    categoricalLegend,
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
  };
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
  theme: ResolvedTheme;
  fullArea: { x: number; y: number; width: number; height: number };
  mapAreaHeight: number;
  legendGap: number;
  showLegend: boolean;
  legendBarHeight: number;
  droppedFeatures: string[];
}

function buildQuantitativeMarks(opts: QuantitativeOptions): {
  marks: MapFeatureMark[];
  legend: GradientLegendLayout | null;
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
    theme,
    fullArea,
    mapAreaHeight,
    legendGap,
    showLegend,
    legendBarHeight,
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

  let min = 0;
  let max = 100;
  if (values.length > 0) {
    min = values[0];
    max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
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
    });
  }

  // Legend
  let legend: GradientLegendLayout | null = null;
  if (showLegend && values.length > 0) {
    const legendX = fullArea.x;
    const legendY = fullArea.y + mapAreaHeight + legendGap;
    const legendWidth = fullArea.width;

    const numStops = paletteStops.length;
    const gradientColorStops: GradientColorStop[] = paletteStops.map((color, i) => ({
      offset: i / (numStops - 1),
      color,
      opacity: 1,
    }));

    legend = {
      type: 'gradient',
      position: 'bottom',
      bounds: { x: legendX, y: legendY, width: legendWidth, height: legendBarHeight },
      labelStyle: {
        fontFamily: theme.fonts.family,
        fontSize: 11,
        fontWeight: 400,
        fill: theme.colors.text,
        lineHeight: 1.2,
      },
      colorStops: gradientColorStops,
      minLabel: formatter(min),
      maxLabel: formatter(max),
    };
  }

  return { marks, legend };
}

// ---------------------------------------------------------------------------
// Categorical marks (distinct fill colors)
// ---------------------------------------------------------------------------

interface CategoricalOptions {
  geoFeatures: GeoJSON.Feature[];
  pathGen: ReturnType<typeof geoPath>;
  joined: Map<string | number, Record<string, unknown>>;
  colorField: string;
  isDarkMode: boolean;
  neutralFill: string;
  neutralStroke: string;
  theme: ResolvedTheme;
  fullArea: { x: number; y: number; width: number; height: number };
  mapAreaHeight: number;
  legendGap: number;
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
    isDarkMode,
    neutralFill,
    neutralStroke,
    theme,
    fullArea,
    mapAreaHeight,
    legendGap,
    showLegend,
    droppedFeatures,
  } = opts;

  // Collect unique categories in data order
  const categories: string[] = [];
  const seen = new Set<string>();
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

  const categoryColors = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    categoryColors.set(categories[i], CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
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

    const legendX = fullArea.x;
    const legendY = fullArea.y + mapAreaHeight + legendGap;
    const legendWidth = fullArea.width;
    const swatchSize = 10;
    const swatchGap = 6;
    const entryGap = 16;

    legend = {
      type: 'categorical',
      position: 'bottom',
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
    gradientLegend: null,
    categoricalLegend: null,
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
  };
}
