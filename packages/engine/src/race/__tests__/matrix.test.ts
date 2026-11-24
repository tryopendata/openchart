import type { DataRow, RaceEncoding } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { RaceDataError } from '../errors';
import { buildRaceMatrix } from '../matrix';

const encoding = {
  time: { field: 'year', type: 'temporal' },
  key: { field: 'country' },
  value: { field: 'gdp', type: 'quantitative' },
} satisfies RaceEncoding;

describe('race matrix', () => {
  it('pivots long rows into key order and sorted temporal years', () => {
    const warnings: string[] = [];
    const rows = [
      { country: 'Zulu', year: 2001, gdp: 0 },
      { country: 'zebra', year: 1999, gdp: 4 },
      { country: 'Zulu', year: 1999, gdp: -7 },
      { country: 'zebra', year: 2001, gdp: 8 },
      { country: 42, year: 2001, gdp: 2 },
    ];

    expect(buildRaceMatrix(rows, encoding, 'drop', (warning) => warnings.push(warning))).toEqual({
      periods: [
        { value: 1999, sortKey: 1999 },
        { value: 2001, sortKey: 2001 },
      ],
      keys: ['42', 'zebra', 'Zulu'],
      labels: ['42', 'zebra', 'Zulu'],
      colorValues: [null, null, null],
      values: [Float64Array.of(NaN, 2), Float64Array.of(4, 8), Float64Array.of(-7, 0)],
    });
    expect(warnings).toEqual([]);
  });

  it('sorts ISO dates, Dates, and years by time while preserving period values', () => {
    const matrix = buildRaceMatrix(
      [
        { country: 'A', year: 2002, gdp: 40 },
        { country: 'A', year: new Date('2001-03-01T12:00:00Z'), gdp: 30 },
        { country: 'A', year: 2000, gdp: 20 },
        { country: 'A', year: '1999-04-15', gdp: 10 },
      ],
      encoding,
      'drop',
      () => {},
    );

    expect(matrix.periods).toEqual([
      { value: '1999-04-15', sortKey: Date.parse('1999-04-15') },
      { value: 2000, sortKey: Date.UTC(2000, 0, 1) },
      { value: '2001-03-01T12:00:00.000Z', sortKey: Date.parse('2001-03-01T12:00:00Z') },
      { value: 2002, sortKey: Date.UTC(2002, 0, 1) },
    ]);
    expect(matrix.values).toEqual([Float64Array.of(10, 20, 30, 40)]);
  });

  it('keeps distinct ISO period values that share an instant', () => {
    const matrix = buildRaceMatrix(
      [
        { country: 'A', year: '2000-01-01', gdp: 4 },
        { country: 'A', year: '2000-01-01T00:00:00Z', gdp: 8 },
      ],
      encoding,
      'drop',
      () => {},
    );

    const sortKey = Date.UTC(2000, 0, 1);
    expect(matrix.periods).toEqual([
      { value: '2000-01-01', sortKey },
      { value: '2000-01-01T00:00:00Z', sortKey },
    ]);
    expect(matrix.values).toEqual([Float64Array.of(4, 8)]);
  });

  it('sorts ISO timestamps without offsets as UTC on a machine outside UTC', () => {
    const previousZone = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      const matrix = buildRaceMatrix(
        [
          { country: 'A', year: '2001-01-01T03:00:00Z', gdp: 8 },
          { country: 'A', year: '2001-01-01T00:00:00', gdp: 4 },
        ],
        encoding,
        'drop',
        () => {},
      );

      expect(matrix.periods).toEqual([
        { value: '2001-01-01T00:00:00', sortKey: Date.UTC(2001, 0, 1) },
        { value: '2001-01-01T03:00:00Z', sortKey: Date.UTC(2001, 0, 1, 3) },
      ]);
      expect(matrix.values).toEqual([Float64Array.of(4, 8)]);
    } finally {
      if (previousZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousZone;
    }
  });

  it.each([
    { sort: undefined, periods: ['medium', 'small', 'large', 'extra'], values: [4, 2, 9, 11] },
    {
      sort: ['large', 'unknown', 'small'],
      periods: ['large', 'small', 'medium', 'extra'],
      values: [9, 2, 4, 11],
    },
  ])('orders ordinal periods with sort $sort', ({ sort, periods, values }) => {
    const matrix = buildRaceMatrix(
      [
        { country: 'A', year: 'medium', gdp: 4 },
        { country: 'A', year: 'small', gdp: 2 },
        { country: 'A', year: 'large', gdp: 9 },
        { country: 'A', year: 'extra', gdp: 11 },
      ],
      { ...encoding, time: { field: 'year', type: 'ordinal', sort } },
      'drop',
      () => {},
    );

    expect(matrix.periods.map(({ value }) => value)).toEqual(periods);
    expect(matrix.values).toEqual([Float64Array.from(values)]);
  });

  it('sorts quantitative periods numerically', () => {
    const matrix = buildRaceMatrix(
      [
        { country: 'A', year: 10, gdp: 30 },
        { country: 'A', year: 2.5, gdp: 20 },
        { country: 'A', year: -1, gdp: 10 },
      ],
      { ...encoding, time: { field: 'year', type: 'quantitative' } },
      'drop',
      () => {},
    );

    expect(matrix.periods).toEqual([
      { value: -1, sortKey: -1 },
      { value: 2.5, sortKey: 2.5 },
      { value: 10, sortKey: 10 },
    ]);
    expect(matrix.values).toEqual([Float64Array.of(10, 20, 30)]);
  });

  it('reports the actual number of rows in the first collision, including absent values', () => {
    const rows = [
      { country: 'B', year: 1995, gdp: 1 },
      { country: 'France', year: 1995, gdp: null },
      { country: 'France', year: 1995, gdp: 2 },
      { country: 'B', year: 1995, gdp: 3 },
      { country: 'France', year: 1995, gdp: 4 },
      { country: 'France', year: 1996, gdp: 8 },
    ];
    expect(() => buildRaceMatrix(rows, encoding, 'drop', () => {})).toThrow(
      expect.objectContaining({
        constructor: RaceDataError,
        code: 'DUPLICATE_KEY_PERIOD',
        message:
          "3 rows have country = 'France' and year = 1995. Aggregate them first so each key has one value per period.",
      }),
    );
  });

  it.each([
    { periodCount: 0, rows: [] },
    {
      periodCount: 1,
      rows: [
        { country: 'A', year: 2000, gdp: 4 },
        { country: 'B', year: 2000, gdp: 8 },
      ],
    },
  ])('rejects $periodCount distinct periods', ({ rows }) => {
    expect(() => buildRaceMatrix(rows, encoding, 'drop', () => {})).toThrow(
      expect.objectContaining({ constructor: RaceDataError, code: 'TOO_FEW_PERIODS' }),
    );
  });

  it('warns once for skipped rows with invalid periods or missing keys', () => {
    const warnings: string[] = [];
    const rows = [
      { country: 'A', year: 'bad period', gdp: 100 },
      { country: null, year: 1999, gdp: 50 },
      { year: 2000, gdp: 60 },
      { country: 0, year: 2001, gdp: 4 },
      { country: 0, year: 2002, gdp: 8 },
    ];

    expect(buildRaceMatrix(rows, encoding, 'drop', (warning) => warnings.push(warning))).toEqual({
      periods: [
        { value: 2001, sortKey: 2001 },
        { value: 2002, sortKey: 2002 },
      ],
      keys: ['0'],
      labels: ['0'],
      colorValues: [null],
      values: [Float64Array.of(4, 8)],
    });
    expect(warnings).toEqual([expect.stringMatching(/\b3\b.*year.*bad period/i)]);
  });

  it('reports the first missing key when a row also has an invalid period', () => {
    const warnings: string[] = [];
    const rows = [
      { country: null, year: 1999, gdp: 5 },
      { year: 'bad period', gdp: 20 },
      { country: 'A', year: 2001, gdp: 4 },
      { country: 'A', year: 2002, gdp: 8 },
    ];

    const matrix = buildRaceMatrix(rows, encoding, 'drop', (warning) => warnings.push(warning));

    expect(matrix.keys).toEqual(['A']);
    expect(warnings).toEqual([expect.stringMatching(/\b2\b.*country.*null/i)]);
  });

  it('suggests an ordinal time encoding when every period label is unparseable', () => {
    const warnings: string[] = [];
    const rows = [
      { country: 'A', year: 'Q1 2020', gdp: 4 },
      { country: 'A', year: 'Q2 2020', gdp: 8 },
    ];
    const run = () =>
      buildRaceMatrix(rows, { ...encoding, time: { field: 'year' } }, 'drop', (warning) =>
        warnings.push(warning),
      );

    expect(run).toThrow(
      expect.objectContaining({
        constructor: RaceDataError,
        code: 'TOO_FEW_PERIODS',
        message: expect.stringMatching(/year.*temporal.*type: 'ordinal'/),
      }),
    );
    expect(warnings).toEqual([expect.stringMatching(/\b2\b.*year.*Q1 2020/i)]);
  });

  it.each([
    { values: [null, null], description: 'null' },
    { values: [NaN, Infinity], description: 'non-finite' },
  ])('rejects a matrix with only $description values', ({ values }) => {
    const rows = values.map((gdp, index) => ({ country: 'A', year: 2000 + index, gdp }));
    expect(() => buildRaceMatrix(rows, encoding, 'interpolate', () => {})).toThrow(
      expect.objectContaining({ constructor: RaceDataError, code: 'NO_VALUES' }),
    );
  });

  it('drops non-finite values and warns once with their count', () => {
    const warnings: string[] = [];
    const rows = [
      { country: 'A', year: 2000, gdp: 10 },
      { country: 'A', year: 2001, gdp: NaN },
      { country: 'A', year: 2002, gdp: Infinity },
      { country: 'A', year: 2003, gdp: -Infinity },
      { country: 'A', year: 2004, gdp: null },
      { country: 'A', year: 2005 },
      { country: 'A', year: 'bad', gdp: Infinity },
    ];
    const matrix = buildRaceMatrix(rows, encoding, 'drop', (warning) => warnings.push(warning));

    expect(matrix.values).toEqual([Float64Array.of(10, NaN, NaN, NaN, NaN, NaN)]);
    expect(warnings).toEqual([
      expect.stringMatching(/\b1\b.*year.*bad/i),
      expect.stringMatching(/\b4\b.*non-finite/i),
    ]);
  });

  it.each([500, 501])('warns above 500 distinct keys with %i keys', (keyCount) => {
    const warnings: string[] = [];
    const rows = Array.from({ length: keyCount }, (_, index) => ({
      country: index,
      year: 2000,
      gdp: index,
    }));
    rows.push({ country: 0, year: 2001, gdp: 1 });
    const matrix = buildRaceMatrix(rows, encoding, 'drop', (warning) => warnings.push(warning));

    expect(matrix.keys).toHaveLength(keyCount);
    expect(warnings).toEqual(keyCount > 500 ? [expect.stringMatching(/\b501\b.*keys/i)] : []);
  });

  it.each([
    { gaps: 'interpolate', expected: [NaN, 6, 10, 14, 18, NaN] },
    { gaps: 'hold', expected: [NaN, 6, 6, 6, 18, NaN] },
    { gaps: 'drop', expected: [NaN, 6, NaN, NaN, 18, NaN] },
  ] satisfies {
    gaps: Parameters<typeof buildRaceMatrix>[2];
    expected: number[];
  }[])('applies $gaps only between finite endpoints by period index', ({ gaps, expected }) => {
    const rows: DataRow[] = [
      { country: 'A', year: 2001, gdp: 6 },
      { country: 'A', year: 2050, gdp: 18 },
      ...[2000, 2001, 2002, 2020, 2050, 2051].map((year) => ({ country: 'B', year, gdp: 1 })),
    ];
    const matrix = buildRaceMatrix(rows, encoding, gaps, () => {});

    expect(matrix.values).toEqual([Float64Array.from(expected), new Float64Array(6).fill(1)]);
  });

  it('uses the last non-null label and color by period and falls back to the key', () => {
    const rows = [
      { country: 'A', year: 2002, gdp: 8, name: null, region: null },
      { country: 'A', year: 2001, gdp: 6, name: 'New', region: 'West' },
      { country: 'A', year: 2000, gdp: 3, name: 'Old', region: 'East' },
      { country: 'B', year: 2002, gdp: 7 },
    ];
    const channels = { ...encoding, label: { field: 'name' }, color: { field: 'region' } };
    const matrix = buildRaceMatrix(rows, channels, 'drop', () => {});
    const constantColor = buildRaceMatrix(
      rows,
      { ...channels, color: { value: '#ff0000' } },
      'drop',
      () => {},
    );

    expect(matrix.labels).toEqual(['New', 'B']);
    expect(matrix.colorValues).toEqual(['West', null]);
    expect(constantColor.colorValues).toEqual([null, null]);
  });
});
