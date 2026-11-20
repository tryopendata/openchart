/**
 * Stagger strategies: how far apart entering elements start.
 *
 * Every renderer's per-index delay formula lives here so the CSS, canvas and
 * export paths share one copy.
 */

/** Maximum total stagger time in ms. Keeps the whole sweep inside one beat. */
export const MAX_TOTAL_STAGGER_MS = 450;

/**
 * Gap between consecutive entering elements: the authored delay is a ceiling,
 * and the whole spread never exceeds MAX_TOTAL_STAGGER_MS, so
 * `gap = min(delay, 450 / (n - 1))`. Five bars at the default 80ms land 80ms
 * apart (the cap allows 112.5); forty land 450/39 ms apart. A delay of 0 stays 0, and one element
 * has no gap.
 */
export function clampStaggerDelay(delay: number, elementCount: number): number {
  if (elementCount <= 1 || !(delay > 0)) return 0;
  return Math.min(delay, MAX_TOTAL_STAGGER_MS / (elementCount - 1));
}

/** Spread of grid-cell (heatmap, waffle, calendar) start times, in ms. */
export const CELL_SWEEP_BUDGET_MS = 600;

/**
 * Start times for `count` elements spread evenly over `budgetMs`, then
 * shuffled with a seeded Fisher-Yates so they fill in no visible pattern.
 * The same seed always gives the same order.
 */
export function shuffledSweepDelays(count: number, budgetMs: number, seed: number): number[] {
  throw new Error(`not implemented: shuffledSweepDelays(${count}, ${budgetMs}, ${seed})`);
}

/** Map point stagger fallback used by the CSS when the renderer stamps none. */
export const MAP_POINT_STAGGER_FALLBACK_MS = 60;

/** Cap on a single map feature's fill animation, in ms. */
export const MAP_FEATURE_MAX_DURATION_MS = 500;

/**
 * Spread of map feature start times, in ms. A constant (the old 1.2x budget at
 * a 450ms enter), so a longer enter duration doesn't add waiting to maps.
 */
export const MAP_SWEEP_BUDGET_MS = 540;

/** The duration the map renderer stamps as `--oc-animation-duration`. */
export function mapFeatureDuration(durationMs: number): number {
  return Math.min(durationMs, MAP_FEATURE_MAX_DURATION_MS);
}

export interface MapSweepTiming {
  /** Per-feature animation duration (`min(duration, 500)`). */
  featureDurationMs: number;
  /** Total spread of feature start times (MAP_SWEEP_BUDGET_MS, 0 in bulk mode). */
  budgetMs: number;
  /** Gap between consecutive shuffled feature slots (`budget / (n - 1)`). */
  staggerMs: number;
}

/**
 * Map feature sweep: features start at evenly spaced (then shuffled) slots
 * across a constant budget. Bulk mode fades the whole group at once, so it
 * has no budget.
 */
export function mapSweepTiming(
  durationMs: number,
  featureCount: number,
  bulk: boolean,
): MapSweepTiming {
  const featureDurationMs = mapFeatureDuration(durationMs);
  const budgetMs = bulk ? 0 : MAP_SWEEP_BUDGET_MS;
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
