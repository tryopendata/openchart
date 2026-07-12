/**
 * Spec normalization: fill in defaults and infer types.
 *
 * Takes a validated VizSpec and produces a NormalizedSpec where:
 * - All optional fields have sensible defaults
 * - Chrome strings are converted to ChromeText objects
 * - Encoding types are inferred from data if not specified
 * - Annotations have default styles
 */

import type {
  Annotation,
  BarListSpec,
  ChartSpec,
  Chrome,
  ChromeText,
  DataRow,
  Encoding,
  FieldType,
  GraphSpec,
  LabelSpec,
  LayerSpec,
  MarkDef,
  SankeySpec,
  TableSpec,
  TileMapSpec,
  VizSpec,
} from '@opendata-ai/openchart-core';
import {
  isBarListSpec,
  isChartSpec,
  isGraphSpec,
  isLayerSpec,
  isSankeySpec,
  isTableSpec,
  isTileMapSpec,
  resolveMarkDef,
  resolveMarkType,
} from '@opendata-ai/openchart-core';
import type { NormalizedBarListSpec } from '../barlist/types';
import type { NormalizedSankeySpec } from '../sankey/types';
import { STATE_CODE_SET } from '../tilemap/layout';
import type { NormalizedTileMapSpec } from '../tilemap/types';
import type {
  NormalizedChartSpec,
  NormalizedChrome,
  NormalizedGraphSpec,
  NormalizedSpec,
  NormalizedTableSpec,
} from './types';

// ---------------------------------------------------------------------------
// Chrome normalization
// ---------------------------------------------------------------------------

/** Convert a string | ChromeText | undefined to ChromeText | undefined. */
function normalizeChromeField(value: string | ChromeText | undefined): ChromeText | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return { text: value };
  return value;
}

/** Normalize all chrome fields from strings to ChromeText objects. */
function normalizeChrome(chrome: Chrome | undefined): NormalizedChrome {
  if (!chrome) return {};
  return {
    eyebrow: normalizeChromeField(chrome.eyebrow),
    title: normalizeChromeField(chrome.title),
    subtitle: normalizeChromeField(chrome.subtitle),
    source: normalizeChromeField(chrome.source),
    byline: normalizeChromeField(chrome.byline),
    footer: normalizeChromeField(chrome.footer),
    brand: normalizeChromeField(chrome.brand),
  };
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

/** Sample values from a data column and infer the field type. */
function inferFieldType(data: DataRow[], field: string): FieldType {
  // Sample up to 50 rows for more reliable inference on mixed/messy data
  const sampleSize = Math.min(50, data.length);
  let numericCount = 0;
  let dateCount = 0;
  let totalNonNull = 0;

  for (let i = 0; i < sampleSize; i++) {
    const value = data[i][field];
    if (value == null) continue;
    totalNonNull++;

    // Check numeric
    if (typeof value === 'number' && Number.isFinite(value)) {
      numericCount++;
      continue;
    }

    // Check date-like strings
    if (typeof value === 'string') {
      // Try as number first
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && value.trim() !== '') {
        numericCount++;
        continue;
      }

      // Try as date
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        dateCount++;
        continue;
      }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      dateCount++;
    }
  }

  if (totalNonNull === 0) return 'nominal';

  // If >80% of sampled values are dates, it's temporal
  if (dateCount / totalNonNull > 0.8) return 'temporal';
  // If >80% are numeric, it's quantitative
  if (numericCount / totalNonNull > 0.8) return 'quantitative';
  // Otherwise it's nominal
  return 'nominal';
}

