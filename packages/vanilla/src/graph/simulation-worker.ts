// DedicatedWorkerGlobalScope is available at runtime in Web Workers but
// the 'webworker' lib conflicts with 'DOM' in the main tsconfig. Declaring
// a minimal interface here avoids adding a separate tsconfig for one file.
interface WorkerSelf {
  postMessage(msg: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}
declare const self: WorkerSelf;

/**
 * Force-directed graph simulation Web Worker.
 *
 * BUNDLING: Built separately via `bun build` (see package.json "build" script)
 * into dist/simulation-worker.js as a self-contained IIFE. d3-force and all
 * its transitive deps are inlined -- no external imports in the output.
 *
 * IMPORTANT: This file cannot import from workspace packages (@opendata-ai/*).
 * All needed types are defined inline or duplicated from worker-protocol.ts.
 * The bun build step bundles this as an isolated IIFE.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';

// ---------------------------------------------------------------------------
// Inline types (duplicated from worker-protocol.ts for bundle isolation)
// ---------------------------------------------------------------------------

interface SimNode {
  id: string;
  x?: number;
  y?: number;
  radius: number;
  community?: string;
}

interface SimEdge {
  source: string;
  target: string;
}

interface SimConfig {
  chargeStrength: number;
  linkDistance: number;
  clustering: { field: string; strength: number } | null;
  alphaDecay: number;
  velocityDecay: number;
  collisionRadius: number;
  collisionPadding?: number;
  linkStrength?: number;
  centerForce?: boolean;
  warmupTicks?: number;
  warmupBudgetMs?: number;
  initialAlpha?: number;
  /** Cursor-repulsion radius/strength; null disables the toy force. */
  cursorRepulsion?: { radius: number; strength: number } | null;
}

type InMessage =
  | { type: 'init'; nodes: SimNode[]; edges: SimEdge[]; config: SimConfig }
  | { type: 'reheat'; alpha?: number }
  | { type: 'pin'; nodeId: string; x: number; y: number; alphaTarget?: number }
  | { type: 'unpin'; nodeId: string; alphaTarget?: number }
  | { type: 'drag'; nodeId: string; x: number; y: number }
  | { type: 'pointer'; x: number; y: number; active: boolean }
  | { type: 'stop' };

type OutMessage =
  | { type: 'positions'; nodes: Array<{ id: string; x: number; y: number }>; alpha: number }
  | { type: 'settled' }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Internal simulation node (extends d3 SimulationNodeDatum)
// ---------------------------------------------------------------------------

interface InternalNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  community?: string;
  fx?: number | null;
  fy?: number | null;
}

// ---------------------------------------------------------------------------
// Custom cluster force
// ---------------------------------------------------------------------------

/**
 * Pulls nodes toward the centroid of their community group.
 * Strength controls how aggressively nodes cluster (0-1, default 0.3).
 *
 * NOTE: Duplicated in simulation.ts (sync fallback path). This file can't
 * import from workspace packages since it's built as a standalone IIFE.
 * Keep both copies in sync.
 */
function forceCluster(nodes: InternalNode[], strength: number) {
  return (alpha: number) => {
    // Compute per-community centroid
    const cx = new Map<string, number>();
    const cy = new Map<string, number>();
    const count = new Map<string, number>();

    for (const node of nodes) {
      if (!node.community) continue;
      const c = node.community;
      cx.set(c, (cx.get(c) ?? 0) + (node.x ?? 0));
      cy.set(c, (cy.get(c) ?? 0) + (node.y ?? 0));
      count.set(c, (count.get(c) ?? 0) + 1);
    }

    // Normalize to get mean positions
    for (const [c, n] of count) {
      cx.set(c, cx.get(c)! / n);
      cy.set(c, cy.get(c)! / n);
    }

    // Pull each node toward its community centroid
    const k = strength * alpha;
    for (const node of nodes) {
      if (!node.community) continue;
      const targetX = cx.get(node.community)!;
      const targetY = cy.get(node.community)!;
      node.vx = (node.vx ?? 0) + (targetX - (node.x ?? 0)) * k;
      node.vy = (node.vy ?? 0) + (targetY - (node.y ?? 0)) * k;
    }
  };
}

// ---------------------------------------------------------------------------
// Cursor-repulsion force
// ---------------------------------------------------------------------------

