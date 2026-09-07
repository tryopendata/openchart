/**
 * Force wiring for the 3D simulation.
 *
 * 3d-force-graph owns a d3-force-3d simulation on the main thread; we do not
 * drive it and we do not port the 2D web worker here. This module maps the
 * engine's `SimulationConfig` onto that simulation's knobs and supplies the one
 * force d3-force-3d does not ship: the community cluster force, which is a
 * 3-axis port of `forceCluster` in `../graph/simulation.ts`. Both copies must
 * stay in sync.
 */

import type { SimulationConfig } from '@opendata-ai/openchart-engine';
import { forceCollide } from 'd3-force-3d';
import type { Graph3D, Node3D } from './types';

/** d3's default `alphaMin`, the alpha at which a simulation stops. */
const DEFAULT_ALPHA_MIN = 0.001;
/** Ceiling on the derived cooldown tick count (guards a tiny alphaDecay). */
const MAX_COOLDOWN_TICKS = 800;
/** Collision solver iterations; 1 is d3's cheap default and enough at our scale. */
const COLLIDE_ITERATIONS = 1;

/**
 * Measured cost of one simulation tick, per node, in ms (charge + link +
 * collide + cluster on a 3,000-node graph). Used to convert the engine's
 * wall-clock warmup budget into a tick count.
 */
const WARMUP_MS_PER_NODE_TICK = 0.0035;

/** Never warm up for fewer ticks than this; below it the first frame explodes. */
const MIN_WARMUP_TICKS = 5;

/** Fallback budget when the compilation does not carry one. */
const DEFAULT_WARMUP_BUDGET_MS = 250;

/**
 * Warmup ticks that fit the wall-clock budget.
 *
 * The library runs `warmupTicks` synchronously inside its first digest, so the
 * engine's default of 100 blocks the main thread for ~3s on a 3,000-node graph.
 * 2D solves this with `warmupBudgetMs` inside its own tick loop; here the loop
 * belongs to the library, so the budget has to be converted to a tick count up
 * front from the measured per-node cost.
 */
export function budgetedWarmupTicks(
  requested: number,
  nodeCount: number,
  budgetMs = DEFAULT_WARMUP_BUDGET_MS,
): number {
  if (requested <= 0 || nodeCount <= 0) return Math.max(0, requested);
  const perTickMs = Math.max(WARMUP_MS_PER_NODE_TICK * nodeCount, 0.05);
  const affordable = Math.floor(budgetMs / perTickMs);
  return Math.max(MIN_WARMUP_TICKS, Math.min(requested, affordable));
}

/**
 * Ticks needed to cool from alpha 1 to `alphaMin` at a given `alphaDecay`.
 * Deliberately duplicated from `graph/simulation.ts` `ticksToAlphaMin` rather
 * than imported: that module pulls in the whole 2D d3-force graph, which would
 * land in the `graph-3d` bundle for four lines of arithmetic.
 */
export function ticksToSettle(alphaDecay: number, alphaMin = DEFAULT_ALPHA_MIN): number {
  if (!(alphaDecay > 0) || alphaDecay >= 1) return MAX_COOLDOWN_TICKS;
  const n = Math.ceil(Math.log(alphaMin) / Math.log(1 - alphaDecay));
  return Math.min(MAX_COOLDOWN_TICKS, Math.max(1, n));
}

/**
 * A community cluster force in three axes: each node is pulled toward the
 * centroid of its own community, scaled by `strength * alpha`. Port of
 * `forceCluster` in `../graph/simulation.ts` with the z axis added.
 *
 * Uses d3's `initialize` hook rather than closing over a node array, so the
 * force keeps working after `graphData()` swaps the node objects.
 */
export function forceCluster3D(strength: number): (alpha: number) => void {
  let nodes: Node3D[] = [];

  const force = (alpha: number): void => {
    const cx = new Map<string, number>();
    const cy = new Map<string, number>();
    const cz = new Map<string, number>();
    const count = new Map<string, number>();

    for (const node of nodes) {
      const c = node.node?.community;
      if (!c) continue;
      cx.set(c, (cx.get(c) ?? 0) + (node.x ?? 0));
      cy.set(c, (cy.get(c) ?? 0) + (node.y ?? 0));
      cz.set(c, (cz.get(c) ?? 0) + (node.z ?? 0));
      count.set(c, (count.get(c) ?? 0) + 1);
    }

    for (const [c, n] of count) {
      cx.set(c, cx.get(c)! / n);
      cy.set(c, cy.get(c)! / n);
      cz.set(c, cz.get(c)! / n);
    }

    const k = strength * alpha;
    for (const node of nodes) {
      const c = node.node?.community;
      if (!c) continue;
      node.vx = (node.vx ?? 0) + (cx.get(c)! - (node.x ?? 0)) * k;
      node.vy = (node.vy ?? 0) + (cy.get(c)! - (node.y ?? 0)) * k;
      node.vz = (node.vz ?? 0) + (cz.get(c)! - (node.z ?? 0)) * k;
    }
  };

  force.initialize = (ns: Node3D[]): void => {
    nodes = ns;
  };

  return force;
}

/**
 * Apply the compiled `SimulationConfig` to a 3d-force-graph instance.
 *
 * `cooldownTicks` is derived from `alphaDecay` so live ticking is bounded: the
 * simulation runs on the main thread here, and an unbounded cooldown keeps a
 * 3000-node graph re-rendering forever. `warmupTicks` gets the same treatment
 * through {@link budgetedWarmupTicks}, since the library runs them all in one
 * synchronous block.
 */
export function applySimulationConfig(
  graph: Graph3D,
  config: SimulationConfig,
  nodeCount: number,
): void {
  const charge = graph.d3Force('charge');
  if (charge && typeof (charge as { strength?: unknown }).strength === 'function') {
    (charge as unknown as { strength(v: number): unknown }).strength(config.chargeStrength);
  }

  const link = graph.d3Force('link');
  if (link) {
    const l = link as unknown as {
      distance?(v: number): unknown;
      strength?(v: number): unknown;
    };
    l.distance?.(config.linkDistance);
    if (config.linkStrength !== undefined) l.strength?.(config.linkStrength);
  }

  const padding = config.collisionPadding ?? 2;
  graph.d3Force(
    'collide',
    forceCollide<Node3D>((n) => (n.node?.radius ?? 1) + padding).iterations(COLLIDE_ITERATIONS),
  );

  graph.d3Force('cluster', config.clustering ? forceCluster3D(config.clustering.strength) : null);

  // 3d-force-graph installs a `center` force of its own, so honouring
  // `centerForce: false` means removing it rather than declining to add it.
  if (config.centerForce === false) graph.d3Force('center', null);

  graph.d3VelocityDecay(config.velocityDecay);
  graph.d3AlphaDecay(config.alphaDecay);
  graph.warmupTicks(budgetedWarmupTicks(config.warmupTicks ?? 0, nodeCount, config.warmupBudgetMs));
  graph.cooldownTicks(ticksToSettle(config.alphaDecay));
}
