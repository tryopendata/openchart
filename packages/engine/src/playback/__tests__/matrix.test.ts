import type { DataRow } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { PlaybackDataError } from '../errors';
import { buildPlaybackMatrix, type PlaybackGaps, type PlaybackMatrixOptions } from '../matrix';

const options: PlaybackMatrixOptions = {
  identity: 'country',
  time: { field: 'year', type: 'temporal' },
  channels: [
    { name: 'x', field: 'gdp' },
    { name: 'y', field: 'life' },
  ],
};

function build(
  rows: DataRow[],
  overrides: Partial<PlaybackMatrixOptions> = {},
  gaps: PlaybackGaps = 'drop',
) {
  const warnings: string[] = [];
  const matrix = buildPlaybackMatrix(rows, { ...options, ...overrides }, gaps, (message) =>
    warnings.push(message),
  );
  return { matrix, warnings };
}

/** A is observed in 2001 and 2004; B and C supply the other periods from 2000 to 2005. */
const gappy = [
  { country: 'A', year: 2001, gdp: 10, life: 50 },
  { country: 'A', year: 2004, gdp: 40, life: 80 },
  { country: 'B', year: 2000, gdp: 1, life: 1 },
  { country: 'B', year: 2005, gdp: 1, life: 1 },
  { country: 'C', year: 2002, gdp: 1, life: 1 },
  { country: 'C', year: 2003, gdp: 1, life: 1 },
];

function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to throw');
}

describe('buildPlaybackMatrix', () => {
  it('builds one Float64Array per key per channel with NaN for absent cells', () => {
    const { matrix, warnings } = build([
      { country: 'France', year: 2001, gdp: 3, life: 80 },
      { country: 'Chad', year: 2000, gdp: 1, life: 50 },
      { country: 'France', year: 2000, gdp: 2, life: 79 },
    ]);
    expect(matrix.periods).toEqual([
      { value: 2000, sortKey: 2000 },
      { value: 2001, sortKey: 2001 },
    ]);
    expect(matrix.keys).toEqual(['Chad', 'France']);
    expect(matrix.values).toEqual({
      x: [Float64Array.of(1, NaN), Float64Array.of(2, 3)],
      y: [Float64Array.of(50, NaN), Float64Array.of(79, 80)],
    });
    expect(matrix.nonPositiveCounts).toEqual({ x: 0, y: 0 });
    expect(warnings).toEqual([]);
  });

  it('takes the last non-null value in time for each static field', () => {
    const { matrix } = build(
      [
        { country: 'A', year: 2002, gdp: 3, life: 1, region: null, name: 'Alpha' },
        { country: 'A', year: 2000, gdp: 1, life: 1, region: 'Asia', name: 'Old name' },
        { country: 'A', year: 2001, gdp: 2, life: 1, region: 'Europe', name: null },
      ],
      { staticFields: ['region', 'name'] },
    );
    expect(matrix.statics).toEqual([{ region: 'Europe', name: 'Alpha' }]);
  });

  it.each([
    ['interpolate', [NaN, 10, 20, 30, 40, NaN], [NaN, 50, 60, 70, 80, NaN]],
    ['hold', [NaN, 10, 10, 10, 40, NaN], [NaN, 50, 50, 50, 80, NaN]],
    ['drop', [NaN, 10, NaN, NaN, 40, NaN], [NaN, 50, NaN, NaN, 80, NaN]],
  ] as const)('fills interior gaps per channel with %s and never fills the ends', (gaps, x, y) => {
    const { matrix } = build(gappy, {}, gaps);
    const a = matrix.keys.indexOf('A');
    expect(Array.from(matrix.values.x[a])).toEqual(x);
    expect(Array.from(matrix.values.y[a])).toEqual(y);
  });

  it('fills a log channel geometrically and counts values <= 0 as absent', () => {
    const { matrix } = build(
      [
        { country: 'A', year: 2000, gdp: 1, life: 1 },
        { country: 'A', year: 2001, gdp: 0, life: 2 },
        { country: 'A', year: 2002, gdp: 100, life: 3 },
        { country: 'B', year: 2000, gdp: -5, life: 4 },
      ],
      {
        channels: [
          { name: 'x', field: 'gdp', log: true },
          { name: 'y', field: 'life' },
        ],
      },
      'interpolate',
    );
    const a = matrix.keys.indexOf('A');
    const b = matrix.keys.indexOf('B');
    expect(matrix.values.x[a][1]).toBeCloseTo(10, 10);
    expect(matrix.values.x[b][0]).toBeNaN();
    expect(Array.from(matrix.values.y[a])).toEqual([1, 2, 3]);
    expect(matrix.nonPositiveCounts).toEqual({ x: 2, y: 0 });
  });

  it('throws DUPLICATE_KEY_PERIOD naming the key and period', () => {
    const rows = [
      { country: 'France', year: 1995, gdp: 1, life: 1 },
      { country: 'France', year: 1995, gdp: 2, life: 2 },
      { country: 'France', year: 1996, gdp: 3, life: 3 },
    ];
    const error = thrown(() => build(rows));
    expect(error).toBeInstanceOf(PlaybackDataError);
    expect(error).toMatchObject({
      code: 'DUPLICATE_KEY_PERIOD',
      message: expect.stringMatching(/country = 'France' and year = 1995/),
    });
  });

  it('returns a one-period matrix unless two periods are required', () => {
    const rows = [{ country: 'A', year: 2000, gdp: 1, life: 1 }];
    expect(build(rows).matrix.periods).toHaveLength(1);
    expect(thrown(() => build(rows, { requireTwoPeriods: true }))).toMatchObject({
      code: 'TOO_FEW_PERIODS',
    });
  });

  it('returns an all-absent matrix unless values are required', () => {
    const rows = [
      { country: 'A', year: 2000, gdp: null, life: null },
      { country: 'A', year: 2001, gdp: null, life: null },
    ];
    expect(build(rows).matrix.values.x).toEqual([Float64Array.of(NaN, NaN)]);
    expect(thrown(() => build(rows, { requireTwoPeriods: true }))).toMatchObject({
      code: 'NO_VALUES',
    });
  });

  it('names the caller noun in the warning for more than 500 keys', () => {
    const rows = Array.from({ length: 501 }, (_, index) => [
      { country: `k${index}`, year: 2000, gdp: 1, life: 1 },
      { country: `k${index}`, year: 2001, gdp: 2, life: 2 },
    ]).flat();
    expect(build(rows).warnings).toEqual([
      expect.stringContaining("501 distinct keys in 'country'"),
    ]);
    expect(build(rows, { noun: 'bars' }).warnings).toEqual([
      expect.stringContaining("501 distinct bars in 'country'"),
    ]);
  });
});
