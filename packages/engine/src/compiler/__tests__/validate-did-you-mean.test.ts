/**
 * Levenshtein "did you mean" repair hints for misspelled field references.
 *
 * When a spec references a field that is not a column in the provided data,
 * validation suggests the nearest actual column (by edit distance) so an LLM
 * or author can self-correct a typo in one step. Short/unrelated names must
 * NOT produce a spurious suggestion.
 */

import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

const data = [
  { region: 'West', revenue: 100, quarter: '2024-Q1' },
  { region: 'East', revenue: 200, quarter: '2024-Q2' },
];

/** Pull the suggestion for the field-missing error on the given path. */
function suggestionFor(result: ReturnType<typeof validateSpec>, path: string): string {
  const error = result.errors.find((e) => e.path === path);
  return error?.suggestion ?? '';
}

describe('did-you-mean field suggestions', () => {
  it('suggests the nearest column for a one-edit typo in an encoding field', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        x: { field: 'region', type: 'nominal' },
        y: { field: 'reveune', type: 'quantitative' }, // typo of "revenue"
      },
    });
    expect(result.valid).toBe(false);
    const suggestion = suggestionFor(result, 'encoding.y.field');
    expect(suggestion).toContain('Did you mean "revenue"?');
    // The full available-column list is still present alongside the hint.
    expect(suggestion).toContain('revenue');
    expect(suggestion).toContain('region');
  });

  it('does not invent a suggestion for a field with no close match', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        x: { field: 'region', type: 'nominal' },
        y: { field: 'xyzqwerty', type: 'quantitative' },
      },
    });
    expect(result.valid).toBe(false);
    const suggestion = suggestionFor(result, 'encoding.y.field');
    expect(suggestion).not.toContain('Did you mean');
    // Still lists the real columns so the author can pick the right one.
    expect(suggestion).toContain('revenue');
  });

  it('suggests the nearest column for a misspelled table column key', () => {
    const result = validateSpec({
      type: 'table',
      data,
      columns: [{ key: 'quater' }], // typo of "quarter"
    });
    expect(result.valid).toBe(false);
    const suggestion = suggestionFor(result, 'columns[0].key');
    expect(suggestion).toContain('Did you mean "quarter"?');
  });

  it('does not match on a short unrelated field where the edit distance exceeds the threshold', () => {
    const shortData = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    const result = validateSpec({
      mark: 'bar',
      data: shortData,
      encoding: {
        x: { field: 'zzz', type: 'nominal' },
        y: { field: 'a', type: 'quantitative' },
      },
    });
    expect(result.valid).toBe(false);
    const suggestion = suggestionFor(result, 'encoding.x.field');
    expect(suggestion).not.toContain('Did you mean');
  });
});
