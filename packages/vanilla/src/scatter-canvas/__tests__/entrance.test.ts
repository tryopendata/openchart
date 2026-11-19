/**
 * Canvas entrance animation.
 *
 * The scheduler is driven with an explicit clock, so every assertion here is
 * deterministic — no rAF timing, no wall-clock sleeps.
 */

import {
  type AnimationEase,
  clampStaggerDelay,
  entranceTiming,
  evalKeyframes,
  evalRoleEase,
  type ResolvedAnimationPhase,
} from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationScheduler } from '../../motion/scheduler';
import {
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

/** Whether a promise has settled, checked after flushing microtasks. */
async function isSettled(p: Promise<void>): Promise<boolean> {
  let settled = false;
  void p.then(() => {
    settled = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  return settled;
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

describe('entrance duration', () => {
  it('uses the shared stagger cap, so 4k marks still fit the budget', () => {
    const clamped = clampStaggerDelay(80, 4000);
    expect(clamped).toBeLessThan(80);
    expect(clamped * 4000).toBeLessThanOrEqual(MAX_TOTAL_STAGGER_MS);
  });

  it('caps the total entrance for a 4k-point chart', () => {
    // Budget + one point's fade (40% of 500ms).
    const total = computeEntranceDuration(ENTER, 4000);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_STAGGER_MS + 200);
  });

  it("ends when the last point's CSS point-role window ends", () => {
    const last = entranceTiming('point', 9, ENTER, { staggerMs: clampStaggerDelay(80, 10) });
    expect(computeEntranceDuration(ENTER, 10)).toBeCloseTo(last.delayMs + last.durationMs, 9);
  });
});

describe('per-point alpha', () => {
  it("is 0 before a point's window opens and 1 after it closes", () => {
    // 80ms authored, clamped to 30ms by the budget: point 5 starts at 150ms
    // and runs 200ms (40% of the 500ms enter duration).
    expect(entranceAlphaAt(149, 5, ENTER, 10)).toBe(0);
    expect(entranceAlphaAt(150, 5, ENTER, 10)).toBe(0);
    expect(entranceAlphaAt(250, 5, ENTER, 10)).toBeGreaterThan(0);
    expect(entranceAlphaAt(250, 5, ENTER, 10)).toBeLessThan(1);
    expect(entranceAlphaAt(350, 5, ENTER, 10)).toBe(1);
  });

  it('fades earlier points before later ones', () => {
    const early = entranceAlphaAt(200, 0, ENTER, 10);
    const late = entranceAlphaAt(200, 5, ENTER, 10);
    expect(early).toBeGreaterThan(late);
  });

  const phases: [string, ResolvedAnimationPhase][] = (['smooth', 'snappy'] as AnimationEase[])
    .map((ease): [string, ResolvedAnimationPhase] => [ease, { ...ENTER, ease }])
    .concat([['spring', { ...ENTER, duration: 700, spring: { stiffness: 100, damping: 22 } }]]);

  it.each(phases)('equals the CSS point rule opacity at the same times (%s)', (_, enter) => {
    const n = 10;
    const ctx = { staggerMs: clampStaggerDelay(enter.staggerDelay, n) };
    for (const index of [0, 4, 9]) {
      const { delayMs, durationMs } = entranceTiming('point', index, enter, ctx);
      for (let t = 0; t <= 800; t += 10) {
        const local = (t - delayMs) / durationMs;
        const frame = evalKeyframes('oc-enter-fade-only', local, (p) =>
          evalRoleEase('point', enter, p),
        );
        const opacity = frame.opacity?.type === 'number' ? frame.opacity.value : Number.NaN;
        // The browser clamps an overshooting opacity to [0, 1].
        const css = Math.min(1, Math.max(0, opacity));
        expect(entranceAlphaAt(t, index, enter, n)).toBeCloseTo(css, 9);
      }
    }
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

  it('resolves finished when the tween completes', async () => {
    const h = harness(10);
    h.tick(0);
    h.tick(h.handle!.totalMs / 2);
    expect(await isSettled(h.handle!.finished)).toBe(false);
    h.tick(h.handle!.totalMs + 1);
    await expect(h.handle!.finished).resolves.toBeUndefined();
  });

  it('resolves (does not reject) finished on cancel', async () => {
    const h = harness(10);
    h.tick(0);
    h.handle!.cancel();
    await expect(h.handle!.finished).resolves.toBeUndefined();
    expect(h.done).toBe(false);
  });

  it('resolves finished when the scheduler cancels everything (layer destroy)', async () => {
    const h = harness(10);
    h.tick(0);
    h.scheduler.cancelAll();
    await expect(h.handle!.finished).resolves.toBeUndefined();
    expect(h.done).toBe(false);
  });
});
