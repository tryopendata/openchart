import { describe, expect, it } from 'vitest';
import { resolveDefaultProjection } from '../projections';

/** A topology in the shape the atlases ship: quantized deltas plus a bbox. */
function topo(bbox: number[] | undefined, arcs: number[][][]) {
  return { type: 'Topology', objects: {}, bbox, arcs };
}

describe('resolveDefaultProjection', () => {
  it('infers identity for a pre-projected topology (us-atlas states-albers)', () => {
    expect(resolveDefaultProjection(topo([0, 0, 975, 610], []))).toBe('identity');
  });

  it('infers equalEarth for a world topology', () => {
    expect(resolveDefaultProjection(topo([-180, -90, 180, 83.6], []))).toBe('equalEarth');
  });

  it('infers albersUsa for a small longitude span', () => {
    expect(resolveDefaultProjection(topo([-124.7, 24.5, -66.9, 49.4], []))).toBe('albersUsa');
  });

  it('falls back to albersUsa when the topology carries nothing to measure', () => {
    expect(resolveDefaultProjection(topo(undefined, []))).toBe('albersUsa');
    expect(resolveDefaultProjection(null)).toBe('albersUsa');
  });

  it('measures the arcs when there is no bbox', () => {
    // No transform means the arcs hold absolute coordinates.
    const arcs = [
      [
        [-100, 30],
        [-70, 35],
        [-80, 40],
      ],
    ];
    expect(resolveDefaultProjection({ type: 'Topology', objects: {}, arcs })).toBe('albersUsa');
  });

  it('sums deltas when the topology is quantized', () => {
    // transform present => arcs are delta-encoded, so the running sum is what
    // gets measured: 0 -> 500 -> 1000 in quantized units, scaled to degrees.
    const quantized = {
      type: 'Topology',
      objects: {},
      transform: { scale: [0.001, 0.001], translate: [-100, 30] },
      arcs: [
        [
          [0, 0],
          [500, 100],
          [500, 100],
        ],
      ],
    };
    expect(resolveDefaultProjection(quantized)).toBe('albersUsa');
  });

  it('detects pre-projected coordinates from the arcs alone', () => {
    const arcs = [
      [
        [0, 0],
        [500, 0],
        [0, 300],
      ],
    ];
    expect(resolveDefaultProjection({ type: 'Topology', objects: {}, arcs })).toBe('identity');
  });
});
