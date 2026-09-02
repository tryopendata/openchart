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
  /** Stable construction order, used to stagger the entrance reveal. */
  index: number;
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
  /**
   * Node ids that never dim under a highlight/filter -- currently just the
   * graph's `seedNode`. Constant per compilation, which is why it lives here
   * and not on `FocusSnapshot` (no change to focusSnapshotsEqual /
   * emptyFocusSnapshot / deriveFocus).
   *
   * The seed is deliberately NOT unioned into the highlight set:
   * `composeStandingFocus` expands the core set to `core ∪ neighbors(core)`,
   * and a seed node is by construction a hub, so unioning it there would light
   * most of the graph and silently defeat the category filter. Exempting at the
   * dim-tier decision keeps the seed lit without lighting its neighborhood.
   *
   * Scope: every focus-driven dim -- highlight, category filter, hover, and
   * selection. The seed is an always-visible anchor, not a per-interaction
   * emphasis. Search dimming is the one exception: it runs through
   * `searchMatches` as a separate alpha multiplier and is untouched, because a
   * seed that doesn't match the query should not pretend to.
   */
  exemptIds?: Set<string>;
  /** True during active pan/zoom gestures. Renderer skips labels and glow. */
  isGesturing: boolean;
  /** Whether the OpenData watermark is enabled. */
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
  /**
   * Entrance reveal state. Present only while the entrance choreography runs.
   * `t` is a mount-level 0→1 progress; the renderer pops node scale/alpha, lags
   * edges 30%, and fades labels by it. When `stagger` is true the renderer applies
   * a per-node staggered pop (quantized for batching) using `order` (stagger rank,
   * hash-scattered) and `offsets` (convergence drift vectors); when false a
   * single global fade. Absent or `t >= 1` → render as settled.
   */
  entrance?: {
    t: number;
    stagger: boolean;
    order?: Map<string, number>;
    offsets?: Map<string, { x: number; y: number }>;
  };
  /**
   * Per-node enter-fade alphas for a data update (node id → 0..1), present only
   * while newly-added nodes are fading in. Quantized to a few buckets (mirroring
   * the entrance quantization) so canvas fill-batching survives. A node absent
   * from the map renders at full alpha. Multiplied into node/label alpha and
   * (for connected edges) edge alpha.
   */
  enterAlpha?: Map<string, number>;
  /**
   * Exit ghosts for a data update: nodes/edges removed by the update, drawn
   * FIRST/UNDER the live marks and NOT hit-tested, fading out over exit.duration.
   * Absent once the exit fade completes.
   */
  exiting?: {
    nodes: PositionedNode[];
    edges: PositionedEdge[];
    /** Global 0..1 fade for the ghosts (1 = fully visible, 0 = gone). */
    alpha: number;
  };
}
