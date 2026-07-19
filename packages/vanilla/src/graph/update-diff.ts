/**
 * Data-update diff for the graph mount's unified `update()`.
 *
 * Given the previously positioned nodes/edges and a freshly compiled graph,
 * classify the change into:
 * - `visualOnly`: same node AND edge id sets AND equal simulationConfig. The
 *   mount can re-run the position-preserving visual refresh with no sim restart.
 *   NOTE: unlike the old React JSON-diff heuristic (which only compared
 *   `clustering.field`), visual-only here requires the FULL resolved
 *   simulationConfig to match — a physics change (charge/settle/energy/etc.)
 *   must reheat, not silently skip.
 * - Otherwise a structural update: which nodes enter, where they spawn, which
 *   survive (and keep their prior x/y), and which nodes/edges exit (ghosts).
 *
 * Spawn placement: an entering node spawns at its first surviving neighbor's
 * NEW-adjacency position, nudged by a deterministic ±8px hash jitter (so a node
 * doesn't land exactly on its neighbor). A node with no surviving neighbor falls
 * back to a seeded disc position (same hash family as seed.ts).
 */

import { hash32 } from './seed';
import type { PositionedEdge, PositionedNode } from './types';
import type { SimulationConfigLike } from './update-diff-config';
import { simulationConfigEqual } from './update-diff-config';

/** Minimal position record kept for survivors and computed for spawns. */
export interface XY {
  x: number;
  y: number;
}

/** A freshly compiled graph, reduced to what the diff needs. */
export interface NextGraph {
  nodes: Array<{ id: string; community?: string }>;
  edges: Array<{ source: string; target: string }>;
  simulationConfig: SimulationConfigLike;
}

export interface GraphUpdateDiff {
  /** True when node+edge id sets are identical AND simulationConfig is equal. */
  visualOnly: boolean;
  /** Ids of nodes present in `next` but not in prev. */
  enteringIds: string[];
  /** Prior x/y for nodes present in BOTH prev and next, keyed by id. */
  survivingPositions: Map<string, XY>;
  /** Computed spawn x/y for entering nodes, keyed by id. */
  spawnPositions: Map<string, XY>;
  /** Prev-positioned nodes removed in `next` (ghosts). */
  exitingNodes: PositionedNode[];
  /** Prev-positioned edges removed in `next` (ghosts). */
  exitingEdges: PositionedEdge[];
  /**
   * Count of edges present in `next` but not in prev — including edges added
   * between two surviving nodes, which "touches an entering node" would miss.
   */
  enteringEdgeCount: number;
}

/** ±8px deterministic jitter from an id+seed hash (two independent streams). */
const JITTER = 8;

function jitter(id: string, seed: number): XY {
  // Map two hash streams to [-1, 1) then scale, so a spawn doesn't land exactly
  // on its neighbor. Deterministic in (id, seed).
  const jx = (hash32(`${id}|${seed}|jx`) / 0x100000000) * 2 - 1;
  const jy = (hash32(`${id}|${seed}|jy`) / 0x100000000) * 2 - 1;
  return { x: jx * JITTER, y: jy * JITTER };
}

/**
 * Seeded disc fallback for a node with no surviving neighbor. Mirrors seed.ts's
 * disc placement (r = R0·√u1, θ = u2·2π) so orphan spawns land in the same cloud.
 */
const FALLBACK_R0 = 300;

