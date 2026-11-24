import { describe, expect, it } from 'vitest';
import { sampleRanks, smoothRanks } from '../rank-smoothing';

describe('sampled ranks', () => {
  it('samples fractional times and uses the same sentinel for absent and below-fold keys', () => {
    expect(
      sampleRanks(
        [
          Float64Array.of(7, 1),
          Float64Array.of(2, 6),
          Float64Array.of(-1, -1),
          Float64Array.of(NaN, 8),
        ],
        2,
        2,
        2,
      ),
    ).toEqual([
      Float32Array.of(0, 0, 2),
      Float32Array.of(1, 1, 1),
      Float32Array.of(2, 2, 2),
      Float32Array.of(2, 2, 0),
    ]);
  });

  it('keeps the previous leader through 100 tied samples and falls back to key order initially', () => {
    const [a, b, c] = sampleRanks(
      [Float64Array.of(0, 1, 1), Float64Array.of(3, 1, 1), Float64Array.of(0, 1, 1)],
      3,
      100,
      3,
    );

    expect(a).toEqual(new Float32Array(201).fill(1));
    expect(b).toEqual(new Float32Array(201));
    expect(c).toEqual(new Float32Array(201).fill(2));
  });

  it('keeps previous exact rank order for tied keys entering from below the fold', () => {
    expect(
      sampleRanks(
        [Float64Array.of(10, 10, 0), Float64Array.of(2, 2, 10), Float64Array.of(4, 4, 8)],
        3,
        2,
        1,
      ),
    ).toEqual([
      Float32Array.of(0, 0, 0, 1, 1),
      Float32Array.of(1, 1, 1, 1, 0),
      Float32Array.of(1, 1, 1, 0, 1),
    ]);
  });
});

describe('triangle smoothing', () => {
  it('pads the triangle with raw endpoint ranks and preserves the first and last ranks', () => {
    const raw = Float32Array.of(3, 0, 0, 0, 2);

    expect(smoothRanks(raw, 2)).toEqual(Float32Array.of(3, 36 / 25, 30 / 25, 29 / 25, 2));
    expect(raw).toEqual(Float32Array.of(3, 0, 0, 0, 2));
  });

  it('spreads one crossing into a monotone ramp centered at the swap', () => {
    const smoothed = smoothRanks(Float32Array.of(0, 0, 0, 0, 1, 1, 1, 1), 1);

    expect(smoothed).toEqual(Float32Array.of(0, 0, 1 / 9, 3 / 9, 6 / 9, 8 / 9, 1, 1));
    expect((smoothed[3] + smoothed[4]) / 2).toBeCloseTo(0.5);
  });

  it('blends two crossings within one window without reaching either opposite slot', () => {
    const raw = Float32Array.of(0, 0, 0, 1, 1, 0, 0, 0);
    const down = smoothRanks(raw, 2);
    const up = smoothRanks(
      raw.map((rank) => 1 - rank),
      2,
    );

    expect(Math.max(...down)).toBeCloseTo(9 / 25);
    expect(Math.min(...up)).toBeCloseTo(16 / 25);
  });

  it('leaves ranks unchanged in an independent array when the half-width is zero', () => {
    const raw = Float32Array.of(0, 1, 0);
    const smoothed = smoothRanks(raw, 0);

    expect(smoothed).toEqual(raw);
    expect(smoothed).not.toBe(raw);
  });
});
