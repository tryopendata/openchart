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
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { max, min } from 'd3-array';
import { scaleLinear, scaleOrdinal, scaleSqrt } from 'd3-scale';

import type { CompiledGraphEdge, CompiledGraphNode } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NODE_RADIUS = 5;
const MIN_NODE_RADIUS = 3;
const MAX_NODE_RADIUS = 20;

const DEFAULT_EDGE_WIDTH = 1;
const MIN_EDGE_WIDTH = 0.5;
const MAX_EDGE_WIDTH = 4;

const DEFAULT_STROKE_WIDTH = 1;

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
): CompiledGraphNode[] {
  const degrees = computeDegrees(nodes, edges);
  const maxDegree = Math.max(1, ...degrees.values());

  // Build node size scale
  let sizeScale: ((v: number) => number) | undefined;
  if (encoding.nodeSize?.field) {
    const field = encoding.nodeSize.field;
    const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));

    const sizeMin = min(values) ?? 0;
    const sizeMax = max(values) ?? 1;

    sizeScale = scaleSqrt().domain([sizeMin, sizeMax]).range([MIN_NODE_RADIUS, MAX_NODE_RADIUS]);
  }

  // Build node color scale
  let colorFn: ((node: GraphNode) => string) | undefined;
  if (encoding.nodeColor?.field) {
    const field = encoding.nodeColor.field;
    const fieldType = encoding.nodeColor.type ?? 'nominal';

    if (fieldType === 'quantitative') {
      const values = nodes.map((n) => Number(n[field])).filter((v) => Number.isFinite(v));
      const colorMin = min(values) ?? 0;
      const colorMax = max(values) ?? 1;

      // Use first sequential palette
      const seqPalettes = Object.values(theme.colors.sequential);
      const palette = seqPalettes.length > 0 ? seqPalettes[0] : ['#ccc', '#333'];
      const colorScale = scaleLinear<string>()
        .domain([colorMin, colorMax])
        .range([palette[0], palette[palette.length - 1]]);

      colorFn = (node: GraphNode) => {
        const val = Number(node[field]);
        return Number.isFinite(val) ? colorScale(val) : theme.colors.categorical[0];
      };
    } else {
      // nominal/ordinal
      const uniqueValues = [...new Set(nodes.map((n) => String(n[field] ?? '')))];
      const ordinalScale = scaleOrdinal<string>()
        .domain(uniqueValues)
        .range(theme.colors.categorical);

      colorFn = (node: GraphNode) => ordinalScale(String(node[field] ?? ''));
    }
  }

  const defaultColor = theme.colors.categorical[0];

  return nodes.map((node) => {
    // Radius
    let radius = DEFAULT_NODE_RADIUS;
    if (sizeScale && encoding.nodeSize?.field) {
      const val = Number(node[encoding.nodeSize.field]);
      if (Number.isFinite(val)) {
        radius = sizeScale(val);
      }
    }

    // Color
    const fill = colorFn ? colorFn(node) : defaultColor;

    // Stroke: darken fill by 20%
    const stroke = darkenColor(fill);

    // Label
    let label: string | undefined;
    if (encoding.nodeLabel?.field) {
      const labelVal = node[encoding.nodeLabel.field];
      label = labelVal != null ? String(labelVal) : undefined;
    } else {
      label = node.id;
    }

    // Label priority: degree / maxDegree (0 to 1)
    const degree = degrees.get(node.id) ?? 0;
    const labelPriority = maxDegree > 0 ? degree / maxDegree : 0;

    // Data: spread all original node fields
    const { id: _id, ...rest } = node;
    const data: Record<string, unknown> = { id: node.id, ...rest };

    return {
      id: node.id,
      radius,
      fill,
      stroke,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      label,
      labelPriority,
      community: undefined,
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

    if (fieldType === 'quantitative') {
      const values = edges.map((e) => Number(e[field])).filter((v) => Number.isFinite(v));
      const colorMin = min(values) ?? 0;
      const colorMax = max(values) ?? 1;

      const seqPalettes = Object.values(theme.colors.sequential);
      const palette = seqPalettes.length > 0 ? seqPalettes[0] : ['#ccc', '#333'];
      const colorScale = scaleLinear<string>()
        .domain([colorMin, colorMax])
        .range([palette[0], palette[palette.length - 1]]);

      edgeColorFn = (edge: GraphEdge) => {
        const val = Number(edge[field]);
        return Number.isFinite(val) ? colorScale(val) : hexWithOpacity(theme.colors.axis, 0.4);
      };
    } else {
      const uniqueValues = [...new Set(edges.map((e) => String(e[field] ?? '')))];
      const ordinalScale = scaleOrdinal<string>()
        .domain(uniqueValues)
        .range(theme.colors.categorical);

      edgeColorFn = (edge: GraphEdge) => ordinalScale(String(edge[field] ?? ''));
    }
  }

  const defaultEdgeColor = hexWithOpacity(theme.colors.axis, 0.4);

  return edges.map((edge) => {
    const { source, target, ...rest } = edge;

    let strokeWidth = DEFAULT_EDGE_WIDTH;
    if (widthScale && encoding.edgeWidth?.field) {
      const val = Number(edge[encoding.edgeWidth.field]);
      if (Number.isFinite(val)) {
        strokeWidth = widthScale(val);
      }
    }

    const stroke = edgeColorFn ? edgeColorFn(edge) : defaultEdgeColor;

    return {
      source,
      target,
      stroke,
      strokeWidth,
      style: 'solid' as const,
      data: { source, target, ...rest } as Record<string, unknown>,
    };
  });
}
