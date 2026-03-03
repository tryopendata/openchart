/**
 * Stable sort for table data.
 *
 * Sorts data by a column key with type-aware comparison:
 * - Numbers: numeric comparison
 * - Strings: localeCompare
 * - Dates: timestamp comparison
 * - Nulls: always sorted last regardless of direction
 */

import type { SortState } from '@opendata-ai/openchart-core';

/** Result of sorting: sorted data rows with their original indices preserved. */
export interface SortResult {
  data: Record<string, unknown>[];
  originalIndices: number[];
}

/**
 * Sort data rows by the specified column.
 * Returns a new array (no mutation). Stable sort preserves
 * original order for rows with equal values.
 *
 * Also returns the original indices so callers can track
 * which row came from where (needed for heatmap/category color lookups).
 */
export function sortData(data: Record<string, unknown>[], sort: SortState): SortResult {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  // Create index-value pairs for stable sort
  const indexed = data.map((row, i) => ({ row, index: i }));

  indexed.sort((a, b) => {
    const aVal = a.row[column];
    const bVal = b.row[column];

    // Nulls always last
    const aNull = aVal == null;
    const bNull = bVal == null;
    if (aNull && bNull) return a.index - b.index; // preserve order
    if (aNull) return 1;
    if (bNull) return -1;

    let cmp = 0;

    // Number comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal;
    }
    // Date comparison
    else if (aVal instanceof Date && bVal instanceof Date) {
      cmp = aVal.getTime() - bVal.getTime();
    }
    // String comparison (or mixed types)
    else {
      cmp = String(aVal).localeCompare(String(bVal));
    }

    // Stable sort: fall back to original index for equal values
    if (cmp === 0) return a.index - b.index;
    return cmp * multiplier;
  });

  return {
    data: indexed.map((item) => item.row),
    originalIndices: indexed.map((item) => item.index),
  };
}
