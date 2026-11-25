import { describe, expect, it } from 'vitest';
import { buildPlaybackMatrix } from '../matrix';

describe('playback matrix row counts', () => {
  it('counts non-positive log values only on rows that reach the matrix', () => {
    const warnings: string[] = [];
    const matrix = buildPlaybackMatrix(
      [
        { country: 'A', year: 2000, gdp: 0 },
        { country: 'A', year: 2001, gdp: 10 },
        { country: null, year: 2001, gdp: -5 },
        { country: 'B', year: 'not a year', gdp: Infinity },
      ],
      {
        identity: 'country',
        time: { field: 'year', type: 'temporal' },
        channels: [{ name: 'x', field: 'gdp', log: true }],
      },
      'drop',
      (message) => warnings.push(message),
    );

    expect(matrix.nonPositiveCounts).toEqual({ x: 1 });
    expect(matrix.values.x).toEqual([Float64Array.of(NaN, 10)]);
    expect(warnings).toEqual([
      "Skipped 2 rows. In the first skipped row, 'country' has a missing key 'null'.",
      "Dropped 1 non-finite values from 'gdp'.",
    ]);
  });
});
