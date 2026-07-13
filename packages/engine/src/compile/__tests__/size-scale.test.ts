import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { buildSizeScale } from '../size-scale';

const DATA = [{ v: 1 }, { v: 4 }, { v: 9 }];
const SQRT = { curve: 'sqrt' as const, range: [3, 30] as [number, number] };
const LINEAR = { curve: 'linear' as const, range: [11, 32] as [number, number] };

const size = (extra: Partial<EncodingChannel> = {}): EncodingChannel =>
  ({ field: 'v', type: 'quantitative', ...extra }) as EncodingChannel;

describe('buildSizeScale', () => {
  it('returns null when there is no size encoding', () => {
    expect(buildSizeScale(undefined, DATA, SQRT)).toBeNull();
  });

  it('fits the domain to the data extent and the range to the default', () => {
    const resolved = buildSizeScale(size(), DATA, SQRT);
    expect(resolved?.domain).toEqual([1, 9]);
    expect(resolved?.range).toEqual([3, 30]);
    expect(resolved?.field).toBe('v');
  });

  it('maps circles by area (sqrt), not by radius', () => {
    const { scale } = buildSizeScale(size(), DATA, SQRT)!;
    // Endpoints pin to the range.
    expect(scale(1)).toBeCloseTo(3, 5);
    expect(scale(9)).toBeCloseTo(30, 5);
    // The midpoint of a sqrt scale sits ABOVE the linear midpoint (16.5):
    // r = 3 + 27 * (sqrt(4)-sqrt(1)) / (sqrt(9)-sqrt(1)) = 16.5 -- for v=4
    // that lands exactly on the linear midpoint by coincidence of 1/4/9, so
    // check a value where the two genuinely diverge.
    const linearAt6 = 3 + 27 * ((6 - 1) / (9 - 1)); // 19.875
    expect(scale(6)).toBeGreaterThan(linearAt6);
  });

  it('maps glyphs by height (linear)', () => {
    const { scale } = buildSizeScale(size(), DATA, LINEAR)!;
    expect(scale(1)).toBeCloseTo(11, 5);
    expect(scale(9)).toBeCloseTo(32, 5);
    // Exactly proportional: no sqrt bulge.
    expect(scale(5)).toBeCloseTo(11 + (32 - 11) * ((5 - 1) / (9 - 1)), 5);
  });

  it('lets an explicit scale.domain override the data extent', () => {
    const resolved = buildSizeScale(size({ scale: { domain: [0, 100] } }), DATA, SQRT);
    expect(resolved?.domain).toEqual([0, 100]);
  });

  it('lets an explicit scale.range override the default magnitudes', () => {
    const resolved = buildSizeScale(size({ scale: { range: [5, 12] } }), DATA, SQRT);
    expect(resolved?.range).toEqual([5, 12]);
    expect(resolved?.scale(1)).toBeCloseTo(5, 5);
    expect(resolved?.scale(9)).toBeCloseTo(12, 5);
  });

  it('clamps data outside an explicit domain to the range endpoints', () => {
    // This is why a size legend must key the DOMAIN, not the data extent: every
    // datum above domain[1] renders at max magnitude and is indistinguishable.
    const { scale } = buildSizeScale(size({ scale: { domain: [0, 5] } }), DATA, SQRT)!;
    expect(scale(9)).toBeCloseTo(scale(5), 5);
    expect(scale(-100)).toBeCloseTo(scale(0), 5);
  });

  it('returns null for a degenerate domain (every value identical)', () => {
    // A zero-width domain maps every datum to range[0]. There is no magnitude
    // being encoded, so the caller falls back to its static default rather than
    // rendering a field of identical minimum-size marks.
    expect(buildSizeScale(size(), [{ v: 7 }, { v: 7 }], SQRT)).toBeNull();
  });

  it('returns null when no value is finite', () => {
    expect(buildSizeScale(size(), [{ v: 'x' }, { v: null }], SQRT)).toBeNull();
  });

  it('ignores non-finite rows when fitting the domain', () => {
    const resolved = buildSizeScale(size(), [{ v: 1 }, { v: 'nope' }, { v: 9 }], SQRT);
    expect(resolved?.domain).toEqual([1, 9]);
  });

  it('treats a null hole as absent data, not as a zero', () => {
    // `Number(null)` is a finite 0, so a hole that reaches the extent silently
    // drags the domain floor to zero and rescales every genuine mark.
    const resolved = buildSizeScale(size(), [{ v: 10 }, { v: 20 }, { v: null }], SQRT);
    expect(resolved?.domain).toEqual([10, 20]);
  });

  it('treats an empty string the same way (Number("") is also 0)', () => {
    const resolved = buildSizeScale(size(), [{ v: 10 }, { v: 20 }, { v: '' }], SQRT);
    expect(resolved?.domain).toEqual([10, 20]);
  });

  it('returns null when the field is absent from every row', () => {
    // `min([])`/`max([])` are undefined; a `?? 0` / `?? 1` fallback would
    // fabricate a live [0, 1] scale out of data that encodes no size at all.
    expect(buildSizeScale(size(), [{ other: 1 }, { other: 2 }], SQRT)).toBeNull();
  });

  it('returns null on empty data', () => {
    expect(buildSizeScale(size(), [], SQRT)).toBeNull();
  });

  it('honours an explicit domain even when the data has no usable extent', () => {
    // The domain is the author's, not the data's, so it stands on its own.
    const resolved = buildSizeScale(size({ scale: { domain: [0, 100] } }), [{ v: null }], SQRT);
    expect(resolved?.domain).toEqual([0, 100]);
  });
});