/** Live pointer position + radius/strength, mutated by 'pointer' messages. */
interface PointerState {
  x: number;
  y: number;
  active: boolean;
  radius: number;
  strength: number;
}

/**
 * Pushes nodes within `radius` of the pointer away from it, scaled by `strength`
 * and falling off linearly to zero at the radius edge. Nodes outside the radius
 * are untouched. Inert while the pointer is inactive.
 *
 * NOTE: Duplicated in simulation.ts (sync fallback path). This file can't import
 * from workspace packages since it's built as a standalone IIFE. Keep in sync.
 */
function forceCursor(nodes: InternalNode[], pointer: PointerState) {
  return (alpha: number) => {
    if (!pointer.active || pointer.radius <= 0) return;
    const r2 = pointer.radius * pointer.radius;
    const k = pointer.strength * alpha;
    for (const node of nodes) {
      const dx = (node.x ?? 0) - pointer.x;
      const dy = (node.y ?? 0) - pointer.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= r2) continue;
      const dist = Math.sqrt(dist2) || 1e-6;
      // Linear falloff: full push at the pointer, zero at the radius edge.
      const falloff = (pointer.radius - dist) / pointer.radius;
      const push = (k * falloff) / dist;
      node.vx = (node.vx ?? 0) + dx * push;
      node.vy = (node.vy ?? 0) + dy * push;
    }
  };
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

const ctx = self;
let simulation: Simulation<InternalNode, undefined> | null = null;
let nodeMap: Map<string, InternalNode> = new Map();
/** Pointer state for the cursor force; radius=0 keeps it inert until configured. */
const pointer: PointerState = { x: 0, y: 0, active: false, radius: 0, strength: 0 };
/** Separately tracked alpha-target intents so drag and cursor don't stomp each
 * other. The higher intent wins; releasing one falls back to the other. */
let dragAlphaTarget = 0;
let cursorAlphaTarget = 0;

/** Apply the max of the tracked alpha-target intents to the live simulation. */
function syncAlphaTarget(): void {
  if (!simulation) return;
  simulation.alphaTarget(Math.max(dragAlphaTarget, cursorAlphaTarget));
}

