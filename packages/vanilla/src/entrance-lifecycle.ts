/**
 * Entrance lifecycle (Seam A): the play-when-seen hold, the entrance window,
 * and resize deferral every mount repeats, in one place.
 *
 * A mount owns one lifecycle for its whole life:
 *
 * - `arm()` after rendering a root that should enter. The entrance holds
 *   (`--oc-play-state: paused`) until the container is seen, then plays.
 * - `reset()` before a re-render (resize, font reload, update). It cancels;
 *   an entrance that was still waiting stays owed.
 * - `claim(hasContent, enabled)` during that render: whether to arm the
 *   entrance on the new root. The entrance is owed from mount until a render
 *   has content, and again whenever `reset()` cancels a waiting entrance, so
 *   an update that empties a waiting chart still enters when data returns.
 * - `drop()` cancels without the entrance staying owed. Only mounts that keep
 *   their host across a change use it (canvas-mode resize, graph updates);
 *   a CSS mount's update goes through `reset()` + `claim()`, or a waiting
 *   entrance would be lost.
 * - `admitResize()` at the top of `resize()`. While the entrance plays it
 *   records the resize and returns false; the resize replays through
 *   `onDeferredResize` after the entrance settles (mounts that never call
 *   `admitResize` omit the hook).
 * - `destroy()` on teardown.
 *
 * It wraps `playWhenSeen` (visibility.ts) and `setupAnimationCleanup`
 * (animation.ts) without changing them. Under reduced motion `play` runs at
 * once and, with no canvas entrance to wait for, settles synchronously
 * without opening a window. `oc-animate` stays on the root then (CSS sets
 * `animation: none` there), so JS that keys on the class must also check
 * `prefersReducedMotion()`.
 */

import { cancelAnimations, setupAnimationCleanup } from './animation';
import { prefersReducedMotion } from './motion/tween';
import { playWhenSeen } from './visibility';

/** What a mount's `onPlay` hands back when it starts a JS entrance. */
export interface EntrancePlay {
  /** Fallback window for the CSS cleanup (canvas mark mode); see `setupAnimationCleanup`. */
  totalMs?: number;
  /** Resolves when the JS entrance (canvas points, graph reveal) finishes. */
  canvasFinished?: Promise<void>;
}

export interface EntranceArm {
  /** Observed for visibility; survives re-renders. */
  container: Element;
  /**
   * The freshly rendered root (CSS mounts: already carries `oc-animate`).
   * `completion: 'js'` callers pass their persistent host instead.
   */
  root: Element & ElementCSSInlineStyle;
  trigger: 'visible' | 'mount' | undefined;
  /** Starts JS entrances once seen (canvas points, graph reveal). */
  onPlay?: () => EntrancePlay | undefined;
  /** Natural finish, or at once when nothing plays (reduced motion). Never on cancel. */
  onSettled?: () => void;
  /** 'css' (default): wait for the CSS animations via `setupAnimationCleanup`. 'js': await `canvasFinished` only. */
  completion?: 'css' | 'js';
  /** Cleanup fallback pad without `getAnimations` (tables pass 300). */
  fallbackPadMs?: number;
}

export interface EntranceLifecycle {
  /** Armed and not yet seen. */
  readonly waiting: boolean;
  /** Seen and not yet settled. */
  readonly playing: boolean;
  arm(opts: EntranceArm): void;
  /** Before a re-render: cancel. True if it was waiting (the entrance stays owed). */
  reset(): boolean;
  /**
   * During a render, after `reset()`: true when the entrance is owed, the
   * render has content, and entrances are enabled. A render with content
   * settles the debt whether or not it animates.
   */
  claim(hasContent: boolean, enabled: boolean): boolean;
  /**
   * Cancel without the entrance staying owed (canvas-mode resize, graph
   * updates that keep their host). Returns whether it was waiting.
   */
  drop(): boolean;
  /** True: run the resize now. False: deferred, replayed after the entrance settles. */
  admitResize(): boolean;
  destroy(): void;
}

export function createEntranceLifecycle(
  hooks: { onDeferredResize?: () => void } = {},
): EntranceLifecycle {
  let cancelSeen: (() => void) | null = null;
  let cancelPlay: (() => void) | null = null;
  let root: (Element & ElementCSSInlineStyle) | null = null;
  let pendingResize = false;
  let destroyed = false;
  // Owed until a render with content claims it (see `claim`).
  let owed = true;
  // Bumped by every arm and cancel, so callbacks from a superseded arm (a
  // late canvas promise, a synchronous play re-entering arm) do nothing.
  let generation = 0;

  function cancel(): boolean {
    const wasWaiting = cancelSeen !== null;
    generation++;
    cancelSeen?.();
    cancelSeen = null;
    cancelPlay?.();
    cancelPlay = null;
    // A persistent root (graph host) must never keep a paused hold.
    if (root) cancelAnimations(root);
    root = null;
    // The re-render or update that follows lays out at the current size, so a
    // resize deferred by the cancelled entrance has nothing left to replay.
    pendingResize = false;
    return wasWaiting;
  }

  function settle(gen: number, onSettled: (() => void) | undefined): void {
    if (gen !== generation) return;
    cancelPlay = null;
    // Settled: a later cancel must leave this root alone (under reduced
    // motion it keeps `oc-animate` on purpose).
    root = null;
    onSettled?.();
    // Replay after the handle is cleared, or the replayed resize would hit
    // the playing gate and defer forever.
    if (pendingResize && !destroyed && gen === generation) {
      pendingResize = false;
      hooks.onDeferredResize?.();
    }
  }

  function awaitPromise(gen: number, promise: Promise<void>, onSettled?: () => void): void {
    let cancelled = false;
    cancelPlay = () => {
      cancelled = true;
    };
    // A rejected promise means the JS entrance was torn down: settle anyway.
    const done = () => {
      if (!cancelled) settle(gen, onSettled);
    };
    void promise.then(done, done);
  }

  function play(gen: number, opts: EntranceArm, rootEl: Element & ElementCSSInlineStyle): void {
    const started = opts.onPlay?.() ?? {};
    if (gen !== generation) return; // onPlay re-armed or cancelled
    const { canvasFinished, totalMs } = started;
    if (opts.completion === 'js' || prefersReducedMotion()) {
      if (canvasFinished) awaitPromise(gen, canvasFinished, opts.onSettled);
      else settle(gen, opts.onSettled);
      return;
    }
    cancelPlay = setupAnimationCleanup(rootEl, {
      totalMs,
      canvasFinished,
      fallbackPadMs: opts.fallbackPadMs,
      onComplete: () => settle(gen, opts.onSettled),
    });
  }

  return {
    get waiting() {
      return cancelSeen !== null;
    },
    get playing() {
      return cancelPlay !== null;
    },
    arm(opts) {
      if (destroyed) return;
      cancel();
      const gen = generation;
      root = opts.root;
      const held = playWhenSeen(opts.container, opts.root, opts.trigger, () => {
        if (gen !== generation) return;
        cancelSeen = null;
        play(gen, opts, opts.root);
      });
      if (gen === generation) cancelSeen = held;
    },
    reset() {
      const wasWaiting = cancel();
      if (wasWaiting) owed = true;
      return wasWaiting;
    },
    claim(hasContent, enabled) {
      const animate = owed && hasContent && enabled;
      if (hasContent) owed = false;
      return animate;
    },
    drop: cancel,
    admitResize() {
      if (destroyed) return false;
      if (cancelPlay !== null) {
        pendingResize = true;
        return false;
      }
      return true;
    },
    destroy() {
      cancel();
      destroyed = true;
    },
  };
}
