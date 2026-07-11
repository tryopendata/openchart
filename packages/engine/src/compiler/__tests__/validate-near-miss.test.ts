/**
 * Near-miss validation messages for VL idioms that are unsupported by
 * decision. Each rejection must point the author at the openchart
 * equivalent instead of failing with a generic type error.
 */

import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

const encoding = {
  x: { field: 'cat', type: 'nominal' },
  y: { field: 'value', type: 'quantitative' },
};
const data = [
  { cat: 'A', value: 10 },
  { cat: 'B', value: 20 },
];

describe('near-miss validation messages', () => {
  it('rejects data.url with a pointer to inline data', () => {
    const result = validateSpec({ mark: 'bar', data: { url: '/data.json' }, encoding });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'data.url');
    expect(error?.message).toContain('does not fetch remote data');
    expect(error?.suggestion).toContain('inline');
  });

  it('rejects the string form of calculate with the structured equivalent', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      transform: [{ calculate: 'datum.a / datum.b', as: 'ratio' }],
      encoding,
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'transform[0].calculate');
    expect(error?.message).toContain('structured expression object');
    expect(error?.suggestion).toContain('calculate: { op:');
  });

  it('rejects hconcat/vconcat with the side-by-side containers suggestion', () => {
    for (const key of ['hconcat', 'vconcat']) {
      const result = validateSpec({ [key]: [] });
      expect(result.valid).toBe(false);
      const error = result.errors.find((e) => e.path === key);
      expect(error?.message).toContain(`"${key}" composition is not supported`);
      expect(error?.suggestion).toContain('facet');
    }
  });

  it('rejects the top-level facet operator with the facet channel suggestion', () => {
    const result = validateSpec({
      facet: { field: 'cat', type: 'nominal' },
      spec: { mark: 'bar', encoding },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'facet');
    expect(error?.message).toContain('"facet" operator is not supported');
    expect(error?.suggestion).toContain('encoding.facet');
  });

  it('rejects unknown scheme names with the supported list', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        ...encoding,
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.color.scale.scheme');
    expect(error?.message).toContain('"viridis" is not a supported scheme name');
    expect(error?.suggestion).toContain('blues');
    expect(error?.suggestion).toContain('scale.range');
  });

  it('accepts known scheme names (resolved by sugar before validation on the compile path)', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        ...encoding,
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'blues' } },
      },
    });
    expect(result.errors.filter((e) => e.path === 'encoding.color.scale.scheme')).toHaveLength(0);
  });
});