/** Monotonic-ish clock for the warmup budget; falls back to Date.now in bare workers. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function post(msg: OutMessage): void {
  ctx.postMessage(msg);
}

function packPositions(nodes: InternalNode[]): Array<{ id: string; x: number; y: number }> {
  return nodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));
}

ctx.addEventListener('message', ((event: MessageEvent<InMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'init': {
        // Stop any existing simulation
        if (simulation) simulation.stop();

        const internalNodes: InternalNode[] = msg.nodes.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          radius: n.radius,
          community: n.community,
        }));

        nodeMap = new Map(internalNodes.map((n) => [n.id, n]));

        const { config } = msg;

        const linkForce = forceLink(msg.edges.map((e) => ({ ...e })))
          .id((d) => (d as InternalNode).id)
          .distance(config.linkDistance);
        if (config.linkStrength != null) {
          linkForce.strength(config.linkStrength);
        }

        const padding = config.collisionPadding ?? 2;

        simulation = forceSimulation<InternalNode>(internalNodes)
          .force('link', linkForce)
          .force('charge', forceManyBody().strength(config.chargeStrength))
          .force(
            'collide',
            forceCollide<InternalNode>().radius((d) => d.radius + padding),
          )
          // Weak gravity keeps disconnected nodes from drifting far from center
          .force('gravityX', forceX<InternalNode>(0).strength(0.05))
          .force('gravityY', forceY<InternalNode>(0).strength(0.05))
          .alphaDecay(config.alphaDecay)
          .velocityDecay(config.velocityDecay)
          // Build stopped so warmup can run headlessly before the first paint.
          .stop();

        // Center force (default true)
        if (config.centerForce !== false) {
          simulation.force('center', forceCenter(0, 0));
        }

        // Add clustering force if configured
        if (config.clustering) {
          const clusterFn = forceCluster(internalNodes, config.clustering.strength);
          // d3 calls force functions with (alpha) on each tick
          simulation.force('cluster', clusterFn as unknown as ReturnType<typeof forceCenter>);
        }

        // Cursor-repulsion force is always registered but stays inert until a
        // 'pointer' message activates it (pointer.active + radius > 0). Reset
        // pointer/alpha-target intent so a re-init doesn't inherit stale state.
        pointer.active = false;
        pointer.radius = config.cursorRepulsion?.radius ?? 0;
        pointer.strength = config.cursorRepulsion?.strength ?? 0;
        dragAlphaTarget = 0;
        cursorAlphaTarget = 0;
        const cursorFn = forceCursor(internalNodes, pointer);
        simulation.force('cursor', cursorFn as unknown as ReturnType<typeof forceCenter>);

        // Initial alpha (entrance / reheat impulse) applied before warmup.
        if (config.initialAlpha != null) {
          simulation.alpha(config.initialAlpha);
        }

        // Headless warmup: settle a bounded number of ticks off-screen so the
        // first painted frame isn't an explosive initial layout. Bounded by BOTH
        // a tick count AND a wall-clock budget (default 250ms) so it never blocks
        // the worker unbounded at 10k+ nodes. When the budget truncates warmup to
        // ~20 ticks at scale, that's accepted — warmup kills explosive first
        // frames, not all settling. Duplicated in simulation.ts (sync path).
        const warmupTicks = config.warmupTicks ?? 0;
        if (warmupTicks > 0) {
          const budgetMs = config.warmupBudgetMs ?? 250;
          const start = now();
          for (let i = 0; i < warmupTicks; i++) {
            simulation.tick();
            if (simulation.alpha() < simulation.alphaMin()) break;
            if (now() - start >= budgetMs) break;
          }
        }

        simulation.on('tick', () => {
          post({
            type: 'positions',
            nodes: packPositions(internalNodes),
            alpha: simulation!.alpha(),
          });
        });

        simulation.on('end', () => {
          post({ type: 'settled' });
        });

        // Post the warmed first positions, then release the simulation to run
        // (it was built stopped for warmup). restart() re-arms d3's internal
        // timer so subsequent ticks stream normally.
        post({
          type: 'positions',
          nodes: packPositions(internalNodes),
          alpha: simulation.alpha(),
        });
        simulation.restart();

        break;
      }

      case 'reheat': {
        if (!simulation) break;
        simulation.alpha(msg.alpha ?? 0.3).restart();
        break;
      }

      case 'pin': {
        const node = nodeMap.get(msg.nodeId);
        if (node) {
          node.fx = msg.x;
          node.fy = msg.y;
        }
        // Springy drag: keep the sim warm so neighbors follow the pinned node.
        // Legacy path (no alphaTarget field) leaves alpha untouched, as before.
        if (msg.alphaTarget != null && simulation) {
          dragAlphaTarget = msg.alphaTarget;
          syncAlphaTarget();
          simulation.restart();
        }
        break;
      }

      case 'unpin': {
        const node = nodeMap.get(msg.nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
        if (msg.alphaTarget != null) {
          // Springy release: cool the sim back toward the requested target
          // (typically 0). Don't run the legacy reheat — the alpha-target path
          // owns re-settling.
          dragAlphaTarget = msg.alphaTarget;
          syncAlphaTarget();
        } else if (simulation && simulation.alpha() < 0.1) {
          // LEGACY path: gentle reheat so the released node settles into
          // equilibrium without destabilizing the whole graph. Byte-identical
          // to the pre-springy behavior.
          simulation.alpha(0.1).restart();
        }
        break;
      }

      case 'pointer': {
        // No cursor force configured (radius 0) → a true no-op; don't warm the
        // sim or the toy-force alpha would keep a settled graph ticking.
        if (pointer.radius <= 0) break;
        pointer.x = msg.x;
        pointer.y = msg.y;
        pointer.active = msg.active;
        // Keep the graph subtly alive under an active cursor; clear our intent
        // when inactive. Drag intent is tracked separately so neither stomps.
        cursorAlphaTarget = msg.active ? 0.03 : 0;
        if (simulation) {
          syncAlphaTarget();
          if (msg.active) simulation.restart();
        }
        break;
      }

      case 'drag': {
        const node = nodeMap.get(msg.nodeId);
        if (node) {
          node.fx = msg.x;
          node.fy = msg.y;
        }
        // Reheat slightly for responsive dragging
        if (simulation && simulation.alpha() < 0.1) {
          simulation.alpha(0.1).restart();
        }
        break;
      }

      case 'stop': {
        if (simulation) simulation.stop();
        break;
      }
    }
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}) as EventListener);
