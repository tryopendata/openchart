import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../../compiler/types';
import { validateGeoMapTime, validateTileMapTime } from '../../compiler/validation/geo-time';

const TIME = { field: 'month', type: 'temporal' };

function tileErrors(overrides: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  validateTileMapTime(
    {
      type: 'tilemap',
      data: [
        { code: 'CA', month: '2020-01-01', rate: 2, party: 'D' },
        { code: 'CA', month: '2020-02-01', rate: 3, party: 'D' },
      ],
      encoding: {
        state: { field: 'code', type: 'nominal' },
        value: { field: 'rate', type: 'quantitative' },
        time: TIME,
        ...overrides,
      },
    },
    errors,
  );
  return errors;
}

const paths = (errors: ValidationError[]) => errors.map(({ path }) => path);

describe('tile map time validation', () => {
  it('accepts a value field without a type, as the static tile map does', () => {
    expect(tileErrors({ value: { field: 'rate' } })).toEqual([]);
  });

  it('rejects an explicitly non-quantitative value', () => {
    expect(paths(tileErrors({ value: { field: 'party', type: 'nominal' } }))).toEqual([
      '/encoding/value',
    ]);
  });

  it('reports categorical color on its own path', () => {
    const errors = tileErrors({ color: { field: 'party', type: 'nominal' } });
    expect(paths(errors)).toEqual(['/encoding/color']);
    expect(errors[0].message).toMatch(/encoding\.color/);
  });

  it('reports categorical colors on /colors', () => {
    const errors: ValidationError[] = [];
    validateTileMapTime(
      {
        type: 'tilemap',
        data: [],
        colors: { D: '#00f' },
        encoding: {
          state: { field: 'code' },
          value: { field: 'rate', type: 'quantitative' },
          time: TIME,
        },
      },
      errors,
    );
    expect(paths(errors)).toEqual(['/colors']);
  });
});

describe('map duplicate key-period validation', () => {
  it('counts the colliding rows, quotes the period, and reads periods as the matrix does', () => {
    const errors: ValidationError[] = [];
    validateTileMapTime(
      {
        type: 'tilemap',
        data: [
          { code: 'CA', month: '2020-01-01', rate: 2 },
          { code: 'CA', month: new Date(Date.UTC(2020, 0, 1)), rate: 3 },
          { code: 'CA', month: new Date(Date.UTC(2020, 0, 1)), rate: 4 },
          { code: 'CA', month: new Date(Date.UTC(2020, 0, 1)), rate: 5 },
        ],
        encoding: {
          state: { field: 'code' },
          value: { field: 'rate', type: 'quantitative' },
          time: TIME,
        },
      },
      errors,
    );
    expect(errors.map(({ path, message }) => ({ path, message }))).toEqual([
      {
        path: '/data',
        message:
          "Spec error: 3 rows have code = 'CA' and month = '2020-01-01T00:00:00.000Z'. Aggregate them first.",
      },
    ]);
  });

  it('treats values that read as different periods as distinct', () => {
    const errors: ValidationError[] = [];
    validateTileMapTime(
      {
        type: 'tilemap',
        data: [
          { code: 'CA', month: 2020, rate: 2 },
          { code: 'CA', month: '2020', rate: 3 },
        ],
        encoding: {
          state: { field: 'code' },
          value: { field: 'rate', type: 'quantitative' },
          time: TIME,
        },
      },
      errors,
    );
    expect(errors).toEqual([]);
  });
});

describe('geo map layers with different time types', () => {
  it('rejects choropleth and points time of different types, naming both paths', () => {
    const errors: ValidationError[] = [];
    validateGeoMapTime(
      {
        type: 'map',
        data: [{ fips: '06', month: '2020-01-01', rate: 2 }],
        encoding: {
          key: { field: 'fips' },
          color: { field: 'rate', type: 'quantitative' },
          time: TIME,
        },
        points: {
          data: [{ city: 'A', lon: -97, lat: 30, step: 1 }],
          key: { field: 'city' },
          time: { field: 'step', type: 'quantitative' },
        },
      },
      errors,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('/points/time/type');
    expect(errors[0].message).toMatch(/encoding\.time.*temporal.*points\.time.*quantitative/);
  });
});
