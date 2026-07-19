/**
 * Entrance stagger math: per-node reveal window, quantization, and the
 * stagger-vs-global-fade node-count threshold.
 */

import { describe, expect, it } from 'vitest';
import { ENTRANCE_STAGGER_MAX_NODES, nodeEnterProgress } from '../entrance';

describe('nodeEnterProgress', () => {
  it('clamps global progress to [0, 1]', () => {
    expect(nodeEnterProgress(-0.5, 0, 10)).toBe(0);
    expect(nodeEnterProgress(2, 0, 10)).toBe(1);
  });

  it('first node fully revealed by t=0.6, last node by t=1.0', () => {
    const total = 10;
    // Node 0 starts at t=0, ramps over 0.6 → fully in at 0.6.
    expect(nodeEnterProgress(0.6, 0, total)).toBe(1);
    // Last node starts at (9/10)*0.4 = 0.36, ramps over 0.6 → fully in at 0.96.
    expect(nodeEnterProgress(1, total - 1, total)).toBe(1);
    // ...and is not yet fully in mid-timeline.
    expect(nodeEnterProgress(0.6, total - 1, total)).toBeLessThan(1);
  });

  it('later nodes start later than earlier nodes', () => {
    const total = 100;
    const early = nodeEnterProgress(0.4, 0, total);
    const late = nodeEnterProgress(0.4, 99, total);
    expect(early).toBeGreaterThan(late);
  });

  it('quantizes to at most `buckets` distinct levels', () => {
    const total = 1000;
    const values = new Set<number>();
    for (let i = 0; i < total; i++) {
      values.add(nodeEnterProgress(0.5, i, total, 8));
    }
    // ≤ 9 levels (0, 1/8, ..., 1) preserves fill batching.
    expect(values.size).toBeLessThanOrEqual(9);
  });

  it('a smaller bucket count yields fewer levels', () => {
    const total = 500;
    const values = new Set<number>();
    for (let i = 0; i < total; i++) values.add(nodeEnterProgress(0.5, i, total, 4));
    expect(values.size).toBeLessThanOrEqual(5);
  });

  it('handles total=0 without dividing by zero', () => {
    expect(() => nodeEnterProgress(0.5, 0, 0)).not.toThrow();
  });
});

describe('ENTRANCE_STAGGER_MAX_NODES', () => {
  it('is the documented 3000 threshold', () => {
    expect(ENTRANCE_STAGGER_MAX_NODES).toBe(3000);
  });
});
