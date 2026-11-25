import { describe, expect, it } from 'vitest';
import { interpolatePlaybackLogValue, interpolatePlaybackValue } from '../interpolate';

describe('interpolatePlaybackValue', () => {
  it('lerps between neighbouring periods and across a gap', () => {
    expect(interpolatePlaybackValue(Float64Array.of(10, 20), 0, 0.25)).toBe(12.5);
    expect(interpolatePlaybackValue(Float64Array.of(0, NaN, 40), 0, 0.5, 2)).toBe(20);
  });

  it('reads the start value at fraction zero and returns NaN for an absent neighbour', () => {
    expect(interpolatePlaybackValue(Float64Array.of(5, NaN), 0, 0)).toBe(5);
    expect(interpolatePlaybackValue(Float64Array.of(5, NaN), 0, 0.5)).toBeNaN();
  });
});

describe('interpolatePlaybackLogValue', () => {
  it('interpolates geometrically: the midpoint of 1 and 100 is 10', () => {
    expect(interpolatePlaybackLogValue(Float64Array.of(1, 100), 0, 0.5)).toBeCloseTo(10, 10);
  });

  it('returns NaN when a neighbour is absent', () => {
    expect(interpolatePlaybackLogValue(Float64Array.of(1, NaN), 0, 0.5)).toBeNaN();
    expect(interpolatePlaybackLogValue(Float64Array.of(NaN, 100), 0, 0.5)).toBeNaN();
  });
});
