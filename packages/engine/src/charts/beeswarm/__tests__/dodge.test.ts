import { describe, expect, it } from 'vitest';
import { DEFAULT_DODGE_PADDING, dodgeOffsets } from '../dodge';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random sequence (mulberry32) for repeatable fixtures. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clustered value-axis positions in [0, 500] that force many collisions. */
function makePositions(count: number, seed = 42): number[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => {
    // Sum of two draws clusters values around the middle (triangular-ish)
    return ((rand() + rand()) / 2) * 500;
  });
}

/** Assert every pair of circles keeps at least (r1 + r2) separation. */
function expectNoOverlap(
  positions: readonly number[],
  offsets: readonly number[],
  radii: readonly number[],
): void {
  const epsilon = 1e-6;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i] - positions[j];
      const dy = offsets[i] - offsets[j];
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(radii[i] + radii[j] - epsilon);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dodgeOffsets', () => {
  it('leaves a single dot at offset 0', () => {
    expect(dodgeOffsets([100], [4])).toEqual([0]);
  });

  it('leaves non-colliding dots at offset 0', () => {
    const offsets = dodgeOffsets([0, 100, 200], [4, 4, 4]);
    expect(offsets).toEqual([0, 0, 0]);
  });

  it('produces zero overlapping circles at 300 clustered points', () => {
    const positions = makePositions(300);
    const radii = positions.map(() => 4);
    const offsets = dodgeOffsets(positions, radii);
    expectNoOverlap(positions, offsets, radii);
  });

  it('respects per-dot radii (sized dots stay collision-free)', () => {
    const positions = makePositions(150, 7);
    const rand = seededRandom(99);
    const radii = positions.map(() => 2 + rand() * 8);
    const offsets = dodgeOffsets(positions, radii);
    expectNoOverlap(positions, offsets, radii);
  });

  it('is deterministic: same input yields identical output', () => {
    const positions = makePositions(200, 3);
    const radii = positions.map(() => 4);
    const first = dodgeOffsets(positions, radii);
    const second = dodgeOffsets(positions, radii);
    expect(second).toEqual(first);
  });

  it('keeps the first placed dot on the lane center and breaks symmetric ties to the negative side', () => {
    // Two dots at the same position: the first (by index) stays at 0, the
    // second must move; both interval edges have equal magnitude, so the
    // documented tie-break picks the negative side.
    const offsets = dodgeOffsets([100, 100], [4, 4]);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBeLessThan(0);
    expect(Math.abs(offsets[1])).toBeCloseTo(8 + DEFAULT_DODGE_PADDING, 6);
  });

  it('places dots at the minimal offset avoiding collisions', () => {
    // Three dots at one position: center, one side, other side; the third
    // dot must not leapfrog to a farther slot.
    const offsets = dodgeOffsets([50, 50, 50], [4, 4, 4]);
    expect(offsets[0]).toBe(0);
    const sep = 8 + DEFAULT_DODGE_PADDING;
    expect(Math.abs(offsets[1])).toBeCloseTo(sep, 6);
    expect(Math.abs(offsets[2])).toBeCloseTo(sep, 6);
    expect(Math.sign(offsets[1])).not.toBe(Math.sign(offsets[2]));
  });

  it('maps offsets back to input order, not sweep order', () => {
    // Descending input positions: the sweep runs ascending, but each offset
    // must land on its own input index.
    const positions = [300, 100, 200];
    const offsets = dodgeOffsets(positions, [4, 4, 4]);
    expect(offsets).toEqual([0, 0, 0]);
  });

  it('dodges only within a lane', () => {
    // Same position, different lanes: no collision, both stay centered.
    const separate = dodgeOffsets([100, 100], [4, 4], ['a', 'b']);
    expect(separate).toEqual([0, 0]);

    // Same lane collides as usual.
    const together = dodgeOffsets([100, 100], [4, 4], ['a', 'a']);
    expect(together[1]).not.toBe(0);
  });

  it('keeps lanes independent and collision-free in mixed input', () => {
    const rand = seededRandom(11);
    const lanesPool = ['a', 'b', 'c', 'd'];
    const positions = makePositions(200, 5);
    const radii = positions.map(() => 4);
    const lanes = positions.map(() => lanesPool[Math.floor(rand() * lanesPool.length)]);
    const offsets = dodgeOffsets(positions, radii, lanes);

    for (const lane of lanesPool) {
      const idx = positions.map((_, i) => i).filter((i) => lanes[i] === lane);
      expectNoOverlap(
        idx.map((i) => positions[i]),
        idx.map((i) => offsets[i]),
        idx.map((i) => radii[i]),
      );
    }
  });

  it('honors a custom padding', () => {
    const offsets = dodgeOffsets([100, 100], [4, 4], undefined, 5);
    expect(Math.abs(offsets[1])).toBeCloseTo(13, 6);
  });

  it('returns an empty array for empty input', () => {
    expect(dodgeOffsets([], [])).toEqual([]);
  });
});
