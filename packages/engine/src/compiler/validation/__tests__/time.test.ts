import { describe, expect, it } from 'vitest';
import { validateSpec } from '../../validate';

const rows = [
  { country: 'France', region: 'Europe', year: 1995, gdp: 20000, life: 78 },
  { country: 'France', region: 'Europe', year: 1996, gdp: 21000, life: 78.4 },
  { country: 'India', region: 'Asia', year: 1995, gdp: 400, life: 61 },
  { country: 'India', region: 'Asia', year: 1996, gdp: 420, life: 61.5 },
];

const scatter = {
  mark: 'point',
  data: rows,
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'life', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'country' },
    time: { field: 'year', type: 'temporal' },
  },
};

// A circle mark is a dot plot: quantitative x against a categorical y.
const dots = {
  mark: 'circle',
  data: rows,
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'country', type: 'nominal' },
    key: { field: 'country' },
    time: { field: 'year', type: 'temporal' },
  },
};

const barRows = [
  { age: '0-4', sex: 'Male', year: 1950, pop: 5 },
  { age: '0-4', sex: 'Female', year: 1950, pop: 4 },
  { age: '0-4', sex: 'Male', year: 1955, pop: 6 },
  { age: '0-4', sex: 'Female', year: 1955, pop: 5 },
];

const bars = {
  mark: 'bar',
  data: barRows,
  encoding: {
    y: { field: 'age', type: 'ordinal' },
    x: { field: 'pop', type: 'quantitative' },
    color: { field: 'sex', type: 'nominal' },
    time: { field: 'year', type: 'temporal' },
  },
};

function errorsOf(spec: unknown) {
  return validateSpec(spec).errors;
}

function messages(spec: unknown): string {
  return errorsOf(spec)
    .map((error) => error.message)
    .join('\n');
}

