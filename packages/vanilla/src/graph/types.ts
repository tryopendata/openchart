/**
 * Shared types for the graph adapter.
 *
 * These extend the engine's compiled types with positional information set by
 * the force simulation at runtime. The engine produces CompiledGraphNode/Edge
 * objects with visual properties but no x/y coords. After simulation, we get
 * PositionedNode/Edge that the canvas renderer can draw.
 */

import type { ResolvedTheme } from '@opendata-ai/core';
import type { CompiledGraphEdge, CompiledGraphNode } from '@opendata-ai/engine';

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
  selectedNodeIds: Set<string>;
  adjacencyMap: Map<string, Set<string>>;
  theme: ResolvedTheme;
  searchMatches: Set<string> | null;
  /** True during active pan/zoom gestures. Renderer skips labels and glow. */
  isGesturing: boolean;
}
