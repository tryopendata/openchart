/**
 * Aggregate transform: groups rows and computes summary statistics.
 *
 * Follows Vega-Lite aggregate transform conventions.
 * Groups input data by the specified fields, then applies aggregate
 * operations (sum, mean, count, etc.) to produce one row per group.
 */

import type { AggregateOp, AggregateTransform, DataRow } from '@opendata-ai/openchart-core';

/**
 * Compute a single aggregate operation over an array of numeric values.
 */
function computeAggregate(op: AggregateOp, values: number[]): number {
  if (values.length === 0) return 0;

  switch (op) {
    case 'count':
      return values.length;
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'mean': {
      const sum = values.reduce((a, b) => a + b, 0);
      return sum / values.length;
    }
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'variance': {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    }
    case 'stdev': {
      const m = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length);
    }
    case 'q1': {
      const s = [...values].sort((a, b) => a - b);
      const i = (s.length - 1) * 0.25;
      const lo = Math.floor(i);
      const frac = i - lo;
      return s[lo] + frac * ((s[lo + 1] ?? s[lo]) - s[lo]);
    }
    case 'q3': {
      const s = [...values].sort((a, b) => a - b);
      const i = (s.length - 1) * 0.75;
      const lo = Math.floor(i);
      const frac = i - lo;
      return s[lo] + frac * ((s[lo + 1] ?? s[lo]) - s[lo]);
    }
    default:
      return 0;
  }
}

/**
 * Build a composite group key from a row's groupby field values.
 */
function groupKey(row: DataRow, groupby: string[]): string {
  return groupby.map((f) => String(row[f] ?? '')).join('\x00');
}

/**
 * Apply an aggregate transform to data rows.
 *
 * Groups rows by the groupby fields, then computes each aggregate
 * operation within each group. Returns one row per group containing
 * the groupby field values plus computed aggregate fields.
 *
 * @param data - Input rows.
 * @param transform - Aggregate transform definition.
 * @returns Aggregated rows (one per group).
 */
export function runAggregate(data: DataRow[], transform: AggregateTransform): DataRow[] {
  const { aggregate, groupby } = transform;

  // Group rows by the groupby fields
  const groups = new Map<string, DataRow[]>();
  for (const row of data) {
    const key = groupKey(row, groupby);
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  // Compute aggregates for each group
  const result: DataRow[] = [];
  for (const rows of groups.values()) {
    // Start with groupby field values from the first row in the group
    const outRow: DataRow = {};
    for (const field of groupby) {
      outRow[field] = rows[0][field];
    }

    // Compute each aggregate operation
    for (const agg of aggregate) {
      // distinct counts unique raw values (not just numeric)
      if (agg.op === 'distinct') {
        outRow[agg.as] = new Set(rows.map((r) => r[agg.field])).size;
        continue;
      }

      const values = rows
        .map((r) => {
          // For count, the field value doesn't matter, just count rows
          if (agg.op === 'count') return 1;
          const v = Number(r[agg.field]);
          return Number.isFinite(v) ? v : NaN;
        })
        .filter((v) => !Number.isNaN(v));

      outRow[agg.as] = computeAggregate(agg.op, values);
    }

    result.push(outRow);
  }

  return result;
}