function seededDisc(id: string, seed: number): XY {
  const u1 = hash32(`${id}|${seed}|r`) / 0x100000000;
  const u2 = hash32(`${id}|${seed}|t`) / 0x100000000;
  const r = FALLBACK_R0 * Math.sqrt(u1);
  const theta = u2 * Math.PI * 2;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/**
 * Diff the previous positioned graph against a freshly compiled `next`.
 *
 * @param prevNodes - Previously positioned nodes (carry x/y).
 * @param prevEdges - Previously positioned edges.
 * @param next - The freshly compiled graph (nodes/edges/simulationConfig).
 * @param prevConfig - The prior simulationConfig, for visual-only detection.
 * @param seed - Layout seed for deterministic jitter/fallback placement.
 */
export function diffGraphUpdate(
  prevNodes: PositionedNode[],
  prevEdges: PositionedEdge[],
  next: NextGraph,
  prevConfig: SimulationConfigLike,
  seed: number,
): GraphUpdateDiff {
  const prevIds = new Set(prevNodes.map((n) => n.id));
  const nextIds = new Set(next.nodes.map((n) => n.id));

  const survivingPositions = new Map<string, XY>();
  const enteringIds: string[] = [];

  for (const n of prevNodes) {
    if (nextIds.has(n.id)) survivingPositions.set(n.id, { x: n.x, y: n.y });
  }
  for (const n of next.nodes) {
    if (!prevIds.has(n.id)) enteringIds.push(n.id);
  }

  // Exiting marks: prev nodes/edges gone from next. An edge exits when its
  // (source,target) key is absent from the next edge set — this catches BOTH
  // edges whose endpoint was removed AND edges removed between two survivors.
  const exitingNodes = prevNodes.filter((n) => !nextIds.has(n.id));
  const nextEdgeKeys = new Set(next.edges.map((e) => `${e.source} ${e.target}`));
  const exitingEdges = prevEdges.filter((e) => !nextEdgeKeys.has(`${e.source} ${e.target}`));
  const prevEdgeCounts = new Map<string, number>();
  for (const e of prevEdges) {
    const k = `${e.source} ${e.target}`;
    prevEdgeCounts.set(k, (prevEdgeCounts.get(k) ?? 0) + 1);
  }
  let enteringEdgeCount = 0;
  const remainingPrev = new Map(prevEdgeCounts);
  for (const e of next.edges) {
    const k = `${e.source} ${e.target}`;
    const c = remainingPrev.get(k);
    if (c && c > 0) {
      remainingPrev.set(k, c - 1);
    } else {
      enteringEdgeCount++;
    }
  }

  // Visual-only: identical node AND edge id sets AND equal simulationConfig.
  const sameNodes = prevIds.size === nextIds.size && enteringIds.length === 0;
  const sameEdges = edgeSetsEqual(prevEdges, next.edges);
  const visualOnly =
    sameNodes && sameEdges && simulationConfigEqual(prevConfig, next.simulationConfig);

  // Spawn placement for enterers: first surviving neighbor in the NEW adjacency,
  // plus ±8px jitter; fallback to a seeded disc when no surviving neighbor.
  const spawnPositions = new Map<string, XY>();
  if (enteringIds.length > 0) {
    const enteringSet = new Set(enteringIds);
    const nextAdjacency = buildAdjacency(next.edges);
    for (const id of enteringIds) {
      const neighborPos = firstSurvivingNeighborPos(
        id,
        nextAdjacency,
        survivingPositions,
        enteringSet,
      );
      const j = jitter(id, seed);
      if (neighborPos) {
        spawnPositions.set(id, { x: neighborPos.x + j.x, y: neighborPos.y + j.y });
      } else {
        const disc = seededDisc(id, seed);
        spawnPositions.set(id, { x: disc.x + j.x, y: disc.y + j.y });
      }
    }
  }

  return {
    visualOnly,
    enteringIds,
    survivingPositions,
    spawnPositions,
    exitingNodes,
    exitingEdges,
    enteringEdgeCount,
  };
}

/** Build an undirected adjacency map from an edge list. */
function buildAdjacency(edges: Array<{ source: string; target: string }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const push = (a: string, b: string) => {
    const list = map.get(a);
    if (list) list.push(b);
    else map.set(a, [b]);
  };
  for (const e of edges) {
    push(e.source, e.target);
    push(e.target, e.source);
  }
  return map;
}

/**
 * First neighbor of `id` (in the new adjacency) that already has a known
 * position — i.e. a survivor, not another enterer. Deterministic: neighbors are
 * scanned in edge-declaration order.
 */
function firstSurvivingNeighborPos(
  id: string,
  adjacency: Map<string, string[]>,
  survivingPositions: Map<string, XY>,
  enteringSet: Set<string>,
): XY | null {
  const neighbors = adjacency.get(id);
  if (!neighbors) return null;
  for (const nid of neighbors) {
    if (enteringSet.has(nid)) continue;
    const pos = survivingPositions.get(nid);
    if (pos) return pos;
  }
  return null;
}

/**
 * Order-insensitive multiset equality of two edge lists by (source,target) key.
 * Counts matter: prev [A→B, A→B, C→D] vs next [A→B, C→D, C→D] is a structural
 * change, not visual-only.
 */
function edgeSetsEqual(
  prev: Array<{ source: string; target: string }>,
  next: Array<{ source: string; target: string }>,
): boolean {
  if (prev.length !== next.length) return false;
  const key = (e: { source: string; target: string }) => `${e.source}->${e.target}`;
  const counts = new Map<string, number>();
  for (const e of prev) {
    const k = key(e);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const e of next) {
    const k = key(e);
    const c = counts.get(k);
    if (!c) return false;
    counts.set(k, c - 1);
  }
  return true;
}
