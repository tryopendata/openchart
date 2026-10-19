/**
 * Graph focus model (Phase 5): highlight ∩ search + hover neighborhood, eased.
 *
 * Two independent highlight layers compose into one effective set:
 *   - the STICKY category filter (empty = no filter), written only by
 *     setCategories / toggleCategory / applyInitial. Legend `active` flags
 *     track this and only this.
 *   - the TRANSIENT emphasis owned solely by highlight() / clearHighlight(),
 *     along with its custom dim opacity. The unresolved target is kept so a
 *     category-form highlight can be re-resolved against new data on update().
 * `highlightSet` is the cached composition of the two (null = nothing
 * highlighted), assigned only by recompute(). It is the cache the standing
 * snapshot reads, so arm() stays allocation-free per frame.
 */

import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import type { AnimationScheduler, Animation as GraphAnimation } from '../motion/scheduler';
import { createTween, prefersReducedMotion, resolveEase } from '../motion/tween';
import {
  composeStandingFocus,
  type FocusSnapshot,
  FocusTransition,
  layerHoverFocus,
} from './focus-transition';
import {
  categoryHighlightSet as categoryHighlightIds,
  resolveHighlightTarget as resolveHighlightTargetIds,
} from './highlight';
import type { GraphHighlightTarget, GraphRenderState } from './types';

/** Live mount state the focus model reads. Getters, because updates replace it. */
export interface GraphFocusContext {
  compilation(): GraphCompilation;
  adjacency(): Map<string, Set<string>>;
  nodeCategory(): Map<string, string>;
  searchMatches(): Set<string> | null;
  selected(): Set<string>;
  hovered(): string | null;
  scheduler: AnimationScheduler;
  /** Mark the next frame dirty (the scheduler keeps the loop running). */
  invalidate(): void;
}

export interface GraphFocusModel {
  /** The effective highlight (null = nothing highlighted). */
  readonly highlightSet: Set<string> | null;
  /** The sticky category filter (empty = no filter). */
  readonly categories: ReadonlySet<string>;
  /** Layer a transient highlight over the category filter. */
  highlight(target: GraphHighlightTarget, dimOpacity: number | undefined): void;
  clearHighlight(): void;
  setCategories(values: string[]): void;
  toggleCategory(value: string): void;
  /** Apply the compilation's resolved initialHighlight, if any. */
  applyInitial(): void;
  /**
   * Re-resolve the transient target against the current compilation and
   * recompose. Category-form targets track data changes this way; deleted ids
   * are dropped instead of resurrected.
   */
  reconcile(): void;
  /** Point the crossfade at the current target, easing unless motion is off. */
  arm(now: number): void;
  /** Drop the crossfade so the next arm() starts fresh (no stale prev/next). */
  reset(): void;
  /** Start (or cancel) the hovered node's 1 → 1.15 radius tween. */
  hoverRadius(nodeId: string | null): void;
  /** The focus fields of one frame's render state. */
  frame(now: number): Pick<GraphRenderState, 'focus' | 'hoverRadiusScale' | 'dimOpacity'>;
}

