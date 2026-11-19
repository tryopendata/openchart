/**
 * Stagger strategies: how far apart entering elements start.
 *
 * Every renderer's per-index delay formula lives here so the CSS, canvas and
 * export paths share one copy. Phase 0 keeps each formula's current numbers.
 */

/** Maximum total stagger time in ms. Keeps the whole sweep inside one beat. */
export const MAX_TOTAL_STAGGER_MS = 300;

/**
 * Clamp stagger delay so total stagger time doesn't exceed MAX_TOTAL_STAGGER_MS.
 * Divides by the element count (not count - 1).
 */
export function clampStaggerDelay(delay: number, elementCount: number): number {
  if (elementCount <= 1) return 0;
  return Math.min(delay, MAX_TOTAL_STAGGER_MS / elementCount);
}

/** Barlist rows start a fixed 40ms apart, uncapped. */
export const BARLIST_ROW_STAGGER_MS = 40;

/** Delay of barlist row `index` (and of its bar), in ms. */
export function barlistRowDelay(index: number): number {
  return index * BARLIST_ROW_STAGGER_MS;
}

/** Map point stagger fallback used by the CSS when the renderer stamps none. */
export const MAP_POINT_STAGGER_FALLBACK_MS = 60;

/**
 * Per-point stagger for map point marks: half the enter duration spread over
 * the points, so the total stays bounded at any count. `durationMs` is the
 * phase's enter duration (not the map's capped feature duration). Returns
 * undefined for a single point, where the renderer stamps nothing.
 */
export function mapPointStagger(durationMs: number, pointCount: number): number | undefined {
  if (pointCount <= 1) return undefined;
  return (durationMs * 0.5) / (pointCount - 1);
}

/** Cap on a single map feature's fill animation, in ms. */
export const MAP_FEATURE_MAX_DURATION_MS = 500;

/** The duration the map renderer stamps as `--oc-animation-duration`. */
export function mapFeatureDuration(durationMs: number): number {
  return Math.min(durationMs, MAP_FEATURE_MAX_DURATION_MS);
}

export interface MapSweepTiming {
  /** Per-feature animation duration (`min(duration, 500)`). */
  featureDurationMs: number;
  /** Total spread of feature start times (`round(duration * 1.2)`, 0 in bulk mode). */
  budgetMs: number;
  /** Gap between consecutive shuffled feature slots (`budget / (n - 1)`). */
  staggerMs: number;
}

/**
 * Map feature sweep: features start at evenly spaced (then shuffled) slots
 * across a budget of 1.2x the enter duration. Bulk mode fades the whole group
 * at once, so it has no budget.
 */
export function mapSweepTiming(
  durationMs: number,
  featureCount: number,
  bulk: boolean,
): MapSweepTiming {
  const featureDurationMs = mapFeatureDuration(durationMs);
  const budgetMs = bulk ? 0 : Math.round(durationMs * 1.2);
  const n = Math.max(featureCount, 1);
  const staggerMs = !bulk && n > 1 ? budgetMs / (n - 1) : 0;
  return { featureDurationMs, budgetMs, staggerMs };
}

/**
 * Tilemap tile delays: an ~800ms base spread with seeded +-40% jitter so tiles
 * pop in clusters. `animationIndices[i]` is tile i's animation index.
 */
export function tilemapTileDelays(animationIndices: readonly number[]): number[] {
  const baseStagger = 800 / Math.max(animationIndices.length, 1);
  const delays: number[] = [];
  let seed = 17;
  for (const idx of animationIndices) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const jitter = ((seed % 1000) / 1000 - 0.5) * 0.8;
    delays.push(Math.max(0, Math.round(idx * baseStagger * (1 + jitter))));
  }
  return delays;
}
