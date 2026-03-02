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
 *
 * The companion simulation-worker-url.ts provides createSimulationWorker()
 * which uses `new URL('./simulation-worker.ts', import.meta.url)` for Vite dev,
 * while production consumers load the pre-built dist/simulation-worker.js.
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
}

type InMessage =
  | { type: 'init'; nodes: SimNode[]; edges: SimEdge[]; config: SimConfig }
  | { type: 'reheat'; alpha?: number }
  | { type: 'pin'; nodeId: string; x: number; y: number }
  | { type: 'unpin'; nodeId: string }
  | { type: 'drag'; nodeId: string; x: number; y: number }
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
// Worker entry point
// ---------------------------------------------------------------------------

const ctx = self;
let simulation: Simulation<InternalNode, undefined> | null = null;
let nodeMap: Map<string, InternalNode> = new Map();

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

        simulation = forceSimulation<InternalNode>(internalNodes)
          .force(
            'link',
            forceLink(msg.edges.map((e) => ({ ...e })))
              .id((d) => (d as InternalNode).id)
              .distance(config.linkDistance),
          )
          .force('charge', forceManyBody().strength(config.chargeStrength))
          .force('center', forceCenter(0, 0))
          .force(
            'collide',
            forceCollide<InternalNode>().radius((d) => d.radius + 1),
          )
          // Weak gravity keeps disconnected nodes from drifting far from center
          .force('gravityX', forceX<InternalNode>(0).strength(0.05))
          .force('gravityY', forceY<InternalNode>(0).strength(0.05))
          .alphaDecay(config.alphaDecay)
          .velocityDecay(config.velocityDecay);

        // Add clustering force if configured
        if (config.clustering) {
          const clusterFn = forceCluster(internalNodes, config.clustering.strength);
          // d3 calls force functions with (alpha) on each tick
          simulation.force('cluster', clusterFn as unknown as ReturnType<typeof forceCenter>);
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
        break;
      }

      case 'unpin': {
        const node = nodeMap.get(msg.nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
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
