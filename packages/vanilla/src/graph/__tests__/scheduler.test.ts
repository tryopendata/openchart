/**
 * AnimationScheduler + motion primitives: frame arming, idle/active
 * transitions, snapshot-safe reentrancy, and tween progress/easing.
 */

import { describe, expect, it, vi } from 'vitest';
import { createTween, cubicInOut, cubicOut, linear, resolveEase } from '../motion';
import { AnimationScheduler, type GraphAnimation } from '../scheduler';

/** Minimal controllable animation for scheduler tests. */
function fakeAnim(runFrames: number, onDone?: () => void): GraphAnimation {
  let n = 0;
  let done = false;
  return {
    tick() {
      if (done) return false;
      n += 1;
      if (n >= runFrames) {
        done = true;
        onDone?.();
        return false;
      }
      return true;
    },
    finish() {
      if (!done) {
        done = true;
        onDone?.();
      }
    },
    cancel() {
      done = true;
    },
  };
}

describe('AnimationScheduler', () => {
  it('arms the first frame exactly once on idle→active', () => {
    const requestFrame = vi.fn();
    const s = new AnimationScheduler(requestFrame);
    expect(s.active).toBe(false);

    s.add(fakeAnim(3));
    expect(requestFrame).toHaveBeenCalledTimes(1);

    // Adding a second while already active does NOT re-arm (the loop is running).
    s.add(fakeAnim(3));
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(s.active).toBe(true);
  });

  it('does not report ran / active when idle', () => {
    const s = new AnimationScheduler(vi.fn());
    expect(s.tick(0)).toBe(false);
    expect(s.active).toBe(false);
  });

  it('runs continuously while an animation runs, then goes idle', () => {
    const s = new AnimationScheduler(vi.fn());
    s.add(fakeAnim(3));
    expect(s.tick(1)).toBe(true);
    expect(s.active).toBe(true);
    expect(s.tick(2)).toBe(true);
    expect(s.active).toBe(true);
    // Third tick completes the animation.
    expect(s.tick(3)).toBe(true);
    expect(s.active).toBe(false);
    // Now idle: tick reports nothing ran.
    expect(s.tick(4)).toBe(false);
  });

  it('is reentrancy-safe when onDone triggers finishAll mid-tick', () => {
    const s = new AnimationScheduler(vi.fn());
    const order: string[] = [];
    // a finishes on its first tick and, in onDone, finishes everything else.
    const a = fakeAnim(1, () => {
      order.push('a-done');
      s.finishAll();
    });
    const b = fakeAnim(100, () => order.push('b-done'));
    s.add(a);
    s.add(b);
    expect(() => s.tick(1)).not.toThrow();
    expect(order).toEqual(['a-done', 'b-done']);
    expect(s.active).toBe(false);
  });

  it('is reentrancy-safe when onDone triggers cancelAll mid-tick', () => {
    const s = new AnimationScheduler(vi.fn());
    const bDone = vi.fn();
    const a = fakeAnim(1, () => s.cancelAll());
    const b = fakeAnim(100, bDone);
    s.add(a);
    s.add(b);
    expect(() => s.tick(1)).not.toThrow();
    // cancelAll must NOT fire b's onDone.
    expect(bDone).not.toHaveBeenCalled();
    expect(s.active).toBe(false);
  });

  it('remove is safe mid-tick', () => {
    const s = new AnimationScheduler(vi.fn());
    const b = fakeAnim(100);
    const a = fakeAnim(100, undefined);
    // Wrap a.tick so it removes b during iteration.
    const aWrapped: GraphAnimation = {
      tick() {
        s.remove(b);
        return a.tick(0);
      },
      finish: a.finish,
      cancel: a.cancel,
    };
    s.add(aWrapped);
    s.add(b);
    expect(() => s.tick(1)).not.toThrow();
  });
});

describe('motion easings', () => {
  it('linear is identity', () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(1)).toBe(1);
  });

  it('cubicOut and cubicInOut hit the 0 and 1 endpoints', () => {
    expect(cubicOut(0)).toBe(0);
    expect(cubicOut(1)).toBe(1);
    expect(cubicInOut(0)).toBe(0);
    expect(cubicInOut(1)).toBe(1);
    expect(cubicInOut(0.5)).toBeCloseTo(0.5, 5);
  });

  it('resolveEase maps smooth→cubicInOut and snappy→cubicOut', () => {
    expect(resolveEase('smooth')(0.5)).toBeCloseTo(cubicInOut(0.5), 10);
    expect(resolveEase('snappy')(0.5)).toBeCloseTo(cubicOut(0.5), 10);
  });
});

describe('createTween', () => {
  it('locks startTime on the first tick and reports eased progress', () => {
    const seen: number[] = [];
    const tw = createTween({ duration: 100, ease: linear, apply: (t) => seen.push(t) });
    // First tick at t=1000 sets startTime; progress 0.
    expect(tw.tick(1000)).toBe(true);
    expect(seen.at(-1)).toBe(0);
    // Halfway.
    expect(tw.tick(1050)).toBe(true);
    expect(seen.at(-1)).toBeCloseTo(0.5, 5);
    // End.
    expect(tw.tick(1100)).toBe(false);
    expect(seen.at(-1)).toBe(1);
  });

  it('fires onDone once on natural completion', () => {
    const onDone = vi.fn();
    const tw = createTween({ duration: 10, ease: linear, apply: () => {}, onDone });
    tw.tick(0);
    tw.tick(100);
    expect(onDone).toHaveBeenCalledTimes(1);
    // Further ticks are no-ops.
    expect(tw.tick(200)).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancel stops without applying final state or onDone', () => {
    const onDone = vi.fn();
    const applied: number[] = [];
    const tw = createTween({ duration: 100, ease: linear, apply: (t) => applied.push(t), onDone });
    tw.tick(0);
    tw.cancel();
    expect(tw.tick(50)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(applied).toEqual([0]);
  });

  it('finish snaps to 1 and fires onDone', () => {
    const onDone = vi.fn();
    let last = -1;
    const tw = createTween({ duration: 100, ease: linear, apply: (t) => (last = t), onDone });
    tw.finish();
    expect(last).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
