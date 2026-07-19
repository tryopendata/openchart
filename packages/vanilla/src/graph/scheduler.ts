/**
 * Graph animation scheduler.
 *
 * Owns the set of running rAF-driven animations and the first-frame arming.
 * The mount's render loop ticks the scheduler once per frame and re-arms rAF
 * only while animations are active — a continuous loop that costs nothing when
 * idle (the base render loop stays strictly dirty-flag).
 *
 * Two hazards this design guards against:
 *
 * 1. **First-frame arming is the scheduler's job, not the call site's.** `add()`
 *    invokes the injected `requestFrame` on the idle→active transition, so no
 *    call site can forget to arm the first frame.
 *
 * 2. **Reentrancy.** A tween's `onDone` may call `update()` / `destroy()`, which
 *    trigger `finishAll` / `cancelAll` mid-tick. `tick()` iterates a SNAPSHOT of
 *    the animation list; `remove` / `cancelAll` are safe to call mid-tick.
 */

/** A single rAF-driven animation. */
export interface GraphAnimation {
  /** Advance to `now` (ms). Returns true while running, false when complete. */
  tick(now: number): boolean;
  /** Jump to the final state and fire completion callbacks. */
  finish(): void;
  /** Stop immediately without applying the final state or firing completion. */
  cancel(): void;
}

/** Manages a set of active animations and drives frame arming. */
export class AnimationScheduler {
  private animations = new Set<GraphAnimation>();
  private readonly requestFrame: () => void;

  /**
   * @param requestFrame Called on the idle→active transition to arm the first
   *   frame (typically the mount's `scheduleRender`).
   */
  constructor(requestFrame: () => void) {
    this.requestFrame = requestFrame;
  }

  /** Add an animation. Arms the first frame if the scheduler was idle. */
  add(a: GraphAnimation): void {
    const wasIdle = this.animations.size === 0;
    this.animations.add(a);
    if (wasIdle) this.requestFrame();
  }

  /** Remove an animation without finishing or cancelling it. Safe mid-tick. */
  remove(a: GraphAnimation): void {
    this.animations.delete(a);
  }

  /**
   * Advance all animations to `now`. Completed animations are removed. Returns
   * true if any animation ran this frame (so the caller marks the frame dirty).
   *
   * Iterates a snapshot so an `onDone` that mutates the set (via update/destroy)
   * can't corrupt the loop.
   */
  tick(now: number): boolean {
    if (this.animations.size === 0) return false;
    const snapshot = [...this.animations];
    let ran = false;
    for (const a of snapshot) {
      // An earlier animation's onDone may have removed this one mid-loop.
      if (!this.animations.has(a)) continue;
      ran = true;
      const running = a.tick(now);
      if (!running) this.animations.delete(a);
    }
    return ran;
  }

  /** True while any animation is active (drives rAF re-arming). */
  get active(): boolean {
    return this.animations.size > 0;
  }

  /** Cancel every animation (no final state, no onDone). Used on teardown. */
  cancelAll(): void {
    const snapshot = [...this.animations];
    this.animations.clear();
    for (const a of snapshot) a.cancel();
  }

  /** Finish every animation (snap to final, fire onDone). Used before update(). */
  finishAll(): void {
    const snapshot = [...this.animations];
    this.animations.clear();
    for (const a of snapshot) a.finish();
  }
}
