/**
 * Fold transform: unpivots wide-format data into long format.
 *
 * Follows Vega-Lite fold transform conventions.
 * For each input row, creates N new rows (one per fold field),
 * copying all non-fold fields and adding key/value columns.
 */

import type { DataRow, FoldTransform } from '@opendata-ai/openchart-core';

/**
 * Apply a fold transform to data rows.
 *
 * For each input row, creates one output row per fold field. Each output
 * row contains all fields from the original row (except the fold fields),
 * plus a key field (the fold field name) and a value field (the fold field value).
 *
 * @param data - Input rows.
 * @param transform - Fold transform definition.
 * @returns Folded rows (N rows per input row, where N = fold fields count).
 */
export function runFold(data: DataRow[], transform: FoldTransform): DataRow[] {
  const { fold } = transform;
  const [keyAs, valueAs] = transform.as ?? ['key', 'value'];
  const foldSet = new Set(fold);

  const result: DataRow[] = [];

  for (const row of data) {
    // Copy all non-fold fields
    const base: DataRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (!foldSet.has(k)) {
        base[k] = v;
      }
    }

    // Create one row per fold field
    for (const field of fold) {
      result.push({
        ...base,
        [keyAs]: field,
        [valueAs]: row[field],
      });
    }
  }

  return result;
}
