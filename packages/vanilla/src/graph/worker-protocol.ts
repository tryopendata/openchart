/**
 * Message protocol between the main thread and the simulation Web Worker.
 *
 * Defines the shape of messages going in both directions, plus the internal
 * node/edge types the simulation works with. These are intentionally simple
 * and independent from the engine's compiled types so the worker can be
 * built as a standalone IIFE without workspace imports.
 */

// ---------------------------------------------------------------------------
// Simulation data shapes (used internally by worker + sync fallback)
// ---------------------------------------------------------------------------

/** Minimal node shape for the force simulation. */
export interface SimNode {
  id: string;
  x?: number;
  y?: number;
  radius: number;
  community?: string;
}

/** Minimal edge shape for the force simulation. */
export interface SimEdge {
  source: string;
  target: string;
}

/** Inline simulation config (mirrors engine SimulationConfig). */
export interface WorkerSimulationConfig {
  chargeStrength: number;
  linkDistance: number;
  clustering: { field: string; strength: number } | null;
  alphaDecay: number;
  velocityDecay: number;
  collisionRadius: number;
  collisionPadding?: number;
  linkStrength?: number;
  centerForce?: boolean;
  /** Headless settle ticks run before the first painted frame. 0/undefined disables warmup. */
  warmupTicks?: number;
  /** Wall-clock budget (ms) that caps warmup at scale. Default 250. */
  warmupBudgetMs?: number;
  /** Initial alpha applied before warmup/first paint. Default d3's 1. */
  initialAlpha?: number;
  /** Cursor-repulsion radius/strength; null disables the toy force. */
  cursorRepulsion?: { radius: number; strength: number } | null;
}

// ---------------------------------------------------------------------------
// Main -> Worker messages
// ---------------------------------------------------------------------------

export type WorkerInMessage =
  | {
      type: 'init';
      nodes: SimNode[];
      edges: SimEdge[];
      config: WorkerSimulationConfig;
    }
  | { type: 'reheat'; alpha?: number }
  // `alphaTarget` is an OPTIONAL springy-drag field. A stale cached worker
  // (which has no code path reading it) ignores the unknown field and runs the
  // exact legacy pin/unpin behavior — graceful degradation for free.
  | { type: 'pin'; nodeId: string; x: number; y: number; alphaTarget?: number }
  | { type: 'unpin'; nodeId: string; alphaTarget?: number }
  | { type: 'drag'; nodeId: string; x: number; y: number }
  // Cursor-repulsion pointer feed. A brand-new message type: a stale worker
  // drops it (no case, no default) → the toy force is simply absent, which is
  // acceptable for an ambient effect.
  | { type: 'pointer'; x: number; y: number; active: boolean }
  | { type: 'stop' };

// ---------------------------------------------------------------------------
// Worker -> Main messages
// ---------------------------------------------------------------------------

export type WorkerOutMessage =
  | {
      type: 'positions';
      nodes: Array<{ id: string; x: number; y: number }>;
      alpha: number;
    }
  | { type: 'settled' }
  | { type: 'error'; message: string };
