import { describe, expect, it } from 'vitest';
import { CELL_SWEEP_BUDGET_MS, shuffledSweepDelays } from '../stagger';

describe('shuffledSweepDelays', () => {
  it('handles empty and single inputs', () => {
    expect(shuffledSweepDelays(0, 600, 0)).toEqual([]);
    expect(shuffledSweepDelays(1, 600, 1)).toEqual([0]);
  });

  it('is a permutation of evenly spaced slots over the budget', () => {
    const n = 25;
    const delays = shuffledSweepDelays(n, 600, n);
    expect(delays).toHaveLength(n);
    const slots = Array.from({ length: n }, (_, i) => (i / (n - 1)) * 600);
    expect([...delays].sort((a, b) => a - b)).toEqual(slots);
  });

  it('is deterministic for a seed and scattered, not in slot order', () => {
    const n = 40;
    const a = shuffledSweepDelays(n, 600, n);
    expect(shuffledSweepDelays(n, 600, n)).toEqual(a);
    let inversions = 0;
    let pairs = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs++;
        if (a[i] > a[j]) inversions++;
      }
    }
    expect(inversions / pairs).toBeGreaterThan(0.25);
  });

  it('spreads grid cells over 600ms', () => {
    expect(CELL_SWEEP_BUDGET_MS).toBe(600);
  });
});
