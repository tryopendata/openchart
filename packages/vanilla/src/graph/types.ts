/**
 * Shared types for the graph adapter.
 *
 * These extend the engine's compiled types with positional information set by
 * the force simulation at runtime. The engine produces CompiledGraphNode/Edge
 * objects with visual properties but no x/y coords. After simulation, we get
 * PositionedNode/Edge that the canvas renderer can draw.
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import type { CompiledGraphEdge, CompiledGraphNode } from '@opendata-ai/openchart-engine';
import type { FocusSnapshot } from './focus-transition';

/** A compiled node with simulation-assigned x/y position. */
export interface PositionedNode extends CompiledGraphNode {
  x: number;
  y: number;
}

/** A compiled edge with resolved source/target screen positions. */
export interface PositionedEdge extends CompiledGraphEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

/**
 * Complete render state passed to the canvas renderer each frame.
 *
 * Assembled by the graph mount from simulation positions, interaction state,
 * and theme. The renderer is stateless -- it draws whatever this says.
 */
export interface GraphRenderState {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  transform: { x: number; y: number; k: number };
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  selectedNodeIds: Set<string>;
  adjacencyMap: Map<string, Set<string>>;
  theme: ResolvedTheme;
  searchMatches: Set<string> | null;
  /** True during active pan/zoom gestures. Renderer skips labels and glow. */
  isGesturing: boolean;
  /** Whether the tryOpenData.ai watermark is enabled. */
  watermark: boolean;
  /**
   * Active focus crossfade. When present and `t < 1`, the renderer blends edge
   * and node alphas between `prev` and the current (`hoveredNodeId`-derived)
   * focus state. Absent or `t >= 1` → the fast 3-bucket steady-state path.
   */
  focus?: {
    /** Eased 0..1 progress from `prev` toward the current focus state. */
    t: number;
    /** The focus snapshot being faded away from. */
    prev: FocusSnapshot;
    /** The focus snapshot being faded toward. */
    next: FocusSnapshot;
  };
  /**
   * Per-node hover radius scale (1 → 1.15), keyed by node id. Present only while
   * a hovered node's radius tween is mid-flight; routes those nodes through the
   * special-draw path. Absent → no per-node scaling.
   */
  hoverRadiusScale?: Map<string, number>;
  /** The node dim opacity tier (interaction.dimOpacity; default 0.15). */
  dimOpacity: number;
}
