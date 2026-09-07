/**
 * Entrance choreography timing for the 3D renderer.
 *
 * Pure scheduling math: which node starts revealing when, and how far along its
 * own pop a node is at a given wall-clock offset. The mount owns the tween, the
 * materials and the camera; this module owns nothing but numbers, so the
 * stagger can be tested without a WebGL scene.
 *
 * The stagger rank comes from 2D's `entranceOrder` (a deterministic hash
 * shuffle of the node ids), so a spec reveals in the same order in both
 * dimensions. 2D's companion `entranceOffsets` deliberately does NOT port:
 * three-forcegraph writes each node group's position from its datum on every
 * engine tick, so a convergence drift we wrote into `group.position` would be
 * clobbered before it was ever painted. 3D pops in scale and opacity only.
 */

import { entranceOrder } from '../graph/entrance';

/**
 * How much of `enter.duration` the stagger spreads start times across. The last
 * node therefore begins at `0.5 · duration` and finishes at `1.5 · duration`.
 * Wider reads as a slow drip on a hundred-node graph; narrower stops reading as
 * a stagger at all.
 */
export const ENTRANCE_STAGGER_FRACTION = 0.5;

/**
 * How long after the later of its two endpoints a link starts fading in, as a
 * fraction of `enter.duration`. An edge that arrives with its endpoints reads
 * as a mesh snapping into place; a beat later reads as the structure being
 * drawn on.
 */
export const LINK_ENTRANCE_DELAY = 0.25;

/** The camera's starting standoff, as a multiple of the fit distance. */
export const ENTRANCE_CAMERA_PULLBACK = 1.6;

/** Start times for every node and link, plus the total wall time they span. */
export interface EntrancePlan {
  /** ms from entrance start at which each node begins its pop. */
  nodeOffset: Map<string, number>;
  /** ms from entrance start at which each link begins its fade, by edge index. */
  linkOffset: Map<number, number>;
  /** Total choreography length: `duration + max(offset)`. */
  span: number;
}

/**
 * Plan the reveal.
 *
 * With `stagger` off every offset is 0 and the whole graph fades as one, which
 * is also what happens above `ENTRANCE_STAGGER_MAX_NODES` (the caller applies
 * that gate, mirroring 2D).
 */
export function planEntrance(
  nodes: Array<{ id: string; x: number; y: number }>,
  edges: Array<{ source: string; target: string }>,
  duration: number,
  stagger: boolean,
): EntrancePlan {
  const nodeOffset = new Map<string, number>();
  const linkOffset = new Map<number, number>();

  if (!stagger || nodes.length === 0) {
    for (const n of nodes) nodeOffset.set(n.id, 0);
    for (let i = 0; i < edges.length; i++) linkOffset.set(i, duration * LINK_ENTRANCE_DELAY);
    return { nodeOffset, linkOffset, span: duration * (1 + LINK_ENTRANCE_DELAY) };
  }

  const rank = entranceOrder(nodes);
  const last = Math.max(1, nodes.length - 1);
  const spread = duration * ENTRANCE_STAGGER_FRACTION;
  let maxOffset = 0;
  for (const n of nodes) {
    const offset = ((rank.get(n.id) ?? 0) / last) * spread;
    nodeOffset.set(n.id, offset);
    if (offset > maxOffset) maxOffset = offset;
  }

  // A link waits for the later of its endpoints, then a beat.
  const delay = duration * LINK_ENTRANCE_DELAY;
  for (let i = 0; i < edges.length; i++) {
    const a = nodeOffset.get(edges[i].source) ?? 0;
    const b = nodeOffset.get(edges[i].target) ?? 0;
    const offset = Math.max(a, b) + delay;
    linkOffset.set(i, offset);
    if (offset > maxOffset) maxOffset = offset;
  }

  return { nodeOffset, linkOffset, span: duration + maxOffset };
}

/**
 * A single element's eased progress through its own window at `elapsed` ms.
 *
 * Returns 0 before the element's start and 1 once its `duration` has run, so a
 * caller can read every element from one global clock.
 */
export function elementProgress(
  elapsed: number,
  offset: number,
  duration: number,
  ease: (t: number) => number,
): number {
  if (duration <= 0) return elapsed >= offset ? 1 : 0;
  const local = (elapsed - offset) / duration;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  return ease(local);
}
