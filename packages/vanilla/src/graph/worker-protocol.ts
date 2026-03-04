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
  | { type: 'pin'; nodeId: string; x: number; y: number }
  | { type: 'unpin'; nodeId: string }
  | { type: 'drag'; nodeId: string; x: number; y: number }
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
