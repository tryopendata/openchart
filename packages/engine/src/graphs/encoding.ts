/**
 * Graph encoding resolution.
 *
 * Maps graph encoding channels (nodeSize, nodeColor, edgeWidth, edgeColor,
 * nodeLabel) to computed visual properties on nodes and edges. Uses d3 scales
 * the same way scatter/bubble charts do: scaleSqrt for size, scaleOrdinal
 * for categorical color, scaleLinear for quantitative color.
 */

import type {
  GraphEdge,
  GraphEncoding,
  GraphNode,
  NodeOverride,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { cssTokenDefault, isOpaqueColor } from '@opendata-ai/openchart-core';
import { max, min } from 'd3-array';
import { interpolateRgb } from 'd3-interpolate';
import { scaleLinear, scaleOrdinal, scaleSqrt } from 'd3-scale';

import type { CompiledGraphEdge, CompiledGraphNode } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NODE_RADIUS = 5;
const MIN_NODE_RADIUS = 3;
const MAX_NODE_RADIUS = 12;

const DEFAULT_EDGE_WIDTH = 1;
const MIN_EDGE_WIDTH = 0.5;
const MAX_EDGE_WIDTH = 4;

/** Knockout ring width. Wide enough to separate two touching nodes. */
const DEFAULT_STROKE_WIDTH = 1.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Darken a hex color by a percentage.
 *
 * Doesn't use d3-color (engine doesn't depend on it). Operates directly
 * on hex RGB channels. Falls back to the original color on parse failure.
 */
