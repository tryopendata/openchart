import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const data = [
  { date: '2020', country: 'Germany', value: 100 },
  { date: '2020', country: 'France', value: 90 },
  { date: '2020', country: 'Italy', value: 80 },
  { date: '2021', country: 'Germany', value: 110 },
  { date: '2021', country: 'France', value: 95 },
  { date: '2021', country: 'Italy', value: 85 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSpec — highlight channel', () => {
  it('accepts highlight on a nominal color channel with valid values', () => {
    const result = validateSpec({
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal', highlight: ['Germany'] },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts highlight as a single string (not array)', () => {
    const result = validateSpec({
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal', highlight: 'Germany' },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts highlight with multiple valid values', () => {
    const result = validateSpec({
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal', highlight: ['Germany', 'France'] },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects highlight on a quantitative color channel', () => {
    const result = validateSpec({
      mark: 'point',
      data: [
        { x: 1, y: 2, temp: 30 },
        { x: 3, y: 4, temp: 50 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 'temp', type: 'quantitative', highlight: ['30'] },
      },
    });
    expect(result.valid).toBe(false);
    const highlightError = result.errors.find((e) => e.message.toLowerCase().includes('highlight'));
    expect(highlightError).toBeDefined();
    // Implementation may use ENCODING_MISMATCH or INVALID_VALUE
    expect(['ENCODING_MISMATCH', 'INVALID_VALUE']).toContain(highlightError!.code);
  });

  it('does not reject highlight with unknown values at the validation level', () => {
    // Unknown highlight values are a warning (surfaced during normalization),
    // not a validation error. The spec should still pass validation.
    const result = validateSpec({
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal', highlight: ['Spain'] },
      },
    });
    expect(result.valid).toBe(true);
  });

  it('does not produce highlight errors when no highlight is specified', () => {
    const result = validateSpec({
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
