import {
  isChartSpec,
  type LayerSpec,
  type RaceMarkType,
  type RaceSpec,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { RACE_RENDERERS } from '../../../../vanilla/src/race/renderers';
import { compileChart } from '../../compile';
import { expandSpecSugar } from '../../compile/spec-sugar';
import { normalizeSpec } from '../../compiler/normalize';
import { validateSpec } from '../../compiler/validate';
import { RaceDataError } from '../errors';
import { RACE_MARKS } from '../marks';

const spec = {
  type: 'race',
  data: [
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
  ],
  mark: { type: 'line', window: 'all' },
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
} satisfies RaceSpec;

const layered = {
  layer: [
    {
      ...spec,
      encoding: {
        ...spec.encoding,
        key: { ...spec.encoding.key, type: 'nominal' },
        x: { field: 'year', type: 'temporal' },
        y: { field: 'gdp', type: 'quantitative' },
      },
    },
  ],
} satisfies LayerSpec;

describe('race registration', () => {
  const marks: RaceMarkType[] = ['bar', 'line', 'table'];

  it.each(marks)('registers the %s layout and renderer', (mark) => {
    expect(RACE_MARKS[mark]).toEqual({
      computeStatic: expect.any(Function),
      geometry: expect.any(Function),
    });
    expect(RACE_RENDERERS[mark]).toEqual(expect.any(Function));
  });

  it('accepts race mark options without chart validation', () => {
    expect(validateSpec(spec)).toEqual({ valid: true, errors: [], normalized: spec });
    expect(isChartSpec(spec)).toBe(false);
  });

  it('passes the race spec through sugar expansion unchanged', () => {
    expect(expandSpecSugar(spec)).toBe(spec);
  });

  it('rejects race specs at the chart entry point', () => {
    expect(() => compileChart(spec, { width: 800, height: 500 })).toThrow(
      'compileChart received a race spec. Use prepareRace and layoutRace instead.',
    );
  });

  it('reports a race layer child at its type field', () => {
    expect(validateSpec(layered)).toEqual({
      valid: false,
      normalized: null,
      errors: [
        {
          code: 'INVALID_VALUE',
          path: '/layer/0/type',
          message: 'Race specs cannot be layered.',
          suggestion: 'Render the race in its own container.',
        },
      ],
    });
  });

  it('rejects race layer children before chart sugar', () => {
    expect(() => expandSpecSugar(layered)).toThrow('Race specs cannot be layered.');
  });

  it('rejects race layer children before chart normalization', () => {
    expect(() => normalizeSpec(layered)).toThrow('Race specs cannot be layered.');
  });

  it('exposes typed race data errors', () => {
    const error = new RaceDataError('NO_VALUES', 'x');

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: 'NO_VALUES', name: 'RaceDataError', message: 'x' });
  });
});
