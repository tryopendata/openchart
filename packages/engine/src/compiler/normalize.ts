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
  ChartSpec,
  Chrome,
  ChromeText,
  DataRow,
  Encoding,
  FieldType,
  GraphSpec,
  LayerSpec,
  SankeySpec,
  TableSpec,
  VizSpec,
} from '@opendata-ai/openchart-core';
import {
  isChartSpec,
  isGraphSpec,
  isLayerSpec,
  isSankeySpec,
  isTableSpec,
  resolveMarkDef,
  resolveMarkType,
} from '@opendata-ai/openchart-core';
import type { NormalizedSankeySpec } from '../sankey/types';
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
    title: normalizeChromeField(chrome.title),
    subtitle: normalizeChromeField(chrome.subtitle),
    source: normalizeChromeField(chrome.source),
    byline: normalizeChromeField(chrome.byline),
    footer: normalizeChromeField(chrome.footer),
  };
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

/** Sample values from a data column and infer the field type. */
function inferFieldType(data: DataRow[], field: string): FieldType {
  // Sample up to 10 rows
  const sampleSize = Math.min(10, data.length);
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

  for (const channel of ['x', 'y', 'color', 'size', 'detail'] as const) {
    const spec = result[channel];
    if (!spec) continue;

    // Skip conditional value definitions - they don't have field/type at the top level
    if ('condition' in spec) continue;

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
function normalizeAnnotations(annotations: Annotation[] | undefined): Annotation[] {
  if (!annotations || annotations.length === 0) return [];

  return annotations.map((ann) => {
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
        return {
          ...ann,
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
// Spec-level normalization
// ---------------------------------------------------------------------------

function normalizeChartSpec(spec: ChartSpec, warnings: string[]): NormalizedChartSpec {
  const encoding = inferEncodingTypes(spec.encoding, spec.data, warnings);
  const markType = resolveMarkType(spec.mark);
  const markDef = resolveMarkDef(spec.mark);

  return {
    markType,
    markDef,
    data: spec.data,
    encoding,
    chrome: normalizeChrome(spec.chrome),
    annotations: normalizeAnnotations(spec.annotations),
    labels: {
      density: spec.labels?.density ?? 'auto',
      format: spec.labels?.format ?? '',
      offsets: spec.labels?.offsets,
    },
    legend: spec.legend,
    responsive: spec.responsive ?? true,
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    hiddenSeries: spec.hiddenSeries ?? [],
    seriesStyles: spec.seriesStyles ?? {},
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
    chrome: normalizeChrome(spec.chrome),
    legend: spec.legend,
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
    animation: spec.animation,
  };
}

function normalizeGraphSpec(spec: GraphSpec, _warnings: string[]): NormalizedGraphSpec {
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
    annotations: normalizeAnnotations(spec.annotations),
    theme: spec.theme ?? {},
    darkMode: spec.darkMode ?? 'off',
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
  // Should never happen after validation
  throw new Error(
    `Unknown spec shape. Expected mark (chart), layer, type: 'table', type: 'graph', or type: 'sankey'.`,
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
): ChartSpec[] {
  const resolvedData = spec.data ?? parentData;
  const resolvedEncoding: Encoding | undefined =
    parentEncoding && spec.encoding
      ? { ...parentEncoding, ...spec.encoding }
      : (spec.encoding ?? parentEncoding);
  const resolvedTransforms = [...(parentTransforms ?? []), ...(spec.transform ?? [])];

  const leaves: ChartSpec[] = [];

  for (const child of spec.layer) {
    if (isLayerSpec(child)) {
      // Nested layer: recurse with merged context
      leaves.push(...flattenLayers(child, resolvedData, resolvedEncoding, resolvedTransforms));
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
      });
    }
  }

  return leaves;
}
