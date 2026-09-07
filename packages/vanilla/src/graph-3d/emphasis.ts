/**
 * Emphasis composition for the 3D renderer: turns the focus model into a
 * per-node and per-edge target opacity.
 *
 * The composition rules are NOT re-derived here. `composeStandingFocus` and
 * `layerHoverFocus` from `../graph/focus-transition` are the single source of
 * truth for "highlight ∩ search, hover on top" and are reused verbatim; this
 * module only maps the resulting {@link FocusSnapshot} onto opacity numbers,
 * mirroring the tier rules the 2D canvas renderer applies
 * (`graph/canvas-renderer.ts` `nodeTier` / `edgeTier` / `*TierAlpha`).
 *
 * The one 3D-specific input is `edgeBaseAlpha`: above `LINK_WIDTH_MAX_EDGES`
 * the renderer draws plain lines and maps `edgeWidth` to a resting alpha
 * instead of a cylinder radius, so the resting tier is per-edge rather than a
 * single constant.
 *
 * Pure: no three.js, no DOM.
 */

import type { FocusSnapshot } from '../graph/focus-transition';

/** Resting edge alpha when nothing is emphasized (matches the 2D light tier). */
export const EDGE_ALPHA_DEFAULT = 0.3;
/** Edge alpha when both endpoints are in the connected set. */
export const EDGE_ALPHA_CONNECTED = 1;
/** Multiplier applied to nodes/edges outside an active search. */
export const SEARCH_NON_MATCH_ALPHA = 0.25;

/** Minimal node shape the composition needs. */
export interface EmphasisNode {
  id: string;
  /** Compiled `nodeOpacity` encoding value; multiplies into the result. */
  opacity: number;
}

/** Minimal edge shape the composition needs. Index is the link object key. */
export interface EmphasisEdge {
  source: string;
  target: string;
}

export interface EmphasisInput {
  nodes: EmphasisNode[];
  edges: EmphasisEdge[];
  /** The composed focus snapshot (standing state with the hover layer on top). */
  focus: FocusSnapshot;
  /** Ids that never dim (the spec's `seedNode`). */
  exemptIds: Set<string>;
  /** Resolved `interaction.hover.dimOpacity`. */
  dimOpacity: number;
  /** Per-edge resting alpha keyed by edge index; defaults to EDGE_ALPHA_DEFAULT. */
  edgeBaseAlpha?: Map<number, number>;
}

export interface EmphasisTargets {
  /** Target material opacity by node id. */
  nodes: Map<string, number>;
  /** Target material opacity by edge index. */
  edges: Map<number, number>;
}

/**
 * Compose the focus snapshot into target opacities.
 *
 * Node rule (mirrors `nodeTier` + `nodeTierAlpha`): nothing active → 1; an
 * exempt id → 1; in the connected set → 1; otherwise `dimOpacity`. An active
 * search multiplies non-matching nodes by {@link SEARCH_NON_MATCH_ALPHA}, and
 * exemption deliberately does NOT apply to search (a seed that doesn't match
 * the query should not pretend to). The compiled `nodeOpacity` multiplies last.
 *
 * Edge rule (mirrors `edgeTier` + `edgeTierAlpha`): nothing active → the edge's
 * resting alpha; both endpoints connected → 1; otherwise `dimOpacity / 3`,
 * which preserves the node-to-edge dim ratio that keeps dense hairballs quiet.
 * Edges are NOT exempted by `exemptIds`: the seed stays lit while its edges dim
 * with everything else.
 */
export function resolveEmphasis(input: EmphasisInput): EmphasisTargets {
  const { focus, exemptIds, dimOpacity, edgeBaseAlpha } = input;
  const search = focus.searchMatches;

  const nodes = new Map<string, number>();
  for (const n of input.nodes) {
    let alpha = 1;
    if (focus.hasActive && !exemptIds.has(n.id) && !focus.connected.has(n.id)) {
      alpha = dimOpacity;
    }
    if (search !== null && !search.has(n.id)) alpha *= SEARCH_NON_MATCH_ALPHA;
    nodes.set(n.id, alpha * n.opacity);
  }

  const edges = new Map<number, number>();
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    const resting = edgeBaseAlpha?.get(i) ?? EDGE_ALPHA_DEFAULT;
    let alpha: number;
    if (!focus.hasActive) {
      alpha = resting;
    } else if (focus.connected.has(e.source) && focus.connected.has(e.target)) {
      alpha = EDGE_ALPHA_CONNECTED;
    } else {
      alpha = dimOpacity / 3;
    }
    if (search !== null && !search.has(e.source) && !search.has(e.target)) {
      alpha *= SEARCH_NON_MATCH_ALPHA;
    }
    edges.set(i, alpha);
  }

  return { nodes, edges };
}
