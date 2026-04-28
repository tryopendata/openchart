/**
 * Window transform: computes values relative to other rows in sort order
 * within a partition (lag, lead, diff, pct_change, cumsum, rank, first_value).
 *
 * Follows the same grouping pattern as aggregate.ts, but preserves all
 * input rows and appends computed fields rather than collapsing groups.
 */

import type { DataRow, WindowTransform } from '@opendata-ai/openchart-core';

/**
 * Build a composite group key from a row's groupby field values.
 * Uses null-char delimiter (same convention as aggregate.ts).
 */
function groupKey(row: DataRow, groupby: string[]): string {
  return groupby.map((f) => String(row[f] ?? '')).join('\x00');
}

/**
 * Try to parse a value as a date, returning its timestamp if valid.
 * Only recognizes ISO-8601 strings (must contain '-' or 'T') and numeric timestamps.
 * Bare numeric strings like "9" or "100" are not treated as dates.
 */
function tryParseDate(val: unknown): number {
  if (val == null) return NaN;
  if (typeof val === 'number') return new Date(val).getTime();
  if (typeof val === 'string' && (val.includes('-') || val.includes('T'))) {
    const ms = new Date(val).getTime();
    return ms;
  }
  return NaN;
}

/**
 * Type-aware comparison for sorting:
 * 1. Try ISO date parsing first
 * 2. If both are numeric, compare as numbers
 * 3. Otherwise lexicographic string comparison
 */
function compareValues(a: unknown, b: unknown, order: 'ascending' | 'descending'): number {
  const dir = order === 'descending' ? -1 : 1;

  // Try dates first
  const dateA = tryParseDate(a);
  const dateB = tryParseDate(b);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
    return dir * (dateA - dateB);
  }

  // Try numeric comparison
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) {
    return dir * (numA - numB);
  }

  // Fallback to string comparison
  return dir * String(a ?? '').localeCompare(String(b ?? ''));
}

/**
 * Apply a window transform to data rows.
 *
 * Groups rows by the groupby fields, sorts within each group, computes
 * window operations, then returns all rows in their original input order
 * with computed fields appended.
 *
 * @param data - Input rows.
 * @param transform - Window transform definition.
 * @returns Rows with computed window fields appended.
 */
export function runWindow(data: DataRow[], transform: WindowTransform): DataRow[] {
  if (data.length === 0) return [];

  const { window: windowDefs, sort, groupby = [] } = transform;

  // Track original indices so we can restore input order
  const indexed = data.map((row, i) => ({ row, originalIndex: i }));

  // Group rows by groupby fields
  const groups = new Map<string, { row: DataRow; originalIndex: number }[]>();
  for (const entry of indexed) {
    const key = groupby.length > 0 ? groupKey(entry.row, groupby) : '';
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  // Build result array indexed by original position
  const result: DataRow[] = new Array(data.length);

  for (const groupEntries of groups.values()) {
    // Sort the group entries by the sort fields
    const sorted = [...groupEntries].sort((a, b) => {
      for (const s of sort) {
        const cmp = compareValues(a.row[s.field], b.row[s.field], s.order ?? 'ascending');
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    // Compute window operations for each row in sorted order
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const outRow: DataRow = { ...entry.row };

      for (const def of windowDefs) {
        const offset = def.offset ?? 1;
        let computed: unknown = null;

        switch (def.op) {
          case 'lag': {
            const lagIdx = i - offset;
            computed = lagIdx >= 0 ? (sorted[lagIdx].row[def.field] ?? null) : null;
            break;
          }
          case 'lead': {
            const leadIdx = i + offset;
            computed = leadIdx < sorted.length ? (sorted[leadIdx].row[def.field] ?? null) : null;
            break;
          }
          case 'diff': {
            const lagIdx = i - offset;
            if (lagIdx >= 0) {
              const current = Number(entry.row[def.field]);
              const lagged = Number(sorted[lagIdx].row[def.field]);
              computed =
                Number.isFinite(current) && Number.isFinite(lagged) ? current - lagged : null;
            }
            break;
          }
          case 'pct_change': {
            const lagIdx = i - offset;
            if (lagIdx >= 0) {
              const current = Number(entry.row[def.field]);
              const lagged = Number(sorted[lagIdx].row[def.field]);
              if (Number.isFinite(current) && Number.isFinite(lagged) && lagged !== 0) {
                computed = (current - lagged) / lagged;
              }
            }
            break;
          }
          case 'cumsum': {
            const val = Number(entry.row[def.field]);
            const addend = Number.isFinite(val) ? val : 0;
            if (i === 0) {
              computed = addend;
            } else {
              const prev = Number(result[sorted[i - 1].originalIndex]?.[def.as] ?? 0);
              computed = prev + addend;
            }
            break;
          }
          case 'rank': {
            let rank = i + 1;
            for (let j = 0; j < i; j++) {
              const isTie = sort.every(
                (s) => String(sorted[j].row[s.field]) === String(entry.row[s.field]),
              );
              if (isTie) {
                rank = result[sorted[j].originalIndex]?.[def.as] as number;
                break;
              }
            }
            computed = rank;
            break;
          }
          case 'first_value': {
            computed = sorted[0].row[def.field] ?? null;
            break;
          }
        }

        outRow[def.as] = computed;
      }

      result[entry.originalIndex] = outRow;
    }
  }

  return result;
}
