/**
 * Seeded initial layout: FNV-1a hash stability + per-node determinism.
 *
 * Determinism is scoped PER EXECUTION PATH: the same (id, seed, community) always
 * yields the same start position, and adding a node never moves the others'.
 */

import { describe, expect, it } from 'vitest';
import { hash32, seedNodePositions } from '../seed';
import type { SimNode } from '../worker-protocol';

function makeNodes(n: number, community?: (i: number) => string): SimNode[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    radius: 5,
    community: community?.(i),
  }));
}

describe('hash32 (FNV-1a)', () => {
  it('is deterministic and unsigned 32-bit', () => {
    const a = hash32('hello');
    expect(hash32('hello')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('distinguishes similar strings', () => {
    expect(hash32('a')).not.toBe(hash32('b'));
    expect(hash32('n1|0')).not.toBe(hash32('n2|0'));
    expect(hash32('n1|0')).not.toBe(hash32('n1|1'));
  });
});

describe('seedNodePositions determinism', () => {
  it('two runs with the same seed are identical to the float', () => {
    const a = makeNodes(20);
    const b = makeNodes(20);
    seedNodePositions(a, 42);
    seedNodePositions(b, 42);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
    }
  });

  it('a different seed produces different positions', () => {
    const a = makeNodes(20);
    const b = makeNodes(20);
    seedNodePositions(a, 1);
    seedNodePositions(b, 2);
    const differs = a.some((node, i) => node.x !== b[i].x || node.y !== b[i].y);
    expect(differs).toBe(true);
  });

  it('adding a node leaves the others’ seed positions unchanged', () => {
    const before = makeNodes(10);
    seedNodePositions(before, 7);
    const snapshot = before.map((n) => ({ id: n.id, x: n.x, y: n.y }));

    // A larger graph (extra node appended) with the same seed.
    const after = makeNodes(11);
    seedNodePositions(after, 7);

    for (const s of snapshot) {
      const match = after.find((n) => n.id === s.id)!;
      expect(match.x).toBe(s.x);
      expect(match.y).toBe(s.y);
    }
  });

  it('spreads nodes off a single point (not phyllotaxis-degenerate)', () => {
    const nodes = makeNodes(50);
    seedNodePositions(nodes, 0);
    const xs = new Set(nodes.map((n) => n.x));
    const ys = new Set(nodes.map((n) => n.y));
    // Distinct positions, and a non-trivial spread scaling with sqrt(n).
    expect(xs.size).toBeGreaterThan(40);
    expect(ys.size).toBeGreaterThan(40);
    const maxR = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y)));
    expect(maxR).toBeGreaterThan(10);
  });

  it('biases community nodes toward distinct region centers', () => {
    // Two communities; centroids should separate under the 0.6·R0 bias.
    const nodes = makeNodes(200, (i) => (i < 100 ? 'x' : 'y'));
    seedNodePositions(nodes, 3);
    const centroid = (c: string) => {
      const group = nodes.filter((n) => n.community === c);
      const cx = group.reduce((s, n) => s + (n.x ?? 0), 0) / group.length;
      const cy = group.reduce((s, n) => s + (n.y ?? 0), 0) / group.length;
      return { cx, cy };
    };
    const gx = centroid('x');
    const gy = centroid('y');
    const sep = Math.hypot(gx.cx - gy.cx, gx.cy - gy.cy);
    expect(sep).toBeGreaterThan(0);
  });

  it('is a no-op on an empty node list', () => {
    const nodes: SimNode[] = [];
    expect(() => seedNodePositions(nodes, 1)).not.toThrow();
  });
});
