/**
 * Table search: build a search index and filter rows by query.
 *
 * The search index concatenates formatted cell values per row so
 * substring matching works across all columns.
 */

import type { ColumnConfig } from '@opendata-ai/core';
import { formatValueForSearch } from './format-cells';

/**
 * Build a search index mapping original data indices to searchable strings.
 * Each row's searchable string is the concatenation of all column values,
 * separated by spaces, lowercased.
 */
export function buildSearchIndex(
  data: Record<string, unknown>[],
  columns: ColumnConfig[],
): Map<number, string> {
  const index = new Map<number, string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const parts: string[] = [];

    for (const col of columns) {
      parts.push(formatValueForSearch(row[col.key], col));
    }

    index.set(i, parts.join(' ').toLowerCase());
  }

  return index;
}

/**
 * Filter data by a search query using the pre-built search index.
 *
 * Returns the filtered data and the original indices of matching rows.
 * Empty query returns all data.
 */
export function filterBySearch(
  data: Record<string, unknown>[],
  query: string,
  searchIndex: Map<number, string>,
  originalIndices: number[],
): { data: Record<string, unknown>[]; indices: number[] } {
  if (!query || query.trim() === '') {
    return { data, indices: originalIndices };
  }

  const lowerQuery = query.toLowerCase();
  const filteredData: Record<string, unknown>[] = [];
  const filteredIndices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const originalIdx = originalIndices[i];
    const searchText = searchIndex.get(originalIdx);
    if (searchText?.includes(lowerQuery)) {
      filteredData.push(data[i]);
      filteredIndices.push(originalIdx);
    }
  }

  return { data: filteredData, indices: filteredIndices };
}
