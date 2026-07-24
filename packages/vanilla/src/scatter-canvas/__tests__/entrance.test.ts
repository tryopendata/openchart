/**
 * Canvas entrance animation.
 *
 * The scheduler is driven with an explicit clock, so every assertion here is
 * deterministic — no rAF timing, no wall-clock sleeps.
 */

import type { ResolvedAnimationPhase } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationScheduler } from '../../motion/scheduler';
import {
  clampStagger,
  computeEntranceDuration,
  entranceAlphaAt,
  MAX_TOTAL_STAGGER_MS,
  playCanvasEntrance,
} from '../entrance';
import type { ScatterCanvasState } from '../types';

const ENTER: ResolvedAnimationPhase = {
  duration: 500,
  ease: 'smooth',
  staggerDelay: 80,
  staggerOrder: 'index',
};

/** Minimal state with `n` points, animationIndex ascending. */
function stateWith(n: number): ScatterCanvasState {
  const animationIndex = new Uint32Array(n);
  for (let i = 0; i < n; i++) animationIndex[i] = i;
  return {
    marks: { n, animationIndex, fillOpacity: new Float32Array(n).fill(1) },
    enterAlpha: null,
  } as unknown as ScatterCanvasState;
}

/** Drive an entrance with an explicit clock. */
function harness(n: number, enter: ResolvedAnimationPhase = ENTER) {
  const state = stateWith(n);
  const scheduler = new AnimationScheduler(() => {});
  let paints = 0;
  let done = false;
  const handle = playCanvasEntrance({
    state,
    enter,
    addAnimation: (a) => scheduler.add(a),
    removeAnimation: (a) => scheduler.remove(a),
    requestPaint: () => {
      paints++;
    },
    onDone: () => {
      done = true;
    },
  });
  return {
    state,
    scheduler,
    handle,
    tick: (t: number) => scheduler.tick(t),
    get paints() {
      return paints;
    },
    get done() {
      return done;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stagger clamping', () => {
  it('returns 0 for a single element', () => {
    expect(clampStagger(80, 1)).toBe(0);
  });

  it('keeps the authored delay when the sweep fits the budget', () => {
    expect(clampStagger(80, 10)).toBe(80);
  });

  it('compresses the delay so 4k marks still fit the budget', () => {
    const clamped = clampStagger(80, 4000);
    expect(clamped).toBeLessThan(80);
    expect(clamped * 4000).toBeLessThanOrEqual(MAX_TOTAL_STAGGER_MS);
  });

  it('caps the total entrance for a 4k-point chart', () => {
    // Budget + one point's fade (40% of 500ms).
    const total = computeEntranceDuration(ENTER, 4000);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_STAGGER_MS + 200);
  });
});

describe('per-point alpha', () => {
  it("is 0 before a point's window opens and 1 after it closes", () => {
    const ease = (p: number) => p;
    // Point 5 with 80ms stagger starts at 400ms, runs 200ms.
    expect(entranceAlphaAt(399, 5, ENTER, 10, ease)).toBe(0);
    expect(entranceAlphaAt(400, 5, ENTER, 10, ease)).toBe(0);
    expect(entranceAlphaAt(500, 5, ENTER, 10, ease)).toBeCloseTo(0.5, 5);
    expect(entranceAlphaAt(600, 5, ENTER, 10, ease)).toBe(1);
  });

  it('fades earlier points before later ones', () => {
    const ease = (p: number) => p;
    const early = entranceAlphaAt(300, 0, ENTER, 10, ease);
    const late = entranceAlphaAt(300, 5, ENTER, 10, ease);
    expect(early).toBeGreaterThan(late);
  });
});

describe('playCanvasEntrance', () => {
  it('seeds a from-state synchronously so the first frame is not the final state', () => {
    const h = harness(10);
    expect(h.state.enterAlpha).not.toBeNull();
    // Every point starts invisible; nothing has ticked yet.
    expect(Array.from(h.state.enterAlpha!)).toEqual(new Array(10).fill(0));
  });

  it('orders alpha by animationIndex mid-flight', () => {
    const h = harness(10);
    h.tick(0);
    h.tick(300);
    const alpha = h.state.enterAlpha!;
    // Monotonically non-increasing: earlier indices are further along.
    for (let i = 1; i < alpha.length; i++) {
      expect(alpha[i]).toBeLessThanOrEqual(alpha[i - 1]);
    }
    expect(alpha[0]).toBeGreaterThan(0);
  });

  it('clears enterAlpha and fires onDone at the end', () => {
    const h = harness(10);
    h.tick(0);
    expect(h.done).toBe(false);
    h.tick(h.handle!.totalMs + 1);
    expect(h.done).toBe(true);
    // null, not filled with 1s: the renderer skips the multiply entirely.
    expect(h.state.enterAlpha).toBeNull();
  });

  it('reports a totalMs that matches the computed duration', () => {
    const h = harness(50);
    expect(h.handle!.totalMs).toBe(computeEntranceDuration(ENTER, 50));
  });

  it('snaps to the final state under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const h = harness(10);
    expect(h.handle).toBeNull();
    expect(h.state.enterAlpha).toBeNull();
    expect(h.done).toBe(true);
  });

  it('returns null and settles immediately for an empty chart', () => {
    const h = harness(0);
    expect(h.handle).toBeNull();
    expect(h.done).toBe(true);
  });

  it('leaves no armed animation after cancel', () => {
    const h = harness(10);
    h.tick(0);
    expect(h.scheduler.active).toBe(true);
    h.handle!.cancel();
    expect(h.scheduler.active).toBe(false);
    expect(h.state.enterAlpha).toBeNull();
    // A cancelled entrance must not fire completion.
    expect(h.done).toBe(false);
  });
});