export function darkenColor(hex: string, amount: number = 0.2): string {
  // Strip # prefix
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6 && clean.length !== 3) return hex;

  // Expand shorthand
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  const r = Math.max(0, Math.round(parseInt(full.substring(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(full.substring(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(full.substring(4, 6), 16) * (1 - amount)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Apply opacity to a hex color, returning an rgba string.
 */
function hexWithOpacity(hex: string, opacity: number): string {
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6 && clean.length !== 3) {
    // Non-hex input: return as-is with opacity via CSS
    return hex;
  }

  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Compute the degree of each node (number of edges touching it).
 */
function computeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of nodes) {
    degrees.set(node.id, 0);
  }
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

/** Sort spec for a categorical encoding channel. */
type CategoricalSort = 'ascending' | 'descending' | null | string[] | undefined;

/**
 * Resolve the ordered domain for a categorical encoding channel.
 *
 * Graph channels default to `'ascending'` (VL-aligned, deterministic). An
 * explicit `scale.domain` always wins; otherwise `sort` orders the unique
 * values: `'ascending'`/`'descending'` sort lexically, `string[]` pins an
 * explicit order (values not in the list append in first-seen order), and
 * `null` keeps first-seen (data) order.
 */
export function resolveCategoricalDomain(
  values: string[],
  sort: CategoricalSort,
  scaleDomain?: unknown[],
): string[] {
  if (Array.isArray(scaleDomain) && scaleDomain.length > 0) {
    return scaleDomain.map((v) => String(v));
  }

  const seen: string[] = [];
  const set = new Set<string>();
  for (const v of values) {
    if (!set.has(v)) {
      set.add(v);
      seen.push(v);
    }
  }

  if (sort === null) return seen;

  if (Array.isArray(sort)) {
    const pinned = sort.filter((v) => set.has(v));
    const pinnedSet = new Set(pinned);
    const rest = seen.filter((v) => !pinnedSet.has(v));
    return [...pinned, ...rest];
  }

  const sorted = [...seen].sort((a, b) => a.localeCompare(b));
  return sort === 'descending' ? sorted.reverse() : sorted;
}

/**
 * The opaque canvas a graph is painted on.
 *
 * Node rings are drawn in this color (a knockout ring), so overlapping nodes
 * stay countable instead of merging into one blob. A transparent theme
 * background has no color of its own, so fall back to the static `--oc-bg`
 * token for the mode -- the same value `graph-mount` stamps on the wrapper, so
 * the ring always matches the surface it is cut out of.
 */
export function resolveGraphSurface(theme: ResolvedTheme): string {
  const bg = theme.colors.background;
  if (isOpaqueColor(bg)) return bg;
  return cssTokenDefault('--oc-bg', theme.isDark ? 'dark' : 'light');
}

// ---------------------------------------------------------------------------
// Node visual resolution
// ---------------------------------------------------------------------------

/**
 * Resolve visual properties for all graph nodes.
 *
 * Applies nodeSize, nodeColor, and nodeLabel encoding channels from the
 * spec to produce CompiledGraphNode objects with computed fill, radius,
 * stroke, label, and label priority.
 */
export function resolveNodeVisuals(
  nodes: GraphNode[],
  encoding: GraphEncoding,
  edges: GraphEdge[],
  theme: ResolvedTheme,
  nodeOverrides?: Record<string, NodeOverride>,
): CompiledGraphNode[] {
  const degrees = computeDegrees(nodes, edges);
  const maxDegree = Math.max(1, ...degrees.values());

  // Build node size scale. Defaults to scaleSqrt (area-perceptual) over
  // [3, 12]px; scale.type 'linear' switches to a linear radius ramp, and
  // scale.domain/scale.range override the extents.
  let sizeScale: ((v: number) => number) | undefined;
  if (encoding.nodeSize?.field) {
    const field = encoding.nodeSize.field;
    const scaleConfig = encoding.nodeSize.scale;
    const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));

    const sizeMin = min(values) ?? 0;
    const sizeMax = max(values) ?? 1;

    const domain =
      scaleConfig?.domain && scaleConfig.domain.length === 2
        ? (scaleConfig.domain as [number, number])
        : [sizeMin, sizeMax];
    const range =
      scaleConfig?.range && scaleConfig.range.length >= 2
        ? [Number(scaleConfig.range[0]), Number(scaleConfig.range[1])]
        : [MIN_NODE_RADIUS, MAX_NODE_RADIUS];

    const ctor = scaleConfig?.type === 'linear' ? scaleLinear : scaleSqrt;
    sizeScale = ctor().domain(domain).range(range);
  }

  // Build node color scale
  let colorFn: ((node: GraphNode) => string) | undefined;
  if (encoding.nodeColor?.field) {
    const field = encoding.nodeColor.field;
    const fieldType = encoding.nodeColor.type ?? 'nominal';
    const scaleConfig = encoding.nodeColor.scale;

    if (fieldType === 'quantitative') {
      const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));
      const colorMin = min(values) ?? 0;
      const colorMax = max(values) ?? 1;

      // Use first sequential palette
      const seqPalettes = Object.values(theme.colors.sequential);
      const palette = seqPalettes.length > 0 ? seqPalettes[0] : ['#ccc', '#333'];

      const domain =
        scaleConfig?.domain && scaleConfig.domain.length === 2
          ? (scaleConfig.domain as [number, number])
          : [colorMin, colorMax];
      const range =
        scaleConfig?.range && scaleConfig.range.length >= 2
          ? (scaleConfig.range as string[])
          : [palette[0], palette[palette.length - 1]];

      const colorScale = scaleLinear<string>().domain(domain).range(range);

      colorFn = (node: GraphNode) => {
        const val = Number(node[field]);
        return Number.isFinite(val) ? colorScale(val) : theme.colors.categorical[0];
      };
    } else {
      // nominal/ordinal: sort-resolved domain so legend + highlight agree
      const domain = resolveCategoricalDomain(
        nodes.map((n) => String(n[field] ?? '')),
        encoding.nodeColor.sort,
        scaleConfig?.domain,
      );
      const range =
        scaleConfig?.range && scaleConfig.range.length > 0
          ? (scaleConfig.range as string[])
          : theme.colors.categorical;

      const ordinalScale = scaleOrdinal<string>().domain(domain).range(range);

      colorFn = (node: GraphNode) => ordinalScale(String(node[field] ?? ''));
    }
  }

  const defaultColor = theme.colors.categorical[0];
  const surface = resolveGraphSurface(theme);

  // Build node opacity scale (VL opacity channel). Quantitative fields map
  // linearly to [0.25, 1]; scale.range overrides.
  let opacityScale: ((v: number) => number) | undefined;
  if (encoding.nodeOpacity?.field) {
    const field = encoding.nodeOpacity.field;
    const scaleConfig = encoding.nodeOpacity.scale;
    const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));
    const opMin = min(values) ?? 0;
    const opMax = max(values) ?? 1;
    const domain =
      scaleConfig?.domain && scaleConfig.domain.length === 2
        ? (scaleConfig.domain as [number, number])
        : [opMin, opMax];
    const range =
      scaleConfig?.range && scaleConfig.range.length >= 2
        ? [Number(scaleConfig.range[0]), Number(scaleConfig.range[1])]
        : [0.25, 1];
    opacityScale = scaleLinear().domain(domain).range(range);
  }

  // Build label priority scale. Maps a quantitative field to [0, 1] so
  // higher values are shown first. Falls back to degree-based priority.
  let labelPriorityScale: ((v: number) => number) | undefined;
  if (encoding.nodeLabelPriority?.field) {
    const field = encoding.nodeLabelPriority.field;
    const scaleConfig = encoding.nodeLabelPriority.scale;
    const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));
    const lpMin = min(values) ?? 0;
    const lpMax = max(values) ?? 1;
    const domain =
      scaleConfig?.domain && scaleConfig.domain.length === 2
        ? (scaleConfig.domain as [number, number])
        : [lpMin, lpMax];
    const range =
      scaleConfig?.range && scaleConfig.range.length >= 2
        ? [Number(scaleConfig.range[0]), Number(scaleConfig.range[1])]
        : [0, 1];
    labelPriorityScale = scaleLinear().domain(domain).range(range);
  }

  return nodes.map((node) => {
    // Radius
    let radius = DEFAULT_NODE_RADIUS;
    if (sizeScale && encoding.nodeSize?.field) {
      const val = Number(node[encoding.nodeSize.field]);
      if (Number.isFinite(val)) {
        radius = sizeScale(val);
      }
    }

    // Opacity
    let opacity = 1;
    if (opacityScale && encoding.nodeOpacity?.field) {
      const val = Number(node[encoding.nodeOpacity.field]);
      if (Number.isFinite(val)) {
        opacity = opacityScale(val);
      }
    }

    // Color
    const fill = colorFn ? colorFn(node) : defaultColor;

    // Stroke: a knockout ring in the canvas color, not a darkened fill. A
    // darker rim reads as a second color per node; the knockout reads as space.
    const stroke = surface;

    // Label
    let label: string | undefined;
    if (encoding.nodeLabel?.field) {
      const labelVal = node[encoding.nodeLabel.field];
      label = labelVal != null ? String(labelVal) : undefined;
    } else {
      label = node.id;
    }

    // Label priority: field-driven when nodeLabelPriority is set, else degree-based.
    let labelPriority: number;
    if (labelPriorityScale && encoding.nodeLabelPriority?.field) {
      const val = Number(node[encoding.nodeLabelPriority.field]);
      labelPriority = Number.isFinite(val) ? labelPriorityScale(val) : 0;
    } else {
      const degree = degrees.get(node.id) ?? 0;
      labelPriority = maxDegree > 0 ? degree / maxDegree : 0;
    }

    // Data: spread all original node fields
    const { id: _id, ...rest } = node;
    const data: Record<string, unknown> = { id: node.id, ...rest };

    // Apply per-node overrides if present
    const override = nodeOverrides?.[node.id];
    const finalFill = override?.fill ?? fill;
    const finalRadius = override?.radius ?? radius;
    const finalStrokeWidth = override?.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const finalStroke = override?.stroke ?? stroke;
    const finalLabelPriority = override?.alwaysShowLabel ? Infinity : labelPriority;

    return {
      id: node.id,
      radius: finalRadius,
      fill: finalFill,
      stroke: finalStroke,
      strokeWidth: finalStrokeWidth,
      label,
      labelPriority: finalLabelPriority,
      community: undefined,
      opacity,
      data,
    };
  });
}

