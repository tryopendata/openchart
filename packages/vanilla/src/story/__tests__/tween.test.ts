import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clamp01, createTween, easingFns, lerp } from '../tween';

/**
 * Deterministic rAF: we control frame timestamps manually.
 */
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafId: number;
let now: number;

function advanceFrame(dtMs: number) {
  now += dtMs;
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of pending) cb(now);
}

beforeEach(() => {
  rafCallbacks = new Map();
  rafId = 0;
  now = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
  vi.stubGlobal('performance', { now: () => now });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('easingFns', () => {
  it.each(Object.entries(easingFns))('%s hits 0 at 0 and 1 at 1', (_, fn) => {
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(1)).toBeCloseTo(1);
  });

  it.each(Object.entries(easingFns))('%s is monotonic on [0,1]', (_, fn) => {
    let prev = fn(0);
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const v = fn(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});

describe('lerp / clamp01', () => {
  it('lerp endpoints and midpoint', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('clamp01 clamps', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('createTween', () => {
  it('retargets FROM THE LIVE interpolated value, not the old endpoint', () => {
    const frames: number[] = [];
    const tween = createTween<number>({
      initial: 0,
      lerp,
      duration: 100,
      ease: easingFns.linear,
      onFrame: (v) => frames.push(v),
    });

    tween.to(100);
    advanceFrame(50); // live value ~50
    const live = frames.at(-1)!;
    expect(live).toBeCloseTo(50);

    // Fast-scroll interruption: retargeting must restart from the live
    // mid-flight value, not snap back to the previous target first.
    tween.to(0);
    advanceFrame(0); // first frame of the retargeted tween
    advanceFrame(1);
    const firstAfterRetarget = frames.at(-1)!;
    expect(firstAfterRetarget).toBeLessThanOrEqual(live);
    expect(firstAfterRetarget).toBeGreaterThan(40); // started near 50, not 100

    advanceFrame(200);
    expect(tween.get()).toBe(0);
  });

  it('snap applies synchronously with no rAF', () => {
    const frames: number[] = [];
    const tween = createTween<number>({
      initial: 0,
      lerp,
      onFrame: (v) => frames.push(v),
    });
    tween.to(7, { snap: true });
    expect(frames).toEqual([7]);
    expect(tween.get()).toBe(7);
    expect(rafCallbacks.size).toBe(0);
  });

  it('works over arbitrary shapes', () => {
    type State = { a: number; b: number };
    const lerpState = (x: State, y: State, t: number): State => ({
      a: lerp(x.a, y.a, t),
      b: lerp(x.b, y.b, t),
    });
    let latest: State = { a: 0, b: 10 };
    const tween = createTween<State>({
      initial: latest,
      lerp: lerpState,
      duration: 100,
      ease: easingFns.linear,
      onFrame: (v) => {
        latest = v;
      },
    });
    tween.to({ a: 10, b: 0 });
    advanceFrame(50);
    expect(latest.a).toBeCloseTo(5);
    expect(latest.b).toBeCloseTo(5);
  });

  it('cancel stops emission mid-flight', () => {
    const frames: number[] = [];
    const tween = createTween<number>({
      initial: 0,
      lerp,
      duration: 100,
      ease: easingFns.linear,
      onFrame: (v) => frames.push(v),
    });
    tween.to(100);
    advanceFrame(30);
    const count = frames.length;
    tween.cancel();
    advanceFrame(30);
    expect(frames.length).toBe(count);
  });

  it('zero duration snaps immediately', () => {
    const frames: number[] = [];
    const tween = createTween<number>({
      initial: 0,
      lerp,
      duration: 0,
      onFrame: (v) => frames.push(v),
    });
    tween.to(50);
    expect(frames).toEqual([50]);
    expect(rafCallbacks.size).toBe(0);
  });
});
