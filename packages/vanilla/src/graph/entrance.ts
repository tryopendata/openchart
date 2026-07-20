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

type XYNode = { id: string; x: number; y: number };

function centroid(nodes: XYNode[]): { cx: number; cy: number } {
  let cx = 0;
  let cy = 0;
  for (const n of nodes) {
    cx += n.x;
    cy += n.y;
  }
  cx /= nodes.length;
  cy /= nodes.length;
  return { cx, cy };
}

/**
 * Deterministic hash of a node id to a well-distributed 32-bit unsigned int
 * (FNV-1a). Used to scatter entrance timing: same id → same slot every render,
 * so the reveal stays stable and testable without a spatial or index bias.
 */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Stagger rank for each node: a deterministic hash-shuffle of the node ids, so
 * each node reveals at an independent, scattered time rather than in a uniform
 * center-outward ripple. The scatter reads as many independent elements popping
 * in; a spatial (centroid-radial) or index order reads as one coordinated sweep.
 * Hashing the id keeps the order stable per render (pure function of ids), so it
 * survives re-renders and stays testable.
 */
export function entranceOrder(nodes: XYNode[]): Map<string, number> {
  const rank = new Map<string, number>();
  if (nodes.length === 0) return rank;
  const sorted = [...nodes].sort((a, b) => {
    const ha = hashId(a.id);
    const hb = hashId(b.id);
    // Tie-break on id so equal hashes (rare) still give a total, stable order.
    return ha - hb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  for (let i = 0; i < sorted.length; i++) rank.set(sorted[i].id, i);
  return rank;
}

/**
 * Per-node drift offset: a unit vector pointing away from the layout centroid,
 * scaled to ENTRANCE_DRIFT_PX. Nodes pop in slightly outside their final spot
 * and converge inward. Deterministic (pure function of positions), zero-safe
 * at the centroid.
 */
export function entranceOffsets(
  nodes: XYNode[],
  dist: number = ENTRANCE_DRIFT_PX,
): Map<string, { x: number; y: number }> {
  const offsets = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return offsets;
  const { cx, cy } = centroid(nodes);
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