// ---------------------------------------------------------------------------
// Edge visual resolution
// ---------------------------------------------------------------------------

/**
 * Resolve visual properties for all graph edges.
 *
 * Applies edgeWidth and edgeColor encoding channels to produce
 * CompiledGraphEdge objects with computed stroke, strokeWidth, and style.
 */
export function resolveEdgeVisuals(
  edges: GraphEdge[],
  encoding: GraphEncoding,
  theme: ResolvedTheme,
  nodeFills?: Map<string, string>,
): CompiledGraphEdge[] {
  // Edge width scale
  let widthScale: ((v: number) => number) | undefined;
  if (encoding.edgeWidth?.field) {
    const field = encoding.edgeWidth.field;
    const values = edges.map((e) => Number(e[field])).filter((v) => Number.isFinite(v));

    const widthMin = min(values) ?? 0;
    const widthMax = max(values) ?? 1;

    widthScale = scaleLinear().domain([widthMin, widthMax]).range([MIN_EDGE_WIDTH, MAX_EDGE_WIDTH]);
  }

  // Edge color scale
  let edgeColorFn: ((edge: GraphEdge) => string) | undefined;
  if (encoding.edgeColor?.field) {
    const field = encoding.edgeColor.field;
    const fieldType = encoding.edgeColor.type ?? 'nominal';
    const scaleConfig = encoding.edgeColor.scale;

    if (fieldType === 'quantitative') {
      const values = edges.map((e) => Number(e[field])).filter((v) => Number.isFinite(v));
      const colorMin = min(values) ?? 0;
      const colorMax = max(values) ?? 1;

      const seqPalettes = Object.values(theme.colors.sequential);
      const palette = seqPalettes.length > 0 ? seqPalettes[0] : ['#ccc', '#333'];

      const domain =
        scaleConfig?.domain && scaleConfig.domain.length === 2
          ? (scaleConfig.domain as [number, number])
          : [colorMin, colorMax];
      const range =
        scaleConfig?.range && scaleConfig.range.length >= 2
          ? (scaleConfig.range as string[])
          : [palette[0], palette[palette.length - 1]];

      const colorScale = scaleLinear<string>().domain(domain).range(range);

      edgeColorFn = (edge: GraphEdge) => {
        const val = Number(edge[field]);
        return Number.isFinite(val) ? colorScale(val) : hexWithOpacity(theme.colors.axis, 0.4);
      };
    } else {
      const domain = resolveCategoricalDomain(
        edges.map((e) => String(e[field] ?? '')),
        encoding.edgeColor.sort,
        scaleConfig?.domain,
      );
      const range =
        scaleConfig?.range && scaleConfig.range.length > 0
          ? (scaleConfig.range as string[])
          : theme.colors.categorical;

      const ordinalScale = scaleOrdinal<string>().domain(domain).range(range);

      edgeColorFn = (edge: GraphEdge) => ordinalScale(String(edge[field] ?? ''));
    }
  }

  const fallbackEdgeColor = hexWithOpacity(theme.colors.axis, 0.4);

  /**
   * Unencoded edges take the midpoint of their endpoints' fills, so a bundle of
   * edges leaving one community reads as that community's color instead of as a
   * gray mat. Falls back to the axis gray when either endpoint is unknown (or
   * the mix throws on a non-parseable color).
   */
  const defaultEdgeColorFor = (source: string, target: string): string => {
    if (!nodeFills) return fallbackEdgeColor;
    const a = nodeFills.get(source);
    const b = nodeFills.get(target);
    if (!a || !b) return fallbackEdgeColor;
    if (a === b) return a;
    try {
      return interpolateRgb(a, b)(0.5);
    } catch {
      return fallbackEdgeColor;
    }
  };

  // Edge style mapping (ordinal: map unique field values to solid/dashed/dotted)
  const EDGE_STYLES: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted'];
  let styleFn: ((edge: GraphEdge) => 'solid' | 'dashed' | 'dotted') | undefined;
  if (encoding.edgeStyle?.field) {
    const field = encoding.edgeStyle.field;
    const domain = resolveCategoricalDomain(
      edges.map((e) => String(e[field] ?? '')),
      encoding.edgeStyle.sort,
      encoding.edgeStyle.scale?.domain,
    );
    const styleMap = new Map<string, 'solid' | 'dashed' | 'dotted'>();
    for (let i = 0; i < domain.length; i++) {
      styleMap.set(domain[i], EDGE_STYLES[i % EDGE_STYLES.length]);
    }
    styleFn = (edge: GraphEdge) => styleMap.get(String(edge[field] ?? '')) ?? 'solid';
  }

  return edges.map((edge) => {
    const { source, target, ...rest } = edge;

    let strokeWidth = DEFAULT_EDGE_WIDTH;
    if (widthScale && encoding.edgeWidth?.field) {
      const val = Number(edge[encoding.edgeWidth.field]);
      if (Number.isFinite(val)) {
        strokeWidth = widthScale(val);
      }
    }

    const stroke = edgeColorFn
      ? edgeColorFn(edge)
      : defaultEdgeColorFor(String(source), String(target));
    const style = styleFn ? styleFn(edge) : ('solid' as const);

    return {
      source,
      target,
      stroke,
      strokeWidth,
      style,
      data: { source, target, ...rest } as Record<string, unknown>,
    };
  });
}
