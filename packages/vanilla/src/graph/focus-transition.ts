/**
 * Per-frame focus model for the graph: unifies the three emphasis sources
 * (programmatic highlight, search matches, hover-neighborhood) into a single
 * snapshot pair that the renderer crossfades between.
 *
 * Composition, not strict precedence (see plan §5a):
 * - Standing state = highlight ∩ search when both active; if that intersection
 *   is empty, search matches win (fresher user intent). This preserves the
 *   "filter by topic, then search within it" workflow.
 * - Hover-neighborhood is the transient top layer over whatever the standing
 *   state is.
 *
 * The transition tweens between two discrete FocusSnapshots. Rapid hover sweeps
 * retarget mid-flight: `retarget(next, now)` snapshots the endpoint CLOSEST to
 * the current display (`prev = p < 0.5 ? old prev : old next`), so a low-p
 * retarget keeps the old prev — no forward snap, worst-case visual jump halved
 * vs. a naive "always start from current next" rule. Exact per-edge capture
 * would destroy the renderer's tier batching, so this discrete approximation is
 * deliberate.
 */

/** The set of emphasis relationships in effect for one steady state. */
export interface FocusSnapshot {
  /** True when any emphasis source is active (something is dimmed). */
  hasActive: boolean;
  /** Nodes connected to the active/hovered set (includes the active nodes). */
  connected: Set<string>;
  /** Search matches, or null when search is inactive. */
  searchMatches: Set<string> | null;
  /** Selected nodes (selection rings; always emphasized). */
  selected: Set<string>;
}

/** An empty (nothing emphasized) snapshot. */
export function emptyFocusSnapshot(): FocusSnapshot {
  return { hasActive: false, connected: new Set(), searchMatches: null, selected: new Set() };
}

/** Whether two snapshots describe the same emphasis state (skip re-tween). */
export function focusSnapshotsEqual(a: FocusSnapshot, b: FocusSnapshot): boolean {
  return (
    a.hasActive === b.hasActive &&
    setsEqual(a.connected, b.connected) &&
    nullableSetsEqual(a.searchMatches, b.searchMatches) &&
    setsEqual(a.selected, b.selected)
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function nullableSetsEqual(a: Set<string> | null, b: Set<string> | null): boolean {
  if (a === null || b === null) return a === b;
  return setsEqual(a, b);
}

/**
 * A crossfade between two focus snapshots, eased over `duration` ms.
 *
 * Time is injected (`now` passed to `retarget`/`progress`) so the mount's
 * scheduler drives it deterministically and tests use a controllable clock.
 */
export class FocusTransition {
  prev: FocusSnapshot;
  next: FocusSnapshot;
  private startTime: number;
  private duration: number;
  private ease: (t: number) => number;

  constructor(initial: FocusSnapshot, duration: number, ease: (t: number) => number, now: number) {
    this.prev = initial;
    this.next = initial;
    this.startTime = now;
    this.duration = Math.max(0, duration);
    this.ease = ease;
  }

  /**
   * Point a fresh transition at `target`, capturing the endpoint closest to the
   * current display as the new `prev` (the `p < 0.5` rule). A no-op when
   * `target` already equals `next`.
   */
  retarget(target: FocusSnapshot, now: number): void {
    if (focusSnapshotsEqual(target, this.next)) return;
    const p = this.rawProgress(now);
    // Below the midpoint the display is still nearer the old prev; keep it to
    // avoid a forward snap. At/after the midpoint the old next is nearer.
    this.prev = p < 0.5 ? this.prev : this.next;
    this.next = target;
    this.startTime = now;
  }

  /** Raw (un-eased) 0..1 progress. */
  private rawProgress(now: number): number {
    if (this.duration <= 0) return 1;
    return Math.min(1, Math.max(0, (now - this.startTime) / this.duration));
  }

  /** Eased 0..1 progress toward `next`. */
  progress(now: number): number {
    return this.ease(this.rawProgress(now));
  }

  /** True once the transition has fully settled onto `next`. */
  isSettled(now: number): boolean {
    return this.rawProgress(now) >= 1;
  }
}

/**
 * Build the standing (non-hover) focus snapshot from highlight + search sets.
 *
 * Composition rule: emphasized = highlight ∩ search when both non-empty; if the
 * intersection is empty, search wins. Selection is always carried through.
 */
export function composeStandingFocus(
  highlight: Set<string> | null,
  searchMatches: Set<string> | null,
  selected: Set<string>,
  adjacency: Map<string, Set<string>>,
): FocusSnapshot {
  const hasHighlight = highlight !== null && highlight.size > 0;
  const hasSearch = searchMatches !== null && searchMatches.size > 0;

  // Determine the emphasized "core" set that drives connected-neighborhood dim.
  let core: Set<string> | null = null;
  if (highlight !== null && hasHighlight && searchMatches !== null && hasSearch) {
    const inter = intersect(highlight, searchMatches);
    core = inter.size > 0 ? inter : searchMatches;
  } else if (hasHighlight) {
    core = highlight;
  } else if (hasSearch) {
    // Search dims via searchMatches directly (renderer's search path), not the
    // connected-neighborhood path — leave core null so hover still works.
    core = null;
  }

  const connected = new Set<string>();
  if (core) {
    for (const id of core) {
      connected.add(id);
      const neighbors = adjacency.get(id);
      if (neighbors) for (const nid of neighbors) connected.add(nid);
    }
  }

  const hasActive = (core !== null && core.size > 0) || hasSearch || selected.size > 0;

  return {
    hasActive,
    connected,
    searchMatches: hasSearch ? searchMatches : null,
    selected,
  };
}

/**
 * Layer a hover neighborhood on top of a standing snapshot. The hovered node
 * and its neighbors become the connected set; the standing search/selection
 * carry through so search dimming and selection rings persist under hover.
 */
export function layerHoverFocus(
  standing: FocusSnapshot,
  hoveredId: string | null,
  hoverConnected: Set<string> | null,
): FocusSnapshot {
  if (hoveredId === null || hoverConnected === null) return standing;
  return {
    hasActive: true,
    connected: hoverConnected,
    searchMatches: standing.searchMatches,
    selected: standing.selected,
  };
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const out = new Set<string>();
  for (const v of small) if (large.has(v)) out.add(v);
  return out;
}
