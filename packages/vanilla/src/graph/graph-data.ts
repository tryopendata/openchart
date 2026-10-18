/** Lookup tables and simulation inputs derived from a graph compilation. */

import type {
  CompiledGraphEdge,
  CompiledGraphNode,
  GraphCompilation,
} from '@opendata-ai/openchart-engine';
import type { PositionedEdge } from './types';
import type { SimEdge, SimNode } from './worker-protocol';

export interface GraphDataMaps {
  /** Node id → raw node datum. */
  nodeData: Map<string, Record<string, unknown>>;
  /** Edge id ("source->target") → raw edge datum. */
  edgeData: Map<string, Record<string, unknown>>;
  /**
   * Node id → its legend-field category value, for category hover/highlight.
   * Empty when the graph has no categorical color field.
   */
  nodeCategory: Map<string, string>;
}

export function buildGraphDataMaps(compilation: GraphCompilation): GraphDataMaps {
  const nodeData = new Map(compilation.nodes.map((n) => [n.id, n.data ?? {}]));
  const edgeData = new Map(
    compilation.edges.map((e) => [`${e.source}->${e.target}`, e.data ?? {}]),
  );

  const nodeCategory = new Map<string, string>();
  const field = compilation.legendField;
  if (field) {
    for (const n of compilation.nodes) {
      const v = n.data?.[field];
      if (v != null) nodeCategory.set(n.id, String(v));
    }
  }
  return { nodeData, edgeData, nodeCategory };
}

export function buildAdjacencyMap(edges: CompiledGraphEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, new Set());
    if (!map.has(edge.target)) map.set(edge.target, new Set());
    map.get(edge.source)!.add(edge.target);
    map.get(edge.target)!.add(edge.source);
  }
  return map;
}

export function toSimNodes(nodes: CompiledGraphNode[]): SimNode[] {
  return nodes.map((n) => ({
    id: n.id,
    radius: n.radius,
    community: n.community,
  }));
}

export function toSimEdges(edges: CompiledGraphEdge[]): SimEdge[] {
  return edges.map((e) => ({
    source: e.source,
    target: e.target,
  }));
}

/**
 * Point-to-line-segment distance for edge hit testing.
 * Returns the shortest distance from point (px, py) to the segment (ax, ay)-(bx, by).
 */
function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Find the edge closest to a graph-space point, within a threshold.
 * Returns an edge key "source->target" or null.
 */
export function hitTestEdge(
  edges: PositionedEdge[],
  graphX: number,
  graphY: number,
  threshold: number,
): string | null {
  let bestDist = threshold;
  let bestEdgeId: string | null = null;

  for (const edge of edges) {
    const dist = pointToSegmentDist(
      graphX,
      graphY,
      edge.sourceX,
      edge.sourceY,
      edge.targetX,
      edge.targetY,
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestEdgeId = `${edge.source}->${edge.target}`;
    }
  }

  return bestEdgeId;
}
