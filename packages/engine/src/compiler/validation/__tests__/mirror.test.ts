import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import { validateSpec } from '../../validate';

const data = [
  { age: '0-4', sex: 'Male', pop: 5 },
  { age: '0-4', sex: 'Female', pop: 4 },
  { age: '5-9', sex: 'Male', pop: 6 },
  { age: '5-9', sex: 'Female', pop: 5 },
];

const pyramid = {
  mark: { type: 'bar', mirror: true },
  data,
  encoding: {
    y: { field: 'age', type: 'ordinal' },
    x: { field: 'pop', type: 'quantitative' },
    color: { field: 'sex', type: 'nominal' },
  },
};

function errorsOf(spec: unknown) {
  return validateSpec(spec).errors;
}

describe('validateMirror through validateSpec', () => {
  it('accepts a horizontal mirrored bar with a two-valued color field', () => {
    expect(errorsOf(pyramid)).toEqual([]);
  });

  it('rejects mirror without a color field', () => {
    const { color: _color, ...encoding } = pyramid.encoding;
    const errors = errorsOf({ ...pyramid, encoding });
    expect(
      errors.some((error) => /mirror/.test(error.message) && /color/.test(error.message)),
    ).toBe(true);
  });

  it.each([
    ['one value', data.map((row) => ({ ...row, sex: 'All' }))],
    ['three values', [...data, { age: '0-4', sex: 'Other', pop: 1 }]],
  ])('rejects a color field with %s, giving the count', (_label, rows) => {
    const errors = errorsOf({ ...pyramid, data: rows });
    const error = errors.find((e) => e.path === '/encoding/color');
    expect(error?.message).toMatch(/exactly two/);
  });

  it('rejects vertical mirrored bars', () => {
    const spec = {
      ...pyramid,
      encoding: {
        x: { field: 'age', type: 'ordinal' },
        y: { field: 'pop', type: 'quantitative' },
        color: { field: 'sex', type: 'nominal' },
      },
    };
    expect(errorsOf(spec).some((error) => /horizontal|vertical/.test(error.message))).toBe(true);
  });

  it.each([
    ['zero', 'zero'],
    ['null', null],
    ['false', false],
    ['true', true],
    ['normalize', 'normalize'],
  ])('rejects an authored stack (%s) with mirror', (_label, stack) => {
    const spec = {
      ...pyramid,
      encoding: { ...pyramid.encoding, x: { ...pyramid.encoding.x, stack } },
    };
    expect(errorsOf(spec).map((error) => error.path)).toContain('/encoding/x/stack');
  });

  it('counts sides after transforms: a filter that removes a third value passes', () => {
    const withTotal = [...data, { age: '0-4', sex: 'Total', pop: 9 }];
    const spec = {
      ...pyramid,
      data: withTotal,
      transform: [{ filter: { field: 'sex', oneOf: ['Male', 'Female'] } }],
    };
    expect(errorsOf(spec)).toEqual([]);
    const warnings: string[] = [];
    compileChart(spec as ChartSpec, { width: 600, height: 400, onWarn: (m) => warnings.push(m) });
    expect(warnings.filter((m) => /mirror/.test(m))).toEqual([]);
  });

  it('warns when the transformed data does not have exactly two sides', () => {
    const withTotal = [...data, { age: '0-4', sex: 'Total', pop: 9 }];
    const spec = {
      ...pyramid,
      data: withTotal,
      transform: [{ filter: { field: 'pop', gte: 0 } }],
    };
    expect(errorsOf(spec)).toEqual([]);
    const warnings: string[] = [];
    compileChart(spec as ChartSpec, { width: 600, height: 400, onWarn: (m) => warnings.push(m) });
    expect(warnings.filter((m) => /mirror/.test(m))).toEqual([
      'mark.mirror needs a color field with exactly two values; after transforms "sex" has 3 (Male, Female, Total). Filter the rows to two groups.',
    ]);
  });

  it('adds nothing for an ordinary stacked bar chart', () => {
    expect(errorsOf({ ...pyramid, mark: 'bar' })).toEqual([]);
    expect(errorsOf({ ...pyramid, mark: { type: 'bar', mirror: false } })).toEqual([]);
  });
});
