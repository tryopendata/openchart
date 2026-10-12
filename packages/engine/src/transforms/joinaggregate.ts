/**
 * Join-aggregate transform: group summaries written back onto every row.
 *
 * The one difference from `runAggregate` is the row count. `aggregate`
 * collapses each group to a single row; `joinaggregate` keeps every row and
 * adds the group's summary as a new field on each. That is what makes
 * "this row's share of its group's total" expressible: compute the total with
 * a joinaggregate, then divide with a calculate.
 */

import type { DataRow, JoinAggregateTransform } from '@opendata-ai/openchart-core';

import { aggregateRows, groupKey } from './aggregate';

/**
 * Apply a join-aggregate transform to data rows.
 *
 * @param data - Input rows.
 * @param transform - Join-aggregate definition.
 * @returns New rows, each carrying its group's computed summary fields.
 */
export function runJoinAggregate(data: DataRow[], transform: JoinAggregateTransform): DataRow[] {
  const groupby = transform.groupby ?? [];

  // Bucket rows by group so each group's values are gathered once.
  const groups = new Map<string, DataRow[]>();
  for (const row of data) {
    const key = groupKey(row, groupby);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  // One summary object per group, shared across that group's rows.
  const summaries = new Map<string, Record<string, number | null>>();
  for (const [key, rows] of groups) {
    const summary: Record<string, number | null> = {};
    for (const { op, field, as } of transform.joinaggregate) {
      summary[as] = aggregateRows(op, field, rows);
    }
    summaries.set(key, summary);
  }

  return data.map((row) => ({ ...row, ...summaries.get(groupKey(row, groupby)) }));
}
