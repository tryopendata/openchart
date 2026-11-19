import { describe, expect, it } from 'vitest';
import {
  barlistRowDelay,
  clampStaggerDelay,
  MAX_TOTAL_STAGGER_MS,
  mapPointStagger,
  mapSweepTiming,
  tilemapTileDelays,
} from '../stagger';

describe('stagger strategies', () => {
  it('clampStaggerDelay caps the total at 300ms, dividing by n', () => {
    expect(MAX_TOTAL_STAGGER_MS).toBe(300);
    expect(clampStaggerDelay(30, 200)).toBe(1.5);
    expect(clampStaggerDelay(30, 5)).toBe(30);
    expect(clampStaggerDelay(30, 1)).toBe(0);
  });

  it('barlist rows are 40ms apart, uncapped', () => {
    expect(barlistRowDelay(0)).toBe(0);
    expect(barlistRowDelay(3)).toBe(120);
    expect(barlistRowDelay(100)).toBe(4000);
  });

  it('map points spread half the enter duration over n - 1 gaps', () => {
    expect(mapPointStagger(450, 11)).toBe(22.5);
    expect(mapPointStagger(800, 2)).toBe(400);
    expect(mapPointStagger(450, 1)).toBeUndefined();
  });

  it('map sweep: budget round(1.2 * duration), features capped at 500ms', () => {
    expect(mapSweepTiming(450, 11, false)).toEqual({
      featureDurationMs: 450,
      budgetMs: 540,
      staggerMs: 54,
    });
    expect(mapSweepTiming(800, 11, false)).toEqual({
      featureDurationMs: 500,
      budgetMs: 960,
      staggerMs: 96,
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
