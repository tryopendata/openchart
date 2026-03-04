/**
 * SimulationManager: spawns a Web Worker for the force simulation,
 * or falls back to synchronous d3-force on the main thread.
 *
 * Synchronous fallback is used when:
 * - Web Workers are unavailable (SSR, test environments)
 * - Node count is below 200 (worker overhead not worth it)
 *
 * The sync path caps at 300 ticks to prevent blocking the main thread.
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

import type { SimEdge, SimNode, WorkerOutMessage, WorkerSimulationConfig } from './worker-protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_THRESHOLD = 200;
const SYNC_MAX_TICKS = 300;

// ---------------------------------------------------------------------------
// Internal node shape for sync simulation
// ---------------------------------------------------------------------------

interface SyncNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  community?: string;
  fx?: number | null;
  fy?: number | null;
}

// ---------------------------------------------------------------------------
// Cluster force (duplicated in simulation-worker.ts for the Web Worker path.
// Worker can't import from workspace packages, so both copies must stay in sync.)
// ---------------------------------------------------------------------------

function forceCluster(nodes: SyncNode[], strength: number) {
  return (alpha: number) => {
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

    for (const [c, n] of count) {
      cx.set(c, cx.get(c)! / n);
      cy.set(c, cy.get(c)! / n);
    }

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
// SimulationManager
// ---------------------------------------------------------------------------

type TickCallback = (positions: Array<{ id: string; x: number; y: number }>, alpha: number) => void;

type SettledCallback = () => void;

export class SimulationManager {
  private worker: Worker | null = null;
  private syncSim: Simulation<SyncNode, undefined> | null = null;
  private syncNodes: SyncNode[] = [];
  private syncNodeMap: Map<string, SyncNode> = new Map();
  private tickCb: TickCallback | null = null;
  private settledCb: SettledCallback | null = null;
  private destroyed = false;

  // Stored for worker->sync fallback
  private initNodes: SimNode[] = [];
  private initEdges: SimEdge[] = [];
  private initConfig: WorkerSimulationConfig | null = null;

  private constructor() {}

  /**
   * Create a SimulationManager. Uses Web Worker for large graphs,
   * synchronous fallback for small graphs or when Worker unavailable.
   */
  static create(
    nodes: SimNode[],
    edges: SimEdge[],
    config: WorkerSimulationConfig,
  ): SimulationManager {
    const mgr = new SimulationManager();

    const useWorker = typeof Worker !== 'undefined' && nodes.length >= SYNC_THRESHOLD;

    if (useWorker) {
      mgr.initWorker(nodes, edges, config);
    } else {
      mgr.initSync(nodes, edges, config);
    }

    return mgr;
  }

  /** Register a callback for position updates. */
  onTick(cb: TickCallback): void {
    this.tickCb = cb;
  }

  /** Register a callback for when the simulation has settled. */
  onSettled(cb: SettledCallback): void {
    this.settledCb = cb;
  }

  /** Reheat the simulation. */
  reheat(alpha?: number): void {
    if (this.destroyed) return;

    if (this.worker) {
      this.worker.postMessage({ type: 'reheat', alpha });
    } else if (this.syncSim) {
      this.syncSim.alpha(alpha ?? 0.3).restart();
      this.runSyncTicks();
    }
  }

  /** Pin a node to fixed x/y coordinates. */
  pinNode(id: string, x: number, y: number): void {
    if (this.destroyed) return;

    if (this.worker) {
      this.worker.postMessage({ type: 'pin', nodeId: id, x, y });
    } else {
      const node = this.syncNodeMap.get(id);
      if (node) {
        node.fx = x;
        node.fy = y;
      }
    }
  }

  /** Unpin a node (free it from fixed position). */
  unpinNode(id: string): void {
    if (this.destroyed) return;

    if (this.worker) {
      this.worker.postMessage({ type: 'unpin', nodeId: id });
    } else {
      const node = this.syncNodeMap.get(id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
  }

  /** Drag a node (pins it and reheats slightly). */
  dragNode(id: string, x: number, y: number): void {
    if (this.destroyed) return;

    if (this.worker) {
      this.worker.postMessage({ type: 'drag', nodeId: id, x, y });
    } else {
      const node = this.syncNodeMap.get(id);
      if (node) {
        node.fx = x;
        node.fy = y;
      }
      if (this.syncSim && this.syncSim.alpha() < 0.1) {
        this.syncSim.alpha(0.1).restart();
        this.runSyncTicks();
      }
    }
  }

  /** Tear down the simulation and release resources. */
  destroy(): void {
    this.destroyed = true;

    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }

    if (this.syncSim) {
      this.syncSim.stop();
      this.syncSim = null;
    }

    this.tickCb = null;
    this.settledCb = null;
  }

  // -------------------------------------------------------------------------
  // Worker path
  // -------------------------------------------------------------------------

  private initWorker(nodes: SimNode[], edges: SimEdge[], config: WorkerSimulationConfig): void {
    // Store for fallback if worker fails to load
    this.initNodes = nodes;
    this.initEdges = edges;
    this.initConfig = config;

    try {
      const workerUrl = new URL('./simulation-worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
    } catch {
      // Worker construction failed (e.g. SSR or restrictive CSP)
      console.warn('[SimulationManager] Worker creation failed, using sync fallback');
      this.initSync(nodes, edges, config);
      return;
    }

    this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      if (this.destroyed) return;
      const msg = event.data;

      switch (msg.type) {
        case 'positions':
          this.tickCb?.(msg.nodes, msg.alpha);
          break;
        case 'settled':
          this.settledCb?.();
          break;
        case 'error':
          console.error('[SimulationManager] Worker error:', msg.message);
          break;
      }
    };

    this.worker.onerror = () => {
      // Worker failed to load (e.g. MIME type error in dev, missing file).
      // Terminate and fall back to synchronous simulation.
      if (this.destroyed) return;
      console.warn('[SimulationManager] Worker failed to load, falling back to sync');
      this.worker?.terminate();
      this.worker = null;
      this.initSync(this.initNodes, this.initEdges, this.initConfig!);
    };

    this.worker.postMessage({ type: 'init', nodes, edges, config });
  }

  // -------------------------------------------------------------------------
  // Synchronous fallback
  // -------------------------------------------------------------------------

  private initSync(nodes: SimNode[], edges: SimEdge[], config: WorkerSimulationConfig): void {
    this.syncNodes = nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      radius: n.radius,
      community: n.community,
    }));

    this.syncNodeMap = new Map(this.syncNodes.map((n) => [n.id, n]));

    const linkForce = forceLink(edges.map((e) => ({ ...e })))
      .id((d) => (d as SyncNode).id)
      .distance(config.linkDistance);
    if (config.linkStrength != null) {
      linkForce.strength(config.linkStrength);
    }

    const padding = config.collisionPadding ?? 2;

    this.syncSim = forceSimulation<SyncNode>(this.syncNodes)
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(config.chargeStrength))
      .force(
        'collide',
        forceCollide<SyncNode>().radius((d) => d.radius + padding),
      )
      // Weak gravity keeps disconnected nodes from drifting far from center
      .force('gravityX', forceX<SyncNode>(0).strength(0.05))
      .force('gravityY', forceY<SyncNode>(0).strength(0.05))
      .alphaDecay(config.alphaDecay)
      .velocityDecay(config.velocityDecay)
      .stop(); // Don't auto-run; we tick manually

    // Center force (default true)
    if (config.centerForce !== false) {
      this.syncSim.force('center', forceCenter(0, 0));
    }

    // Add clustering force if configured
    if (config.clustering) {
      const clusterFn = forceCluster(this.syncNodes, config.clustering.strength);
      // d3 calls force functions with (alpha) on each tick
      this.syncSim.force('cluster', clusterFn as unknown as ReturnType<typeof forceCenter>);
    }

    // Defer initial delivery: callbacks aren't wired yet at create() time
    this.runSyncTicks(true);
  }

  /**
   * Run ticks synchronously and fire callbacks.
   * @param deferred - When true, deliver results via microtask. Used for the
   *   initial run where callbacks haven't been registered yet. Subsequent
   *   calls (reheat, drag) fire synchronously since callbacks are already set.
   */
  private runSyncTicks(deferred = false): void {
    if (!this.syncSim || this.destroyed) return;

    const sim = this.syncSim;
    for (let i = 0; i < SYNC_MAX_TICKS; i++) {
      sim.tick();
      if (sim.alpha() < 0.001) break;
    }

    const positions = this.syncNodes.map((n) => ({
      id: n.id,
      x: n.x ?? 0,
      y: n.y ?? 0,
    }));
    const alpha = sim.alpha();
    const settled = alpha < 0.001;

    const deliver = () => {
      if (this.destroyed) return;
      this.tickCb?.(positions, alpha);
      if (settled) {
        this.settledCb?.();
      }
    };

    if (deferred) {
      // Initial run: callbacks not registered yet, defer to microtask
      queueMicrotask(deliver);
    } else {
      deliver();
    }
  }
}
