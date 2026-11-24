import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../../types';
import { validateRaceSpec } from '../race';

const spec = {
  type: 'race',
  data: [
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
  mark: 'bar',
};

function validate(overrides: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  validateRaceSpec({ ...spec, ...overrides }, errors);
  return errors;
}

function expectError(
  overrides: Record<string, unknown>,
  path: string,
  code: ValidationError['code'],
  problem: string,
  fix: string,
): void {
  expect(validate(overrides)).toEqual([
    {
      path,
      code,
      message: expect.stringContaining(problem),
      suggestion: expect.stringContaining(fix),
    },
  ]);
}

describe('race spec validation', () => {
  it.each([undefined, { values: spec.data }])('requires a data array for %j', (data) => {
    expectError({ data }, '/data', 'INVALID_TYPE', '"data" array', 'array of rows');
  });

  it('rejects a null row before normalization can infer the time type', () => {
    const encoding = { ...spec.encoding, time: { field: 'year' } };
    expectError(
      { data: [null, ...spec.data], encoding },
      '/data/0',
      'INVALID_TYPE',
      'row must be an object',
      'Replace or remove row 1',
    );
  });

  it('rejects a hole in a data array', () => {
    const data = [...spec.data];
    data.length += 1;
    expectError(
      { data },
      '/data/2',
      'INVALID_TYPE',
      'row must be an object',
      'Replace or remove row 3',
    );
  });

  it('requires an encoding object', () => {
    expectError(
      { encoding: undefined },
      '/encoding',
      'MISSING_FIELD',
      '"encoding" object',
      'time, key, and value',
    );
  });

  it('rejects an array in place of an encoding object', () => {
    expectError(
      { encoding: [] },
      '/encoding',
      'INVALID_TYPE',
      '"encoding" object',
      'time, key, and value',
    );
  });

  it.each(['time', 'key', 'value'])('requires the %s channel', (channel) => {
    expectError(
      { encoding: { ...spec.encoding, [channel]: undefined } },
      `/encoding/${channel}`,
      'MISSING_FIELD',
      `"${channel}" channel`,
      `Add encoding.${channel}`,
    );
  });

  it.each(['time', 'key', 'value'])('requires a field on the %s channel', (channel) => {
    expectError(
      { encoding: { ...spec.encoding, [channel]: {} } },
      `/encoding/${channel}/field`,
      'MISSING_FIELD',
      'non-empty "field" string',
      'a column in your data',
    );
  });

  it('rejects a shorthand string in place of a channel object', () => {
    expectError(
      { encoding: { ...spec.encoding, key: 'country' } },
      '/encoding/key',
      'INVALID_TYPE',
      'encoding.key must be an object',
      'field: "country"',
    );
  });

  it.each(['', '  ', 42])('requires the channel field to be a non-blank string (%j)', (field) => {
    expectError(
      { encoding: { ...spec.encoding, key: { field } } },
      '/encoding/key/field',
      'INVALID_TYPE',
      'non-empty "field" string',
      'a column in your data',
    );
  });

  it('requires an explicitly typed value channel to be quantitative', () => {
    expectError(
      { encoding: { ...spec.encoding, value: { field: 'gdp', type: 'nominal' } } },
      '/encoding/value/type',
      'ENCODING_MISMATCH',
      'must be "quantitative"',
      'rank a numeric column',
    );
  });

  it('rejects an unsupported time type', () => {
    expectError(
      { encoding: { ...spec.encoding, time: { field: 'year', type: 'date' } } },
      '/encoding/time/type',
      'ENCODING_MISMATCH',
      '"temporal", "ordinal", or "quantitative"',
      '"temporal" for dates or years',
    );
  });

  it.each([
    ['column', '/mark', 'INVALID_VALUE'],
    [{ type: 'point' }, '/mark/type', 'INVALID_VALUE'],
    [{}, '/mark/type', 'MISSING_FIELD'],
    [undefined, '/mark', 'MISSING_FIELD'],
    [[], '/mark', 'INVALID_TYPE'],
  ] satisfies [
    unknown,
    string,
    ValidationError['code'],
  ][])('rejects race mark %j', (mark, path, code) => {
    expectError({ mark }, path, code, '"bar", "line", or "table"', 'mark: "bar"');
  });

  it.each([
    ['bar', 'window', 'all', 'cornerRadius'],
    ['line', 'columns', ['name'], 'window'],
    ['table', 'cornerRadius', 3, 'columns'],
  ])('rejects %s mark option %s and lists the supported option', (type, option, value, allowed) => {
    expectError(
      { mark: { type, [option]: value } },
      `/mark/${option}`,
      'INVALID_VALUE',
      `"${option}"`,
      `supports "${allowed}"`,
    );
  });

  it.each([
    [
      { type: 'bar', cornerRadius: 'pill' },
      'cornerRadius',
      'non-negative number of pixels',
      'cornerRadius: 4',
    ],
    [{ type: 'line', window: { periods: 3 } }, 'window', '"reveal" or "all"', 'Use "reveal"'],
    [
      { type: 'table', columns: ['name', 'country'] },
      'columns',
      'supported table column names',
      '"rank", "change", "name", "bar", "value", "share"',
    ],
  ])('rejects an unsupported value for a known mark option %j', (mark, option, problem, fix) => {
    expectError({ mark }, `/mark/${option}`, 'INVALID_VALUE', problem, fix);
  });

  it('requires the race options to be an object when supplied', () => {
    expectError({ race: null }, '/race', 'INVALID_TYPE', 'must be an object', 'omit race');
  });

  it('rejects setting both duration and step', () => {
    expectError(
      { race: { duration: 12000, step: 700 } },
      '/race',
      'INVALID_VALUE',
      'duration and race.step',
      'Keep duration for the whole race or step for each period',
    );
  });

  it.each([-1, 0, 1.5, Infinity, '10'])('requires top to be a positive integer (%j)', (top) => {
    expectError(
      { race: { top } },
      '/race/top',
      'INVALID_VALUE',
      'integer of at least 1',
      'top: 10',
    );
  });

  it.each([
    ['duration', -1],
    ['duration', 0],
    ['duration', Infinity],
    ['step', -1],
    ['step', 0],
    ['step', Number.NaN],
    ['step', '700'],
  ])('requires %s to be finite and positive (%j)', (option, value) => {
    expectError(
      { race: { [option]: value } },
      `/race/${option}`,
      'INVALID_VALUE',
      'finite number greater than zero',
      `Use ${option}:`,
    );
  });

  it.each([
    ['swap', -1],
    ['swap', Infinity],
    ['holdEnd', -1],
    ['holdEnd', Number.NaN],
  ])('requires %s to be finite and non-negative (%j)', (option, value) => {
    expectError(
      { race: { [option]: value } },
      `/race/${option}`,
      'INVALID_VALUE',
      'finite number of zero or more',
      `Use ${option}: 0`,
    );
  });

  it.each([
    'auto',
    null,
    {},
    { min: '10' },
    { min: Infinity },
  ])('rejects invalid rescale %j', (rescale) => {
    expectError(
      { race: { rescale } },
      '/race/rescale',
      'INVALID_VALUE',
      'a finite min',
      '{ min: 100 }',
    );
  });

  it('rejects an unknown gap policy', () => {
    expectError(
      { race: { gaps: 'skip' } },
      '/race/gaps',
      'INVALID_VALUE',
      '"interpolate", "hold", or "drop"',
      '"drop" to leave values absent',
    );
  });

  it.each([
    ['controls', 'false', 'must be true or false', 'controls: false'],
    ['loop', 1, 'must be true or false', 'loop: false'],
    ['autoplay', 'immediate', '"visible", true, or false', 'true to start immediately'],
    ['summary', true, '"sum" or false', 'Use "sum"'],
    ['period', true, 'false or an object', 'period: { format: "%Y" }'],
  ])('rejects invalid playback option %s', (option, value, problem, fix) => {
    expectError({ race: { [option]: value } }, `/race/${option}`, 'INVALID_VALUE', problem, fix);
  });

  it.each([
    ['format', 2024, 'must be a string', 'format: "%Y"'],
    ['position', 'bottom', 'must be "auto"', 'position: "auto"'],
  ])('rejects invalid period option %s', (option, value, problem, fix) => {
    expectError(
      { race: { period: { [option]: value } } },
      `/race/period/${option}`,
      'INVALID_VALUE',
      problem,
      fix,
    );
  });

  it('rejects transform and tells the author how to prepare their data', () => {
    expect(
      validate({ transform: [{ aggregate: [{ op: 'sum', field: 'gdp', as: 'gdp' }] }] }),
    ).toEqual([
      {
        path: '/transform',
        code: 'INVALID_VALUE',
        message:
          "Race specs don't support transform yet. Aggregate your data to one row per key and period before passing it in.",
        suggestion: 'Remove transform and put the aggregated rows in data.',
      },
    ]);
  });

  it('rejects a present transform even when undefined', () => {
    expectError(
      { transform: undefined },
      '/transform',
      'INVALID_VALUE',
      "don't support transform",
      'Remove transform',
    );
  });

  it('suggests the closest supported race option for a typo', () => {
    expectError(
      { race: { duraton: 12000 } },
      '/race/duraton',
      'INVALID_VALUE',
      'Unknown race option "duraton"',
      'Check the option name and keep its value. Did you mean "duration"?',
    );
  });

  it('escapes unknown option names in JSON Pointer paths', () => {
    expectError(
      { race: { 'pace/~': 700 } },
      '/race/pace~1~0',
      'INVALID_VALUE',
      '"pace/~"',
      'Remove "pace/~"',
    );
  });

  it.each([
    {
      mark: 'bar',
      race: { top: 1, duration: 0.5, swap: 0, holdEnd: 0, rescale: 'frame', gaps: 'interpolate' },
    },
    {
      mark: { type: 'bar', cornerRadius: 3 },
      race: { step: 700.5, swap: 20.5, holdEnd: 100.25, rescale: 'fixed', gaps: 'hold' },
    },
    { mark: { type: 'line', window: 'all' }, race: { rescale: { min: -100 }, gaps: 'drop' } },
    {
      mark: { type: 'table', columns: ['name', 'value'] },
      race: {
        loop: false,
        autoplay: 'visible',
        controls: false,
        period: { format: '%Y' },
        summary: 'sum',
      },
    },
  ])('accepts supported race options and mark %j', (overrides) => {
    expect(validate(overrides)).toEqual([]);
  });

  it.each([
    [
      'line',
      'ordinal',
      { loop: true, controls: true, autoplay: true, period: { position: 'auto' } },
    ],
    ['table', 'quantitative', { autoplay: false, period: false, summary: false }],
  ])('accepts the %s shorthand with %s time and a quantitative value', (mark, type, race) => {
    const encoding = {
      ...spec.encoding,
      time: { ...spec.encoding.time, type },
      value: { field: 'gdp', type: 'quantitative' },
    };
    expect(validate({ mark, encoding, race })).toEqual([]);
  });

  it('reports independent errors without discarding earlier findings', () => {
    const earlier: ValidationError = {
      path: '/other',
      code: 'MISSING_FIELD',
      message: 'An earlier error.',
      suggestion: 'Fix the earlier error.',
    };
    const errors = [earlier];
    validateRaceSpec({ ...spec, data: undefined, mark: 'column', race: { top: 0 } }, errors);
    expect(errors[0]).toEqual(earlier);
    expect(
      errors
        .slice(1)
        .map(({ path }) => path)
        .sort(),
    ).toEqual(['/data', '/mark', '/race/top']);
  });
});
