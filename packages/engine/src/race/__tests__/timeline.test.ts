import { describe, expect, it } from 'vitest';
import { createRaceTimeline } from '../timeline';
import type { RaceMatrix, RaceTimelineOptions } from '../types';

function matrix(...series: number[][]): RaceMatrix {
  const keys = series.map((_, keyIndex) => `key-${keyIndex}`);
  return {
    periods: series[0].map((_, index) => ({ value: 2000 + index, sortKey: 2000 + index })),
    keys,
    labels: keys,
    colorValues: keys.map(() => null),
    values: series.map((values) => Float64Array.from(values)),
  };
}

const options = {
  top: 2,
  swapPeriods: 0.6,
  samplesPerPeriod: 24,
  rescale: 'frame',
} satisfies RaceTimelineOptions;

describe('race timeline', () => {
  it('interpolates values continuously between measured endpoints', () => {
    const timeline = createRaceTimeline(matrix([2, 10, 0]), options);

    expect(timeline.valueAt(0, 0.25)).toBe(4);
    expect(timeline.valueAt(0, 1.6)).toBeCloseTo(4);
  });

  it('ranks a late key at its first finite period and leaves an isolated observation offscreen', () => {
    const timeline = createRaceTimeline(
      matrix([3, 3, 3, 3, 3, 3], [NaN, NaN, NaN, 8, NaN, 9]),
      options,
    );

    expect(timeline.valueAt(1, 2.99)).toBeNaN();
    expect(timeline.exactRank(1, 2.99)).toBe(Infinity);
    expect(timeline.sample(2.99).items.map(({ keyIndex }) => keyIndex)).toEqual([0]);
    expect(timeline.valueAt(1, 3)).toBe(8);
    expect(timeline.exactRank(1, 3)).toBe(0);
    expect(timeline.rankPos(1, 3)).toBe(timeline.top);
    expect(timeline.sample(3).items.map(({ keyIndex }) => keyIndex)).toEqual([0]);
    expect(timeline.valueAt(1, 3.01)).toBeNaN();
    expect(timeline.valueAt(1, 4)).toBeNaN();
    expect(timeline.valueAt(1, 4.99)).toBeNaN();
    expect(timeline.valueAt(1, 5)).toBe(9);
  });

  it('shows the first and last periods at their exact rank positions', () => {
    const timeline = createRaceTimeline(matrix([9, NaN], [5, 5], [NaN, 9]), options);

    expect(
      timeline.sample(0).items.map(({ keyIndex, rankPos, rank }) => [keyIndex, rankPos, rank]),
    ).toEqual([
      [0, 0, 0],
      [1, 1, 1],
    ]);
    expect(
      timeline.sample(1).items.map(({ keyIndex, rankPos, rank }) => [keyIndex, rankPos, rank]),
    ).toEqual([
      [2, 0, 0],
      [1, 1, 1],
    ]);
  });

  it('keeps incumbents in place until a late entrant can fade in', () => {
    const incumbents = [5, 4, 3, 2, 1].map((value) => Array<number>(6).fill(value));
    const timeline = createRaceTimeline(matrix(...incumbents, [NaN, NaN, NaN, 100, 100, 100]), {
      ...options,
      top: 5,
      swapPeriods: 0.57,
    });
    const positions = (t: number) =>
      timeline.sample(t).items.map(({ keyIndex, rankPos }) => [keyIndex, rankPos]);
    const initial = positions(2);

    expect(positions(2.75)).toEqual(initial);
    expect(positions(2.99)).toEqual(initial);
    expect(timeline.rankPos(5, 3)).toBe(5);
    expect(positions(3)).toEqual(initial);
    expect(timeline.valueAt(5, 3)).toBe(100);
    expect(timeline.exactRank(5, 3)).toBe(0);
    expect(timeline.rankPos(5, 3.05)).toBeGreaterThan(4);
    expect(timeline.rankPos(5, 3.05)).toBeLessThan(5);
    expect(positions(3.65)[0]).toEqual([5, 0]);
  });

  it('keeps the exiting leader in the domain until it crosses the visibility threshold', () => {
    const incumbents = [5, 4, 3, 2, 1].map((value) => Array<number>(6).fill(value));
    const timeline = createRaceTimeline(matrix(...incumbents, [100, 100, 100, NaN, NaN, NaN]), {
      ...options,
      top: 5,
      swapPeriods: 0.57,
    });

    expect(timeline.sample(1).domainMax).toBe(100);
    expect(timeline.rankPos(5, 1.95)).toBeGreaterThan(4);
    expect(timeline.rankPos(5, 1.95)).toBeLessThan(5);
    expect(timeline.sample(1.95).domainMax).toBe(100);
    const atThreshold = timeline.sample(1.99999999);
    expect(atThreshold.items.some(({ keyIndex }) => keyIndex === 5)).toBe(false);
    expect(atThreshold.domainMax).toBe(5);
    expect(timeline.rankPos(5, 2)).toBe(5);
    expect(timeline.sample(2).domainMax).toBe(5);
    expect(timeline.sample(2.00000001).domainMax).toBe(5);
  });

  it('clamps top to the key count and keeps all present keys in view', () => {
    const timeline = createRaceTimeline(matrix([10, 0], [0, 10]), { ...options, top: 10 });

    expect(timeline.top).toBe(2);
    expect(timeline.keyCount).toBe(2);
    expect(timeline.periodCount).toBe(2);
    expect(timeline.sample(0.5).items.map(({ keyIndex, opacity }) => [keyIndex, opacity])).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(timeline.sample(1).items.map(({ keyIndex }) => keyIndex)).toEqual([1, 0]);
  });

  it('handles a single key', () => {
    const timeline = createRaceTimeline(matrix([4, 8]), options);

    expect(timeline.top).toBe(1);
    expect(timeline.sample(0.5)).toEqual({
      t: 0.5,
      periodIndex: 0,
      items: [{ keyIndex: 0, value: 6, rank: 0, rankPos: 0, opacity: 1, change: 0 }],
      domainMin: 0,
      domainMax: 6,
    });
  });

  it.each([
    { samplesPerPeriod: 3, tiedRanks: [2, 1] },
    { samplesPerPeriod: 5, tiedRanks: [1, 2] },
  ])('uses the nearest order with $samplesPerPeriod samples per period on a tie below the fold', ({
    samplesPerPeriod,
    tiedRanks,
  }) => {
    const timeline = createRaceTimeline(matrix([6, 2], [1, 5], [20, 20]), {
      ...options,
      top: 1,
      samplesPerPeriod,
    });

    expect([timeline.exactRank(0, 0.62), timeline.exactRank(1, 0.62)]).toEqual([1, 2]);
    expect([timeline.exactRank(0, 0.625), timeline.exactRank(1, 0.625)]).toEqual(tiedRanks);
  });

  it.each([
    0.4, 0.7,
  ])('returns sorted visible items with interpolated position and opacity with a swap of %d periods', (swapPeriods) => {
    const timeline = createRaceTimeline(matrix([10, 0], [0, 10], [-1, -1]), {
      ...options,
      top: 1,
      swapPeriods,
      samplesPerPeriod: 8,
    });

    const { items } = timeline.sample(19 / 32);

    expect(items.map(({ keyIndex, rank }) => [keyIndex, rank])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(items[0].rankPos).toBeCloseTo(5 / 12);
    expect(items[0].opacity).toBeCloseTo(7 / 12);
    expect(items[1].rankPos).toBeCloseTo(7 / 12);
    expect(items[1].opacity).toBeCloseTo(5 / 12);
    expect(timeline.rankPos(2, 19 / 32)).toBe(1);
  });

  it.each([
    1e154,
    Number.MAX_VALUE,
  ])('caps a swap of %s periods at the number of samples', (swapPeriods) => {
    const input = matrix([10, 0], [0, 10]);
    const timeline = createRaceTimeline(input, {
      ...options,
      top: 1,
      swapPeriods,
    });
    const sampleCount = options.samplesPerPeriod + 1;
    const bounded = createRaceTimeline(input, {
      ...options,
      top: 1,
      swapPeriods: (4 * sampleCount) / options.samplesPerPeriod,
    });

    expect(timeline.sample(0).items.map(({ keyIndex, rankPos }) => [keyIndex, rankPos])).toEqual([
      [0, 0],
    ]);
    expect(timeline.sample(0.5)).toEqual(bounded.sample(0.5));
    expect(timeline.sample(1).items.map(({ keyIndex, rankPos }) => [keyIndex, rankPos])).toEqual([
      [1, 0],
    ]);
  });

  it('omits a row whose interpolated position is within 1e-6 of the sentinel', () => {
    const timeline = createRaceTimeline(matrix([10, 0], [0, 10]), {
      ...options,
      top: 1,
      swapPeriods: 0,
      samplesPerPeriod: 2,
    });

    expect(timeline.rankPos(1, 0.50000001)).toBeLessThan(1);
    expect(timeline.sample(0.50000001).items.map(({ keyIndex }) => keyIndex)).toEqual([0]);
    expect(timeline.sample(0.5001).items.map(({ keyIndex }) => keyIndex)).toEqual([0, 1]);
  });

  it('is deterministic across repeated samples and seeks in either direction', () => {
    const timeline = createRaceTimeline(matrix([9, 2, 7], [1, 8, 3], [3, 4, 5]), options);
    const expected = structuredClone(timeline.sample(0.51));

    expect(timeline.sample(0.51)).toEqual(expected);
    timeline.sample(2);
    timeline.sample(0);
    expect(timeline.sample(0.51)).toEqual(expected);
  });

  it('reports rank changes at integer period boundaries and zero for new entries', () => {
    const timeline = createRaceTimeline(matrix([9, 1, 9], [3, 8, 2], [NaN, 6, 6]), {
      ...options,
      top: 3,
    });

    expect(timeline.sample(0.9).items.map(({ change }) => change)).toEqual([0, 0]);
    for (const t of [1, 1.9]) {
      const changes = timeline.sample(t).items.map(({ keyIndex, change }) => [keyIndex, change]);
      const expected = [
        [0, -2],
        [1, 1],
      ];
      if (t > 1) expected.push([2, 0]);
      expect(changes.sort(([a], [b]) => a - b)).toEqual(expected);
    }
  });

  it('uses exact ranks below the fold to calculate later period changes', () => {
    const timeline = createRaceTimeline(matrix([10, 4, 5], [5, 12, 1], [1, 2, 12]), {
      ...options,
      top: 1,
      swapPeriods: 0,
    });

    expect(timeline.sample(1).items.map(({ keyIndex, change }) => [keyIndex, change])).toEqual([
      [1, 1],
    ]);
    expect(timeline.sample(2).items.map(({ keyIndex, change }) => [keyIndex, change])).toEqual([
      [2, 2],
    ]);
  });

  it.each([
    { rescale: 'frame', domain: [-3, 8] },
    { rescale: 'fixed', domain: [-20, 40] },
    { rescale: { min: 12 }, domain: [-3, 12] },
    { rescale: { min: 5 }, domain: [-3, 8] },
  ] satisfies {
    rescale: RaceTimelineOptions['rescale'];
    domain: number[];
  }[])('sets the domain for $rescale rescaling and ranks negatives below positives', ({
    rescale,
    domain,
  }) => {
    const timeline = createRaceTimeline(matrix([-3, -4], [8, 40], [-20, -10]), {
      ...options,
      rescale,
    });

    const { items, domainMin, domainMax } = timeline.sample(0);
    expect([domainMin, domainMax]).toEqual(domain);
    expect(items.map(({ keyIndex, rank }) => [keyIndex, rank])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(timeline.exactRank(2, 0)).toBe(2);
  });

  it.each([
    'frame',
    'fixed',
    { min: 0 },
  ] satisfies RaceTimelineOptions['rescale'][])('uses a positive domain maximum for non-positive values with %j rescaling', (rescale) => {
    const timeline = createRaceTimeline(matrix([-5, -2], [-3, 0]), { ...options, rescale });

    expect(timeline.sample(0)).toMatchObject({ domainMin: -5, domainMax: 1 });
  });

  it('includes a fading negative row in the visible frame domain during a swap', () => {
    const timeline = createRaceTimeline(matrix([-2, -2], [-6, 12]), {
      ...options,
      top: 1,
      samplesPerPeriod: 8,
    });
    const { items, domainMin, domainMax } = timeline.sample(0.375);

    expect(items.map(({ keyIndex, rank }) => [keyIndex, rank])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect([domainMin, domainMax]).toEqual([-2, 0.75]);
  });

  it('uses a zero-based fallback domain when a frame has no present keys', () => {
    const timeline = createRaceTimeline(matrix([4, NaN], [NaN, 5]), options);

    expect(timeline.sample(0.5)).toEqual({
      t: 0.5,
      periodIndex: 0,
      items: [],
      domainMin: 0,
      domainMax: 1,
    });
  });

  it('clamps the playhead at both ends', () => {
    const timeline = createRaceTimeline(matrix([3, 0], [1, 4]), options);

    expect(timeline.sample(-3)).toEqual(timeline.sample(0));
    expect(timeline.sample(3)).toEqual(timeline.sample(1));
    expect(timeline.valueAt(0, -3)).toBe(3);
    expect(timeline.exactRank(0, 3)).toBe(1);
    expect(timeline.rankPos(0, 3)).toBe(1);
  });

  it('builds 200 keys over 100 periods with 24 samples per period in under 250ms', () => {
    const input = matrix(
      ...Array.from({ length: 200 }, (_, keyIndex) =>
        Array.from(
          { length: 100 },
          (_, periodIndex) => ((keyIndex * 7919 + periodIndex * 104729) % 1009) - 300,
        ),
      ),
    );

    const start = performance.now();
    const timeline = createRaceTimeline(input, { ...options, top: 10 });
    const elapsed = performance.now() - start;

    expect(timeline.sample(45.5).items.length).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThan(250);
  });
});
