import { describe, expect, it } from 'vitest';
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

  it('adds nothing for an ordinary stacked bar chart', () => {
    expect(errorsOf({ ...pyramid, mark: 'bar' })).toEqual([]);
    expect(errorsOf({ ...pyramid, mark: { type: 'bar', mirror: false } })).toEqual([]);
  });
});
