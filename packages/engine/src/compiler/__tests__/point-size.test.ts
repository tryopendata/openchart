/**
 * Tests for the Vega-Lite point-size near-miss guard.
 *
 * VL defines point `size` as an area in px^2; openchart's `mark.size` and
 * `encoding.size` ranges are radii in px. Values above the plausibility
 * ceiling are always imported VL area numbers in practice, so they must fail
 * validation with the radius conversion in the suggestion.
 */

import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

const DATA = [
  { spend: 10_266, score: 219.3 },
  { spend: 29_720, score: 214.6 },
];

function scatter(overrides: Record<string, unknown> = {}) {
  return {
    mark: { type: 'point', filled: true },
    data: DATA,
    encoding: {
      x: { field: 'spend', type: 'quantitative' },
      y: { field: 'score', type: 'quantitative' },
    },
    ...overrides,
  };
}

describe('point size validation', () => {
  it('accepts radius-scale mark.size values', () => {
    const result = validateSpec(scatter({ mark: { type: 'point', size: 6 } }));
    expect(result.valid).toBe(true);
  });

  it('accepts the ceiling itself', () => {
    const result = validateSpec(scatter({ mark: { type: 'point', size: 50 } }));
    expect(result.valid).toBe(true);
  });

  it('rejects VL-area mark.size values with the radius conversion', () => {
    const result = validateSpec(scatter({ mark: { type: 'point', size: 110 } }));
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'mark.size');
    expect(error).toBeDefined();
    expect(error?.code).toBe('INVALID_VALUE');
    // sqrt(110 / pi) ~ 5.9 -> 6
    expect(error?.suggestion).toContain('use 6');
    expect(error?.suggestion).toContain('radi');
  });

  it('rejects a VL-area encoding.size.value constant', () => {
    const spec = scatter();
    (spec.encoding as Record<string, unknown>).size = { value: 130 };
    const result = validateSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'encoding.size.value')).toBe(true);
  });

  it('rejects VL-area encoding.size scale ranges', () => {
    const spec = scatter();
    (spec.encoding as Record<string, unknown>).size = {
      field: 'spend',
      type: 'quantitative',
      scale: { range: [80, 900] },
    };
    const result = validateSpec(spec);
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.size.scale.range');
    expect(error).toBeDefined();
  });

  it('accepts radius-scale encoding.size ranges', () => {
    const spec = scatter();
    (spec.encoding as Record<string, unknown>).size = {
      field: 'spend',
      type: 'quantitative',
      scale: { range: [4, 18] },
    };
    expect(validateSpec(spec).valid).toBe(true);
  });

  it('leaves bar mark.size (thickness px) alone', () => {
    const result = validateSpec({
      mark: { type: 'bar', size: 60 },
      data: [
        { state: 'UT', score: 219.3 },
        { state: 'NY', score: 214.6 },
      ],
      encoding: {
        x: { field: 'state', type: 'nominal' },
        y: { field: 'score', type: 'quantitative' },
      },
    });
    expect(result.valid).toBe(true);
  });
});