export function createGraphFocusModel(ctx: GraphFocusContext): GraphFocusModel {
  const { scheduler } = ctx;

  let highlightSet: Set<string> | null = null;
  let highlightDimOpacity: number | null = null;
  let activeCategories = new Set<string>();
  let transientHighlight: Set<string> | null = null;
  let transientTarget: GraphHighlightTarget | null = null;
  // The live focus crossfade, driving eased dimming. Rebuilt on first render.
  let focusTransition: FocusTransition | null = null;
  // Scheduler animation that keeps frames dirty while the focus crossfade runs.
  let focusAnim: GraphAnimation | null = null;
  // Hovered-node radius tween (1 → 1.15), null when settled at 1.
  let hoverRadiusTween: { nodeId: string; scale: number } | null = null;

  /** Neighborhood of the hovered node under the resolved hover mode. */
  function hoverConnectedSet(nodeId: string | null): Set<string> | null {
    if (nodeId === null) return null;
    if (ctx.compilation().interaction.hoverMode === 'category') {
      const nodeCategory = ctx.nodeCategory();
      const cat = nodeCategory.get(nodeId);
      const set = new Set<string>([nodeId]);
      if (cat !== undefined) {
        for (const [id, c] of nodeCategory) if (c === cat) set.add(id);
      }
      return set;
    }
    // 'neighbors' (default): the node plus its adjacency.
    const set = new Set<string>([nodeId]);
    const neighbors = ctx.adjacency().get(nodeId);
    if (neighbors) for (const nid of neighbors) set.add(nid);
    return set;
  }

  /** The standing (non-hover) focus from highlight + search + selection. */
  function standingSnapshot(): FocusSnapshot {
    return composeStandingFocus(highlightSet, ctx.searchMatches(), ctx.selected(), ctx.adjacency());
  }

  /** The full target snapshot = standing state with the hover layer on top. */
  function targetSnapshot(): FocusSnapshot {
    const hovered = ctx.hovered();
    return layerHoverFocus(standingSnapshot(), hovered, hoverConnectedSet(hovered));
  }

  /**
   * Point the focus crossfade at the current target and arm a scheduler
   * animation that keeps frames dirty until it settles. Snaps instantly under
   * reduced motion or when hover animation is disabled.
   */
  function arm(now: number): void {
    const target = targetSnapshot();
    const hoverCfg = ctx.compilation().animation?.hover ?? null;
    const duration = hoverCfg && !prefersReducedMotion() ? hoverCfg.duration : 0;
    const ease = resolveEase(hoverCfg?.ease ?? 'smooth');

    if (!focusTransition) {
      focusTransition = new FocusTransition(target, duration, ease, now);
      return;
    }
    focusTransition.retarget(target, now);

    // Keep the crossfade running via a scheduler animation until settled.
    if (focusAnim) scheduler.remove(focusAnim);
    focusAnim = {
      tick: (t: number): boolean => {
        const running = focusTransition !== null && !focusTransition.isSettled(t);
        if (!running) focusAnim = null;
        return running;
      },
      finish: (): void => {
        focusAnim = null;
      },
      cancel: (): void => {
        focusAnim = null;
      },
    };
    scheduler.add(focusAnim);
  }

  /** Resolve a highlight target into a concrete node id set. */
  function resolveHighlightTarget(target: GraphHighlightTarget): Set<string> {
    return resolveHighlightTargetIds(target, ctx.compilation().nodes, ctx.adjacency());
  }

  /**
   * Recompose the effective highlight from the sticky category filter and the
   * transient highlight(). THE ONLY assigner of `highlightSet`.
   *
   * Composition rule: both present → their intersection, except when the
   * intersection is empty, in which case the transient wins (a host legend
   * hovering an out-of-filter row previews that category — the built-in legend
   * only fires `onLegendHover`, so this path is host-driven). Exactly one
   * present → that one. Neither → null. Same shape as the highlight ∩ search
   * rule in composeStandingFocus.
   *
   * An EMPTY transient is not a transient: `resolveHighlightTarget` returns an
   * empty set for `{ nodeIds: [] }` or a category matching zero nodes, and
   * treating that as a layer would silently wipe the standing filter's dimming.
   */
  function recompute(): void {
    const filter = categoryHighlightIds(activeCategories, ctx.nodeCategory());
    const transient =
      transientHighlight !== null && transientHighlight.size > 0 ? transientHighlight : null;
    if (filter !== null && transient !== null) {
      const inter = new Set<string>();
      for (const id of transient) if (filter.has(id)) inter.add(id);
      highlightSet = inter.size > 0 ? inter : transient;
      return;
    }
    highlightSet = filter ?? transient;
  }

  /**
   * Re-resolve the standing transient target against the current compilation
   * and drop ids that no longer exist. Category-form targets track data changes
   * this way; an unpruned id set would otherwise resurrect deleted nodes.
   */
  function refreshTransientHighlight(): void {
    if (transientTarget === null) {
      transientHighlight = null;
      return;
    }
    const nextIds = new Set(ctx.compilation().nodes.map((n) => n.id));
    const resolved = new Set(
      [...resolveHighlightTarget(transientTarget)].filter((id) => nextIds.has(id)),
    );
    transientHighlight = resolved.size > 0 ? resolved : null;
  }

  /** The custom `dimOpacity` applies only while a transient highlight is up. */
  function effectiveDimOpacity(): number {
    const custom = transientHighlight !== null ? highlightDimOpacity : null;
    return custom ?? ctx.compilation().interaction.dimOpacity;
  }

  function hoverRadius(nodeId: string | null): void {
    const hoverCfg = ctx.compilation().animation?.hover ?? null;
    // No hover animation, reduced motion, or hover-off → snap (no tween).
    if (nodeId === null || !hoverCfg || prefersReducedMotion()) {
      hoverRadiusTween = nodeId ? { nodeId, scale: 1.15 } : null;
      return;
    }
    hoverRadiusTween = { nodeId, scale: 1 };
    const ease = resolveEase(hoverCfg.ease);
    const tween = createTween({
      duration: hoverCfg.duration,
      ease,
      apply: (t) => {
        // Guard against a newer hover having replaced the target mid-tween.
        if (hoverRadiusTween?.nodeId === nodeId) hoverRadiusTween.scale = 1 + 0.15 * t;
        ctx.invalidate();
      },
      onDone: () => {
        if (hoverRadiusTween?.nodeId === nodeId) hoverRadiusTween.scale = 1.15;
      },
    });
    scheduler.add(tween);
  }

  function frame(now: number): Pick<GraphRenderState, 'focus' | 'hoverRadiusScale' | 'dimOpacity'> {
    // Ensure a focus transition exists (first render), pointed at current state.
    if (!focusTransition) arm(now);
    const ft = focusTransition as FocusTransition;
    const t = ft.progress(now);
    const focus = t < 1 ? { t, prev: ft.prev, next: ft.next } : undefined;
    // When settled we still pass the resting snapshot as `next` for the fast path.
    const settledNext = ft.next;

    const hoverRadiusScale = hoverRadiusTween
      ? new Map([[hoverRadiusTween.nodeId, hoverRadiusTween.scale]])
      : undefined;

    return {
      focus: focus ?? { t: 1, prev: settledNext, next: settledNext },
      hoverRadiusScale,
      dimOpacity: effectiveDimOpacity(),
    };
  }

  return {
    get highlightSet() {
      return highlightSet;
    },
    get categories() {
      return activeCategories;
    },
    highlight(target, dimOpacity) {
      transientTarget = target;
      refreshTransientHighlight();
      highlightDimOpacity = dimOpacity ?? null;
      recompute();
    },
    clearHighlight() {
      transientTarget = null;
      transientHighlight = null;
      highlightDimOpacity = null;
      recompute();
    },
    setCategories(values) {
      activeCategories = new Set(values);
      recompute();
    },
    toggleCategory(value) {
      if (activeCategories.has(value)) activeCategories.delete(value);
      else activeCategories.add(value);
      recompute();
    },
    applyInitial() {
      const init = ctx.compilation().initialHighlight;
      if (!init) return;
      activeCategories = new Set(init.values);
      recompute();
    },
    reconcile() {
      refreshTransientHighlight();
      recompute();
    },
    arm,
    reset() {
      focusTransition = null;
    },
    hoverRadius,
    frame,
  };
}