describe('validateTimeEncoding through validateSpec', () => {
  it('accepts a keyed point or circle chart and an unkeyed bar chart', () => {
    expect(errorsOf(scatter)).toEqual([]);
    expect(errorsOf(dots)).toEqual([]);
    expect(errorsOf(bars)).toEqual([]);
  });

  it.each([
    ['line', { x: { field: 'year', type: 'temporal' } }],
    ['area', { x: { field: 'year', type: 'temporal' } }],
    ['arc', { theta: { field: 'gdp', type: 'quantitative' } }],
  ])('rejects time on a %s mark, naming the supported marks', (mark, channels) => {
    const spec = {
      mark,
      data: rows,
      encoding: {
        y: { field: 'life', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
        key: { field: 'country' },
        time: { field: 'year', type: 'temporal' },
        ...channels,
      },
    };
    const timeError = errorsOf(spec).find((error) => error.path === '/encoding/time');
    expect(timeError).toBeDefined();
    expect(timeError?.message).toMatch(/point/);
    expect(timeError?.message).toMatch(/circle/);
    expect(timeError?.message).toMatch(/bar/);
  });

  it.each([
    ['point', scatter],
    ['circle', dots],
  ])('requires encoding.key on a %s chart with time', (_mark, spec) => {
    const { key: _key, ...encoding } = spec.encoding;
    const errors = errorsOf({ ...spec, encoding });
    expect(errors.map((error) => error.path)).toContain('/encoding/key');
  });

  it('names the duplicated key and period', () => {
    const spec = { ...scatter, data: [...rows, { ...rows[0], gdp: 1 }] };
    const text = messages(spec);
    expect(text).toContain("2 rows have country = 'France' and year = 1995");
    expect(text).toContain('Aggregate them first');
  });

  it('checks duplicates on the derived color|category key for bars', () => {
    expect(messages({ ...bars, data: [...barRows, { ...barRows[0], pop: 9 }] })).toContain(
      '2 rows have',
    );
    // Same category and period on different colors is not a duplicate.
    expect(errorsOf(bars)).toEqual([]);
  });

  it('rejects time with a facet channel', () => {
    const spec = {
      ...scatter,
      encoding: { ...scatter.encoding, facet: { field: 'region', type: 'nominal' } },
    };
    expect(errorsOf(spec).some((error) => /facet/i.test(error.message))).toBe(true);
  });

  it('rejects time inside a layer', () => {
    const spec = {
      data: rows,
      layer: [
        {
          mark: 'point',
          encoding: scatter.encoding,
        },
      ],
    };
    expect(errorsOf(spec).some((error) => /layer/i.test(error.message))).toBe(true);
  });

  it('rejects time with youDrawIt', () => {
    const spec = { ...scatter, youDrawIt: { from: 1995 } };
    expect(errorsOf(spec).some((error) => /youDrawIt/.test(error.message))).toBe(true);
  });

  it('rejects an authored trendline on a time spec', () => {
    const spec = { ...scatter, mark: { type: 'point', trendline: true } };
    expect(errorsOf(spec).some((error) => /trendline/.test(error.message))).toBe(true);
  });

  it('rejects playback.trails and playback.labels on a bar chart', () => {
    const spec = { ...bars, playback: { trails: true, labels: ['0-4'] } };
    const paths = errorsOf(spec).map((error) => error.path);
    expect(paths).toContain('/playback/trails');
    expect(paths).toContain('/playback/labels');
  });

  it('rejects an aggregate whose groupby drops the time field, naming the field', () => {
    const spec = {
      ...scatter,
      transform: [
        {
          aggregate: [
            { op: 'mean', field: 'gdp', as: 'gdp' },
            { op: 'mean', field: 'life', as: 'life' },
          ],
          groupby: ['country', 'region'],
        },
      ],
    };
    const error = errorsOf(spec).find((e) => /aggregate/i.test(e.message));
    expect(error?.message).toContain('year');
  });

  it('accepts an aggregate that keeps the time field', () => {
    const spec = {
      ...scatter,
      transform: [
        {
          aggregate: [
            { op: 'mean', field: 'gdp', as: 'gdp' },
            { op: 'mean', field: 'life', as: 'life' },
          ],
          groupby: ['country', 'region', 'year'],
        },
      ],
    };
    expect(errorsOf(spec)).toEqual([]);
  });

  it('validates the playback block on a time spec', () => {
    const errors = errorsOf({ ...scatter, playback: { duration: 1000, step: 100, speed: 2 } });
    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining(['/playback', '/playback/speed']),
    );
  });

  it('treats fewer than two periods as valid (the compile warns instead)', () => {
    expect(errorsOf({ ...scatter, data: rows.filter((row) => row.year === 1995) })).toEqual([]);
    // Empty data stays EMPTY_DATA, as for every chart.
    expect(errorsOf({ ...scatter, data: [] }).map((error) => error.code)).toEqual(['EMPTY_DATA']);
  });

  it.each([
    ['y', { y: { field: 'region', type: 'nominal' } }],
    ['x', { x: { field: 'region', type: 'nominal' } }],
  ])('rejects playback.trails when %s is not quantitative', (channel, override) => {
    const spec = {
      ...scatter,
      encoding: { ...scatter.encoding, ...override },
      playback: { trails: true },
    };
    const error = errorsOf(spec).find((e) => e.path === '/playback/trails');
    expect(error?.message).toContain(`${channel} is not quantitative`);
    expect(errorsOf({ ...spec, playback: { trails: false } })).toEqual([]);
  });

  it.each([
    ['row', '/encoding/row'],
    ['column', '/encoding/column'],
  ])('rejects time with a %s facet channel at its path', (channel, path) => {
    const spec = {
      ...scatter,
      encoding: { ...scatter.encoding, [channel]: { field: 'region', type: 'nominal' } },
    };
    const error = errorsOf(spec).find((e) => e.path === path);
    expect(error?.message).toMatch(/facet/);
  });

  it('keeps the year 2020 and the string "2020" apart as periods', () => {
    const mixed = [
      { country: 'France', region: 'Europe', year: 2020, gdp: 1, life: 70 },
      { country: 'France', region: 'Europe', year: '2020', gdp: 2, life: 71 },
    ];
    const spec = {
      ...scatter,
      data: mixed,
      encoding: { ...scatter.encoding, time: { field: 'year', type: 'ordinal' } },
    };
    expect(messages(spec)).not.toContain('rows have');
  });

  it('adds nothing for a spec without time', () => {
    const { time: _time, key: _key, ...encoding } = scatter.encoding;
    expect(errorsOf({ ...scatter, encoding, data: [...rows, rows[0]] })).toEqual([]);
  });
});
