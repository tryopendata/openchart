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
