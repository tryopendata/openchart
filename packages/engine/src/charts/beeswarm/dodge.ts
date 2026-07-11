/**
 * Deterministic sweep-line dodge for beeswarm layouts.
 *
 * Port of Observable Plot's dodge transform (anchor "middle"): dots are
 * placed in value order, each at the smallest signed cross-axis offset that
 * avoids every previously placed circle. Pure array math with stable sorts
 * and explicit tie-breaking, so the same input always produces the same
 * output: no force simulation, no iteration tuning, no animation frames.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default extra gap (px) enforced between circle edges. */
export const DEFAULT_DODGE_PADDING = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute cross-axis offsets that resolve circle collisions along a value axis.
 *
 * Dots are processed in ascending value-axis order (ties broken by input
 * index, so the layout is deterministic). For each dot, every already-placed
 * dot that overlaps it horizontally contributes a blocked interval of
 * cross-axis offsets; the dot takes the smallest-magnitude offset outside all
 * blocked intervals. Candidates are 0 and the blocked-interval edges; when a
 * positive and a negative candidate have equal magnitude, the negative side
 * wins (up in a horizontal swarm, left in a vertical one).
 *
 * When `lanes` is provided, dots dodge only against dots in the same lane
 * (one independent swarm per category).
 *
 * @param positions - Value-axis pixel positions, one per dot.
 * @param radii - Per-dot radii in pixels, parallel to `positions`.
 * @param lanes - Optional lane key per dot; dots in different lanes never collide.
 * @param padding - Extra pixel gap between circle edges. Defaults to 1.
 * @returns Signed cross-axis pixel offsets (centered on 0), parallel to `positions`.
 */
export function dodgeOffsets(
  positions: readonly number[],
  radii: readonly number[],
  lanes?: readonly string[],
  padding: number = DEFAULT_DODGE_PADDING,
): number[] {
  const n = positions.length;
  const offsets = new Array<number>(n).fill(0);

  // Group indices by lane (single implicit lane when none provided)
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const lane = lanes?.[i] ?? '__default__';
    const group = groups.get(lane);
    if (group) {
      group.push(i);
    } else {
      groups.set(lane, [i]);
    }
  }

  for (const group of groups.values()) {
    dodgeLane(group, positions, radii, padding, offsets);
  }

  return offsets;
}

// ---------------------------------------------------------------------------
// Per-lane sweep
// ---------------------------------------------------------------------------

/**
 * Place one lane's dots, writing results into the shared offsets array.
 *
 * The backward scan's early `break` (line ~101) keeps this near-linear when
 * value positions are spread out: once the horizontal gap to an earlier dot
 * exceeds any possible collision distance, no earlier dot can collide either.
 * The degenerate case is many dots sharing one identical value position — the
 * gap stays 0, the break never fires, and the scan touches every placed dot,
 * so a lane of N coincident points is O(N^2). The overplotting guard caps the
 * swarm at ~2000 points, which bounds the worst case; real data spreads out
 * enough that this stays linear in practice.
 */
function dodgeLane(
  indices: number[],
  positions: readonly number[],
  radii: readonly number[],
  padding: number,
  offsets: number[],
): void {
  // Sweep order: ascending value position, ties broken by input index so the
  // sort (and therefore the layout) is fully deterministic.
  const order = [...indices].sort((a, b) => positions[a] - positions[b] || a - b);

  // Already-placed dots in sweep order. Because placement follows ascending
  // positions, the backward scan below can stop as soon as the horizontal gap
  // exceeds the largest possible collision distance.
  const placed: number[] = [];
  let maxPlacedRadius = 0;

  for (const i of order) {
    const p = positions[i];
    const r = radii[i];

    // Blocked cross-axis intervals from placed dots that overlap horizontally.
    const intervals: Array<[number, number]> = [];
    for (let k = placed.length - 1; k >= 0; k--) {
      const j = placed[k];
      const dx = p - positions[j];
      if (dx > r + maxPlacedRadius + padding) break; // no earlier dot can reach
      const sep = r + radii[j] + padding;
      if (dx * dx >= sep * sep) continue;
      const dy = Math.sqrt(sep * sep - dx * dx);
      intervals.push([offsets[j] - dy, offsets[j] + dy]);
    }

    offsets[i] = minimalFreeOffset(intervals);
    placed.push(i);
    if (r > maxPlacedRadius) maxPlacedRadius = r;
  }
}

/**
 * Smallest-magnitude offset outside all blocked open intervals.
 *
 * The feasible set is the complement of a union of open intervals, so the
 * minimal-|offset| point is either 0 or an interval edge. Candidates sort by
 * (|value|, value): equal magnitudes resolve to the negative side.
 */
function minimalFreeOffset(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;

  const candidates: number[] = [0];
  for (const [lo, hi] of intervals) {
    candidates.push(lo, hi);
  }
  candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);

  for (const candidate of candidates) {
    let blocked = false;
    for (const [lo, hi] of intervals) {
      if (candidate > lo && candidate < hi) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return candidate;
  }

  // Unreachable: interval edges are never strictly inside their own interval,
  // so at least one candidate is always free. Kept for type safety.
  return 0;
}