/** Infer types for encoding channels that don't have one specified. */
function inferEncodingTypes(encoding: Encoding, data: DataRow[], warnings: string[]): Encoding {
  const result = { ...encoding };

  for (const channel of ['x', 'y', 'color', 'size', 'detail', 'key'] as const) {
    const spec = result[channel];
    if (!spec) continue;

    // Skip conditional value definitions - they don't have field/type at the top level
    if ('condition' in spec) continue;
    // Skip bare value defs (no field). The sugar expansion moves these to
    // mark-level properties before normalize runs on the compile path.
    if (!('field' in spec)) continue;

    if (!spec.type) {
      const inferred = inferFieldType(data, spec.field);
      (result as Record<string, unknown>)[channel] = { ...spec, type: inferred };
      warnings.push(
        `Inferred encoding.${channel}.type as "${inferred}" from data values for field "${spec.field}"`,
      );
    } else {
      // Check for potential mismatches and warn
      const actualType = inferFieldType(data, spec.field);
      if (spec.type === 'nominal' && actualType === 'temporal') {
        warnings.push(`Field "${spec.field}" looks temporal but was declared as nominal`);
      }
      if (spec.type === 'nominal' && actualType === 'quantitative') {
        warnings.push(`Field "${spec.field}" looks quantitative but was declared as nominal`);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Annotation normalization
// ---------------------------------------------------------------------------

/** Apply default styles to annotations that don't have them. */
function normalizeAnnotations(
  annotations: Annotation[] | undefined,
  warnings: string[],
): Annotation[] {
  if (!annotations || annotations.length === 0) return [];

  return annotations.map((ann) => {
    if (ann.type === 'rule') {
      warnings.push(
        "[openchart] annotation type 'rule' is deprecated (it collides with the rule mark) and will be removed in v9. Use type: 'refline' instead; the behavior is identical.",
      );
    }
    switch (ann.type) {
      case 'text':
        return {
          ...ann,
          fontSize: ann.fontSize ?? 12,
          fontWeight: ann.fontWeight ?? 400,
          opacity: ann.opacity ?? 1,
        };
      case 'range':
        return {
          ...ann,
          opacity: ann.opacity ?? 0.1,
          fill: ann.fill ?? '#000000',
        };
      case 'refline':
      case 'rule':
        return {
          ...ann,
          type: 'refline' as const,
          style: ann.style ?? 'dashed',
          strokeWidth: ann.strokeWidth ?? 1,
          stroke: ann.stroke ?? '#666666',
          opacity: ann.opacity ?? 0.8,
        };
      default:
        return ann;
    }
  });
}

// ---------------------------------------------------------------------------
// Label normalization
// ---------------------------------------------------------------------------

function normalizeLabels(labels?: LabelSpec): NormalizedChartSpec['labels'] {
  if (labels === false) return { density: 'none', format: '', prefix: '' };
  if (labels === true || labels === undefined) return { density: 'auto', format: '', prefix: '' };
  return {
    density: labels.density ?? 'auto',
    format: labels.format ?? '',
    prefix: labels.prefix ?? '',
    suffix: labels.suffix,
    offsets: labels.offsets,
    color: labels.color,
    fontSize: labels.fontSize,
  };
}

// ---------------------------------------------------------------------------
// Highlight normalization
// ---------------------------------------------------------------------------

/**
 * Normalize `encoding.color.highlight` to a flat string array.
 * Warns when highlight values don't appear in the data.
 */
function normalizeHighlight(encoding: Encoding, data: DataRow[], warnings: string[]): string[] {
  const color = encoding.color;
  if (!color || !('field' in color)) return [];
  const raw = (color as { highlight?: string | string[] }).highlight;
  if (raw == null) return [];
  const highlight = Array.isArray(raw) ? raw : [raw];

  // Warn on unknown values
  if (highlight.length > 0 && data.length > 0) {
    const colorField = color.field;
    const knownValues = new Set(data.map((row) => String(row[colorField])));
    for (const v of highlight) {
      if (!knownValues.has(v)) {
        warnings.push(
          `[openchart] encoding.color.highlight value "${v}" does not match any value in the "${colorField}" data column`,
        );
      }
    }
  }

  if (highlight.length > 0 && color.scale?.range) {
    warnings.push(
      '[openchart] encoding.color.highlight has no effect on color assignment when encoding.color.scale.range is explicitly provided',
    );
  }

  return highlight;
}

// ---------------------------------------------------------------------------
// Series search normalization
// ---------------------------------------------------------------------------

/**
 * Normalize `seriesSearch` to a config object, or undefined when disabled.
 * Search needs a categorical color encoding to enumerate series values;
 * warns and disables when there isn't one.
 */
function normalizeSeriesSearch(
  spec: ChartSpec,
  encoding: Encoding,
  warnings: string[],
): import('@opendata-ai/openchart-core').SeriesSearchConfig | undefined {
  if (!spec.seriesSearch) return undefined;
  const color = encoding.color;
  const hasCategoricalColor =
    !!color &&
    !('condition' in color) &&
    'field' in color &&
    !!color.field &&
    color.type !== 'quantitative';
  if (!hasCategoricalColor) {
    warnings.push(
      '[openchart] seriesSearch requires a categorical color encoding (encoding.color.field with a nominal/ordinal type); ignoring seriesSearch.',
    );
    return undefined;
  }
  return typeof spec.seriesSearch === 'object' ? { ...spec.seriesSearch } : {};
}

// ---------------------------------------------------------------------------
// You draw it normalization
// ---------------------------------------------------------------------------

/**
 * Normalize `youDrawIt` to a config object with defaults filled in, or
 * undefined when disabled. Mark type, single-series, and `from` presence are
 * enforced by validateSpec before normalize runs; this only fills defaults.
 */
function normalizeYouDrawIt(
  spec: ChartSpec,
): import('@opendata-ai/openchart-core').YouDrawItConfig | undefined {
  if (!spec.youDrawIt) return undefined;
  return {
    prompt: 'Draw your guess',
    revealLabel: 'Show me',
    ...spec.youDrawIt,
  };
}

// ---------------------------------------------------------------------------
// Spec-level normalization
// ---------------------------------------------------------------------------

/**
 * Beeswarm point budget. Past this count the dodge layout still resolves
 * every collision, but the swarm piles into a solid band that reads no
 * better than an overplotted strip, and layout cost keeps growing.
 */
const BEESWARM_POINT_BUDGET = 2000;

/**
 * Warn when a parliament `majorityLine.seats` override lands outside the chamber
 * (below 1 or above the seat total). The mark falls back to a simple majority in
 * that case, so this is a non-fatal warning routed through the shared warnings
 * array (dedup + single emit boundary) rather than a raw console.warn in mark
 * computation. Only the object form of majorityLine carries a seat count.
 */
function warnParliamentMajorityRange(
  markDef: MarkDef,
  encoding: Encoding,
  data: DataRow[],
  warnings: string[],
): void {
  const majorityLine = markDef.majorityLine;
  if (!majorityLine || typeof majorityLine !== 'object') return;
  const requested = majorityLine.seats;
  if (requested === undefined) return;

  const valueField = encoding.theta?.field ?? encoding.y?.field;
  if (!valueField) return;

  let totalSeats = 0;
  for (const row of data) {
    const v = Number(row[valueField]);
    if (Number.isFinite(v)) totalSeats += v;
  }
  if (totalSeats <= 0) return;

  if (!Number.isFinite(requested) || requested < 1 || requested > totalSeats) {
    const fallback = Math.floor(totalSeats / 2) + 1;
    warnings.push(
      `[openchart] parliament mark.majorityLine.seats (${requested}) is outside the valid range 1..${totalSeats}; using the default majority threshold of ${fallback}.`,
    );
  }
}

function normalizeChartSpec(spec: ChartSpec, warnings: string[]): NormalizedChartSpec {
  const encoding = inferEncodingTypes(spec.encoding, spec.data, warnings);
  const markType = resolveMarkType(spec.mark);
  const markDef = resolveMarkDef(spec.mark);
  const display = spec.display ?? 'full';

  if (
    display === 'sparkline' &&
    markType !== 'line' &&
    markType !== 'area' &&
    markType !== 'bar' &&
    markType !== 'point'
  ) {
    warnings.push(
      `[openchart] display: 'sparkline' works best with mark: 'line' | 'area' | 'bar' | 'point'. Got mark: '${markType}' — rendering may degrade.`,
    );
  }

  if (markType === 'beeswarm' && spec.data.length > BEESWARM_POINT_BUDGET) {
    warnings.push(
      `[openchart] beeswarm received ${spec.data.length} data points, past the ~${BEESWARM_POINT_BUDGET}-point budget where individual dots stop being readable and the swarm collapses into a solid band. Sample the data down, or summarize the distribution with mark: 'tick' (strip plot) or a binned histogram (bin transform + mark: 'bar').`,
    );
  }

  if (markType === 'parliament') {
    warnParliamentMajorityRange(markDef, encoding, spec.data, warnings);
  }

  return {
    markType,
    markDef,
    data: spec.data,
    encoding,
    chrome: normalizeChrome(spec.chrome),
    metrics: spec.metrics,
    seriesSearch: normalizeSeriesSearch(spec, encoding, warnings),
    youDrawIt: normalizeYouDrawIt(spec),
    annotations: normalizeAnnotations(spec.annotations, warnings),
    labels: normalizeLabels(spec.labels),
    legend: spec.legend,
    endpointLabels: spec.endpointLabels,
    responsive: typeof spec.responsive === 'object' ? true : (spec.responsive ?? true),
    autoThin:
      typeof spec.responsive === 'object'
        ? (spec.responsive.autoThin ?? true)
        : (spec.responsive ?? true),
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    hiddenSeries: spec.hiddenSeries ?? [],
    seriesStyles: spec.seriesStyles ?? {},
    watermark: spec.watermark ?? true,
    highlight: normalizeHighlight(encoding, spec.data, warnings),
    a11y: spec.a11y,
    display,
    resolve: spec.resolve,
    // Default empty userExplicit; compileChart overwrites this with the real
    // descriptor built from the raw expanded spec before normalize runs.
    userExplicit: {
      chrome: false,
      legend: false,
      endpointLabels: false,
      xAxis: false,
      yAxis: false,
      labels: false,
      animation: false,
      watermark: false,
      crosshair: false,
    },
  };
}

function normalizeTableSpec(spec: TableSpec, _warnings: string[]): NormalizedTableSpec {
  return {
    type: 'table',
    data: spec.data,
    columns: spec.columns,
    rowKey: spec.rowKey,
    chrome: normalizeChrome(spec.chrome),
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    search: spec.search ?? false,
    pagination: spec.pagination ?? false,
    stickyFirstColumn: spec.stickyFirstColumn ?? false,
    compact: spec.compact ?? false,
    responsive: spec.responsive ?? true,
    animation: spec.animation,
    watermark: spec.watermark ?? true,
  };
}

function normalizeSankeySpec(spec: SankeySpec, _warnings: string[]): NormalizedSankeySpec {
  return {
    type: 'sankey',
    data: spec.data,
    encoding: spec.encoding,
    nodeWidth: spec.nodeWidth ?? 12,
    nodePadding: spec.nodePadding ?? 16,
    nodeAlign: spec.nodeAlign ?? 'justify',
    iterations: spec.iterations ?? 6,
    linkStyle: spec.linkStyle ?? 'gradient',
    nodeLabelAlign: spec.nodeLabelAlign ?? 'auto',
    nodeSort: spec.nodeSort,
    chrome: normalizeChrome(spec.chrome),
    legend: spec.legend,
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    animation: spec.animation,
    valueFormat: spec.valueFormat,
    linkOpacity: spec.linkOpacity,
    watermark: spec.watermark ?? true,
  };
}

function normalizeGraphSpec(spec: GraphSpec, warnings: string[]): NormalizedGraphSpec {
  // Default layout with chargeStrength and linkDistance
  const defaultLayout = {
    type: 'force' as const,
    chargeStrength: -300,
    linkDistance: 30,
  };
  const layout = spec.layout
    ? {
        ...defaultLayout,
        ...spec.layout,
      }
    : defaultLayout;

  return {
    type: 'graph',
    nodes: spec.nodes,
    edges: spec.edges,
    encoding: spec.encoding ?? {},
    layout,
    nodeOverrides: spec.nodeOverrides,
    chrome: normalizeChrome(spec.chrome),
    annotations: normalizeAnnotations(spec.annotations, warnings),
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    watermark: spec.watermark ?? true,
  };
}

function normalizeTileMapSpec(spec: TileMapSpec, warnings: string[]): NormalizedTileMapSpec {
  // Convert record data to array if needed
  let data: Record<string, unknown>[] = Array.isArray(spec.data) ? spec.data : [];

  if (!Array.isArray(spec.data)) {
    // Convert record map to array of rows
    data = Object.entries(spec.data).map(([state, value]) => ({ state, value }));
  }

  // Detect categorical mode: colors map provided, color encoding channel, or string values
  const hasStringValues =
    !Array.isArray(spec.data) && Object.values(spec.data).some((v) => typeof v === 'string');
  const isCategorical =
    spec.colors !== undefined || spec.encoding?.color !== undefined || hasStringValues;

  // Warn on mixed number/string values in record map (likely a data quality issue)
  if (hasStringValues && !Array.isArray(spec.data)) {
    const hasNumericValues = Object.values(spec.data).some((v) => typeof v === 'number');
    if (hasNumericValues) {
      warnings.push(
        'TileMap data: record map contains mixed number and string values. Treating as categorical. Use all numbers for quantitative or all strings for categorical.',
      );
    }
  }

  // Auto-generate encoding if not provided
  let encoding = spec.encoding;
  if (!encoding) {
    encoding = {
      state: { field: 'state', type: 'nominal' },
      value: { field: 'value', type: isCategorical ? 'nominal' : 'quantitative' },
    };
  }

  // For categorical record maps without explicit color encoding, use value as color channel
  if (isCategorical && !encoding.color) {
    encoding = { ...encoding, color: encoding.value };
  }

  // Count matched states and warn if low match ratio
  let matchedCount = 0;
  for (const row of data) {
    const stateCode = String(row[encoding.state.field]);
    if (STATE_CODE_SET.has(stateCode)) {
      matchedCount++;
    }
  }

  const matchRatio = data.length > 0 ? matchedCount / data.length : 0;
  if (matchRatio < 0.5 && data.length > 0) {
    warnings.push(
      `TileMap data: only ${matchedCount} of ${data.length} rows have valid US state codes (expected ≥50%)`,
    );
  }

  return {
    type: 'tilemap',
    data,
    encoding,
    palette: spec.palette ?? 'blue',
    colors: spec.colors,
    chrome: normalizeChrome(spec.chrome),
    legend: spec.legend,
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    watermark: spec.watermark ?? true,
    animation: spec.animation,
    valueFormat: spec.valueFormat,
  };
}

function normalizeBarListSpec(spec: BarListSpec, _warnings: string[]): NormalizedBarListSpec {
  return {
    type: 'barlist',
    data: spec.data,
    encoding: spec.encoding,
    barHeight: spec.barHeight ?? 6,
    cornerRadius: spec.cornerRadius ?? 'pill',
    maxItems: spec.maxItems ?? 20,
    chrome: normalizeChrome(spec.chrome),
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    watermark: spec.watermark ?? true,
    animation: spec.animation ?? true,
    valueFormat: spec.valueFormat,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a validated VizSpec, filling in all defaults.
 *
 * @param spec - A validated VizSpec (must pass validateSpec first).
 * @param warnings - Mutable array to collect non-fatal warnings.
 * @returns A NormalizedSpec with all optionals filled.
 */
export function normalizeSpec(spec: VizSpec, warnings: string[] = []): NormalizedSpec {
  if (isLayerSpec(spec)) {
    // For LayerSpec, we flatten and normalize the first leaf to get a valid NormalizedChartSpec.
    // The actual layer compilation happens in compileLayer, not here.
    // This path exists so the generic compile() pipeline doesn't reject layer specs.
    const leaves = flattenLayers(spec);
    if (leaves.length === 0) {
      throw new Error('LayerSpec has no leaf chart specs after flattening');
    }
    return normalizeChartSpec(leaves[0], warnings);
  }
  if (isChartSpec(spec)) {
    return normalizeChartSpec(spec, warnings);
  }
  if (isTableSpec(spec)) {
    return normalizeTableSpec(spec, warnings);
  }
  if (isGraphSpec(spec)) {
    return normalizeGraphSpec(spec, warnings);
  }
  if (isSankeySpec(spec)) {
    return normalizeSankeySpec(spec, warnings);
  }
  if (isTileMapSpec(spec)) {
    return normalizeTileMapSpec(spec, warnings);
  }
  if (isBarListSpec(spec)) {
    return normalizeBarListSpec(spec, warnings);
  }
  // Should never happen after validation
  throw new Error(
    `Unknown spec shape. Expected mark (chart), layer, type: 'table', type: 'graph', type: 'sankey', type: 'tilemap', or type: 'barlist'.`,
  );
}

// ---------------------------------------------------------------------------
// Layer flattening (used by compileLayer in compile.ts)
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a LayerSpec into leaf ChartSpecs.
 * Merges parent data, encoding, and transforms down to children.
 */
export function flattenLayers(
  spec: LayerSpec,
  parentData?: DataRow[],
  parentEncoding?: Encoding,
  parentTransforms?: import('@opendata-ai/openchart-core').Transform[],
  parentWatermark?: boolean,
  parentEndpointLabels?: boolean | import('@opendata-ai/openchart-core').EndpointLabelsConfig,
): ChartSpec[] {
  const resolvedData = spec.data ?? parentData;
  const resolvedEncoding: Encoding | undefined =
    parentEncoding && spec.encoding
      ? { ...parentEncoding, ...spec.encoding }
      : (spec.encoding ?? parentEncoding);
  const resolvedTransforms = [...(parentTransforms ?? []), ...(spec.transform ?? [])];
  // Layer-level watermark propagates to children (child can still override)
  const resolvedWatermark = spec.watermark ?? parentWatermark;
  const resolvedEndpointLabels = spec.endpointLabels ?? parentEndpointLabels;

  const leaves: ChartSpec[] = [];

  for (const child of spec.layer) {
    if (isLayerSpec(child)) {
      // Nested layer: recurse with merged context
      leaves.push(
        ...flattenLayers(
          child,
          resolvedData,
          resolvedEncoding,
          resolvedTransforms,
          resolvedWatermark,
          resolvedEndpointLabels,
        ),
      );
    } else {
      // Leaf ChartSpec: merge inherited properties
      const mergedData = child.data ?? resolvedData ?? [];
      const mergedEncoding = resolvedEncoding
        ? { ...resolvedEncoding, ...child.encoding }
        : child.encoding;
      const mergedTransforms = [...resolvedTransforms, ...(child.transform ?? [])];

      leaves.push({
        ...child,
        data: mergedData,
        encoding: mergedEncoding,
        transform: mergedTransforms.length > 0 ? mergedTransforms : undefined,
        // Inherit parent watermark if child doesn't explicitly set one
        ...(child.watermark === undefined && resolvedWatermark !== undefined
          ? { watermark: resolvedWatermark }
          : {}),
        ...(child.endpointLabels === undefined && resolvedEndpointLabels !== undefined
          ? { endpointLabels: resolvedEndpointLabels }
          : {}),
      } as ChartSpec);
    }
  }

  return leaves;
}
