import { describe, expect, it } from 'vitest';
import { computeProgress, framesEqual, quantizeFrame } from '../progress-math';

// Three steps: tops at 100, 500, 900; last step ends at 1300.
const TOPS = [100, 500, 900];
const LAST_BOTTOM = 1300;

describe('computeProgress', () => {
  it('returns -1 sentinel while the trigger line is above step 0', () => {
    expect(computeProgress(TOPS, LAST_BOTTOM, 50)).toEqual({
      step: -1,
      stepProgress: 0,
      progress: 0,
    });
  });

  it('returns sentinel for empty steps', () => {
    expect(computeProgress([], 0, 400).step).toBe(-1);
  });

  it("stepProgress is 0 at a step's top and approaches 1 at its end", () => {
    const atTop = computeProgress(TOPS, LAST_BOTTOM, 100);
    expect(atTop.step).toBe(0);
    expect(atTop.stepProgress).toBe(0);

    const nearEnd = computeProgress(TOPS, LAST_BOTTOM, 499);
    expect(nearEnd.step).toBe(0);
    expect(nearEnd.stepProgress).toBeCloseTo(0.9975, 3);
  });

  it('hands off continuously at step boundaries', () => {
    const before = computeProgress(TOPS, LAST_BOTTOM, 500 - 0.001);
    const after = computeProgress(TOPS, LAST_BOTTOM, 500);
    expect(before.step).toBe(0);
    expect(before.stepProgress).toBeCloseTo(1, 3);
    expect(after.step).toBe(1);
    expect(after.stepProgress).toBeCloseTo(0, 3);
    // overall progress is continuous across the boundary
    expect(after.progress - before.progress).toBeLessThan(0.001);
  });

  it('clamps past the last step bottom', () => {
    const past = computeProgress(TOPS, LAST_BOTTOM, 5000);
    expect(past.step).toBe(2);
    expect(past.stepProgress).toBe(1);
    expect(past.progress).toBe(1);
  });

  it('last step span runs to lastBottom', () => {
    const mid = computeProgress(TOPS, LAST_BOTTOM, 1100);
    expect(mid.step).toBe(2);
    expect(mid.stepProgress).toBeCloseTo(0.5);
  });

  it('degenerate spans do not divide by zero', () => {
    const collapsed = computeProgress([100, 100], 100, 100);
    expect(Number.isFinite(collapsed.stepProgress)).toBe(true);
    expect(Number.isFinite(collapsed.progress)).toBe(true);
  });

  it('overall progress is monotonic in scroll', () => {
    let prev = -1;
    for (let y = 0; y <= 1400; y += 25) {
      const { progress } = computeProgress(TOPS, LAST_BOTTOM, y);
      expect(progress).toBeGreaterThanOrEqual(prev);
      prev = progress;
    }
  });
});

describe('quantizeFrame', () => {
  it('zeroes stepProgress and quantizes progress to step fractions', () => {
    const q = quantizeFrame({ step: 1, stepProgress: 0.7, progress: 0.55 }, 3);
    expect(q).toEqual({ step: 1, stepProgress: 0, progress: 1 / 3 });
  });

  it('keeps the -1 sentinel at zero progress', () => {
    const q = quantizeFrame({ step: -1, stepProgress: 0, progress: 0 }, 3);
    expect(q).toEqual({ step: -1, stepProgress: 0, progress: 0 });
  });
});

describe('framesEqual', () => {
  const frame = { step: 1, stepProgress: 0.5, progress: 0.4, direction: 'down' as const };

  it('null is never equal', () => {
    expect(framesEqual(null, frame)).toBe(false);
  });

  it('compares all fields', () => {
    expect(framesEqual({ ...frame }, frame)).toBe(true);
    expect(framesEqual({ ...frame, direction: 'up' }, frame)).toBe(false);
    expect(framesEqual({ ...frame, stepProgress: 0.51 }, frame)).toBe(false);
  });
});
