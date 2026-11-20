import { describe, expect, it } from 'vitest';
import {
  clampStaggerDelay,
  MAP_SWEEP_BUDGET_MS,
  MAX_TOTAL_STAGGER_MS,
  mapSweepTiming,
  tilemapTileDelays,
} from '../stagger';

describe('stagger strategies', () => {
  it('clampStaggerDelay spreads at most 450ms over n - 1 gaps, the authored delay a ceiling', () => {
    expect(MAX_TOTAL_STAGGER_MS).toBe(450);
    // 7 bars at the default 80ms: 450 / 6 = 75ms apart.
    expect(clampStaggerDelay(80, 7)).toBe(75);
    // 40 bars: 450 / 39.
    expect(clampStaggerDelay(80, 40)).toBeCloseTo(450 / 39, 10);
    // Few elements keep the authored gap: 5 bars could spread 112.5ms apart.
    expect(clampStaggerDelay(80, 5)).toBe(80);
    expect(clampStaggerDelay(30, 200)).toBeCloseTo(450 / 199, 10);
    // One element, or no stagger, has no gap.
    expect(clampStaggerDelay(80, 1)).toBe(0);
    expect(clampStaggerDelay(80, 0)).toBe(0);
    expect(clampStaggerDelay(0, 5)).toBe(0);
  });

  it('map sweep: a constant 540ms budget, features capped at 500ms', () => {
    expect(MAP_SWEEP_BUDGET_MS).toBe(540);
    expect(mapSweepTiming(450, 11, false)).toEqual({
      featureDurationMs: 450,
      budgetMs: 540,
      staggerMs: 54,
    });
    // A longer enter doesn't stretch the sweep.
    expect(mapSweepTiming(800, 11, false)).toEqual({
      featureDurationMs: 500,
      budgetMs: 540,
      staggerMs: 54,
    });
    expect(mapSweepTiming(800, 4000, true)).toEqual({
      featureDurationMs: 500,
      budgetMs: 0,
      staggerMs: 0,
    });
    expect(mapSweepTiming(450, 1, false).staggerMs).toBe(0);
  });

  it('tilemap delays reproduce the seeded jitter', () => {
    // Reference: the renderer's inline formula before it moved to core.
    const indices = Array.from({ length: 50 }, (_, i) => (i * 7) % 50);
    const expected: number[] = [];
    const baseStagger = 800 / indices.length;
    let seed = 17;
    for (const idx of indices) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const jitter = ((seed % 1000) / 1000 - 0.5) * 0.8;
      expected.push(Math.max(0, Math.round(idx * baseStagger * (1 + jitter))));
    }
    expect(tilemapTileDelays(indices)).toEqual(expected);
    expect(tilemapTileDelays([])).toEqual([]);
  });
});
