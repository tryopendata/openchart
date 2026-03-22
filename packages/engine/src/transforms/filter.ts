/**
 * Filter transform: removes rows that don't match a predicate.
 */

import type { DataRow, FilterPredicate } from '@opendata-ai/openchart-core';
import { evaluatePredicate } from './predicates';

/**
 * Filter data rows by a predicate.
 *
 * @param data - Input rows.
 * @param predicate - Filter predicate to evaluate per row.
 * @returns Rows that pass the predicate.
 */
export function runFilter(data: DataRow[], predicate: FilterPredicate): DataRow[] {
  return data.filter((datum) => evaluatePredicate(datum, predicate));
}
