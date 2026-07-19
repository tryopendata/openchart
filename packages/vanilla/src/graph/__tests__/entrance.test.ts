/**
 * Entrance stagger math: per-node reveal window, quantization, and the
 * stagger-vs-global-fade node-count threshold.
 */

import { describe, expect, it } from 'vitest';
import {
  driftFactor,
  ENTRANCE_DRIFT_PX,
  ENTRANCE_STAGGER_MAX_NODES,
  entranceOffsets,
  entranceOrder,
  nodeEnterProgress,
  popAlpha,
  popScale,
} from '../entrance';

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

describe('entranceOrder', () => {
  it('ranks nodes by distance from the centroid, ascending', () => {
    // Centroid of these four is (0, 0); 'near' is closest, 'far' farthest.
    const nodes = [
      { id: 'far', x: 100, y: 0 },
      { id: 'near', x: 2, y: 0 },
      { id: 'mid', x: -30, y: 0 },
      { id: 'balance', x: -72, y: 0 },
    ];
    const order = entranceOrder(nodes);
    expect(order.get('near')).toBe(0);
    expect(order.get('mid')).toBe(1);
    expect(order.get('balance')).toBe(2);
    expect(order.get('far')).toBe(3);
  });

  it('returns an empty map for zero nodes', () => {
    expect(entranceOrder([]).size).toBe(0);
  });
});

describe('entranceOffsets', () => {
  it('points away from the centroid with magnitude ENTRANCE_DRIFT_PX', () => {
    const nodes = [
      { id: 'a', x: 10, y: 0 },
      { id: 'b', x: -10, y: 0 },
    ];
    const offsets = entranceOffsets(nodes);
    expect(offsets.get('a')).toEqual({ x: ENTRANCE_DRIFT_PX, y: 0 });
    expect(offsets.get('b')).toEqual({ x: -ENTRANCE_DRIFT_PX, y: 0 });
  });

  it('honors a custom distance', () => {
    const offsets = entranceOffsets(
      [
        { id: 'a', x: 5, y: 0 },
        { id: 'b', x: -5, y: 0 },
      ],
      4,
    );
    expect(offsets.get('a')).toEqual({ x: 4, y: 0 });
  });

  it('falls back to straight-up for a node sitting on the centroid', () => {
    // A single node IS the centroid — zero-length direction vector.
    const offsets = entranceOffsets([{ id: 'solo', x: 42, y: 42 }]);
    expect(offsets.get('solo')).toEqual({ x: 0, y: -ENTRANCE_DRIFT_PX });
  });

  it('returns an empty map for zero nodes', () => {
    expect(entranceOffsets([]).size).toBe(0);
  });
});

describe('popScale', () => {
  it('is 0 at t≤0 and 1 at t≥1', () => {
    expect(popScale(0)).toBe(0);
    expect(popScale(-1)).toBe(0);
    expect(popScale(1)).toBe(1);
    expect(popScale(2)).toBe(1);
  });

  it('overshoots past 1 mid-curve (the pop)', () => {
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => popScale((i + 1) / 100)));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.15);
  });
});

describe('popAlpha', () => {
  it('reaches full opacity by 60% of the window', () => {
    expect(popAlpha(0)).toBe(0);
    expect(popAlpha(0.3)).toBeCloseTo(0.5, 5);
    expect(popAlpha(0.6)).toBe(1);
    expect(popAlpha(1)).toBe(1);
  });
});

describe('driftFactor', () => {
  it('eases quadratically from 1 (full offset) to 0 (at rest)', () => {
    expect(driftFactor(0)).toBe(1);
    expect(driftFactor(0.5)).toBeCloseTo(0.25, 5);
    expect(driftFactor(1)).toBe(0);
    expect(driftFactor(-1)).toBe(1);
    expect(driftFactor(2)).toBe(0);
  });
});
