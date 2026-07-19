/**
 * Entrance choreography math for the graph reveal.
 *
 * The mount drives a single 0→1 `entranceProgress`; this module turns it into a
 * per-node reveal alpha with a staggered start. The per-node alpha is quantized
 * to a small number of levels so the canvas renderer can still batch fills by
 * (color, alpha) — an unquantized stagger would force one fill() per node.
 *
 * Above ENTRANCE_STAGGER_MAX_NODES the mount uses a single global fade (no
 * per-node stagger) because thousands of distinct start times defeat batching
 * and read as noise anyway.
 */

/**
 * Per-node reveal progress at global progress `globalT`.
 *
 * Node `index` starts revealing at `(index/total)·0.4` and ramps over the next
 * `0.6` of the timeline, so the first node is fully in at t=0.6 and the last at
 * t=1.0. The result is quantized to `buckets` (≤8) levels to preserve batching.
 */
export function nodeEnterProgress(
  globalT: number,
  index: number,
  total: number,
  buckets = 8,
): number {
  const g = globalT <= 0 ? 0 : globalT >= 1 ? 1 : globalT;
  const start = total > 0 ? (index / total) * 0.4 : 0;
  const local = (g - start) / 0.6;
  const clamped = local <= 0 ? 0 : local >= 1 ? 1 : local;
  // Quantize to `buckets` levels (0, 1/b, ..., 1) so fills stay batchable.
  const b = Math.max(1, Math.floor(buckets));
  return Math.round(clamped * b) / b;
}

/**
 * Above this node count the entrance uses a single global fade with no per-node
 * stagger — thousands of start times kill batching and read as noise.
 */
export const ENTRANCE_STAGGER_MAX_NODES = 3000;

// ---------------------------------------------------------------------------
// Organic pop: order, scale curve, and convergence drift
// ---------------------------------------------------------------------------

/** How far (px, graph space) a node starts from its final spot during the pop. */
export const ENTRANCE_DRIFT_PX = 16;

/**
 * Stagger rank for each node: distance from the layout centroid, ascending, so
 * the reveal ripples outward from the center of the graph. Index-order stagger
 * reads as arbitrary shimmer; centroid-radial order reads as structure. Warmup
 * means positions are near-final when this runs, so the ranking is stable.
 */
export function entranceOrder(
  nodes: Array<{ id: string; x: number; y: number }>,
): Map<string, number> {
  const rank = new Map<string, number>();
  if (nodes.length === 0) return rank;
  let cx = 0;
  let cy = 0;
  for (const n of nodes) {
    cx += n.x;
    cy += n.y;
  }
  cx /= nodes.length;
  cy /= nodes.length;
  const sorted = [...nodes].sort((a, b) => {
    const da = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy);
    const db = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy);
    return da - db;
  });
  for (let i = 0; i < sorted.length; i++) rank.set(sorted[i].id, i);
  return rank;
}

/**
 * Per-node drift offset: a unit vector pointing away from the layout centroid,
 * scaled to ENTRANCE_DRIFT_PX. Nodes pop in slightly outside their final spot
 * and converge inward — the whole graph reads as breathing in. Deterministic
 * (pure function of positions), zero-safe at the centroid.
 */
export function entranceOffsets(
  nodes: Array<{ id: string; x: number; y: number }>,
  dist: number = ENTRANCE_DRIFT_PX,
): Map<string, { x: number; y: number }> {
  const offsets = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return offsets;
  let cx = 0;
  let cy = 0;
  for (const n of nodes) {
    cx += n.x;
    cy += n.y;
  }
  cx /= nodes.length;
  cy /= nodes.length;
  for (const n of nodes) {
    const dx = n.x - cx;
    const dy = n.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) {
      offsets.set(n.id, { x: 0, y: -dist });
    } else {
      offsets.set(n.id, { x: (dx / len) * dist, y: (dy / len) * dist });
    }
  }
  return offsets;
}

/**
 * Pop scale curve: 0 at t=0, overshoots to ~1.1 around t≈0.7, settles at 1.
 * Standard back-out easing applied to scale, so nodes pop rather than fade.
 */
export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/**
 * Pop alpha curve: reaches full opacity by 60% of the node's window so the
 * overshoot phase of the scale pop is fully visible, not half-faded.
 */
export function popAlpha(t: number): number {
  const a = t / 0.6;
  return a >= 1 ? 1 : a <= 0 ? 0 : a;
}

/**
 * Drift factor: 1 at t=0 (full offset from final position) easing quadratically
 * to 0 (node at rest). Multiplied into the per-node entrance offset.
 */
export function driftFactor(t: number): number {
  const u = 1 - (t <= 0 ? 0 : t >= 1 ? 1 : t);
  return u * u;
}
