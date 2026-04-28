/**
 * Filter transform: removes rows that don't match a predicate.
 *
 * Supports RelativeTimeRef values on comparison properties (lt, lte, gt, gte, range).
 * These are resolved against the data extent before filtering.
 */

import type {
  DataRow,
  FieldPredicate,
  FilterPredicate,
  RelativeTimeRef,
} from '@opendata-ai/openchart-core';
import { evaluatePredicate, isRelativeTimeRef } from './predicates';

/**
 * Apply a time offset to a Date, returning the resulting timestamp.
 */
function applyOffset(anchor: Date, offset: number, unit: RelativeTimeRef['unit']): number {
  const d = new Date(anchor.getTime());
  switch (unit) {
    case 'year':
      d.setFullYear(d.getFullYear() + offset);
      break;
    case 'quarter':
      d.setMonth(d.getMonth() + offset * 3);
      break;
    case 'month':
      d.setMonth(d.getMonth() + offset);
      break;
    case 'week':
      d.setDate(d.getDate() + offset * 7);
      break;
    case 'day':
      d.setDate(d.getDate() + offset);
      break;
  }
  return d.getTime();
}

/**
 * Resolve a single RelativeTimeRef against a data array.
 * Scans the field for min/max date values, then applies the offset.
 */
function resolveRef(data: DataRow[], field: string, ref: RelativeTimeRef): number {
  let anchorMs = ref.anchor === 'max' ? -Infinity : Infinity;

  for (const row of data) {
    const val = row[field];
    if (val == null) continue;
    const ms = new Date(val as string | number).getTime();
    if (Number.isNaN(ms)) continue;
    if (ref.anchor === 'max' && ms > anchorMs) anchorMs = ms;
    if (ref.anchor === 'min' && ms < anchorMs) anchorMs = ms;
  }

  if (!Number.isFinite(anchorMs)) return 0;

  return applyOffset(new Date(anchorMs), ref.offset, ref.unit);
}

/**
 * Walk a predicate tree and resolve any RelativeTimeRef values to concrete numbers.
 * Returns a new predicate tree (does not mutate the original).
 */
function resolveRelativeRefs(data: DataRow[], predicate: FilterPredicate): FilterPredicate {
  if ('and' in predicate) {
    return { and: predicate.and.map((p) => resolveRelativeRefs(data, p)) };
  }
  if ('or' in predicate) {
    return { or: predicate.or.map((p) => resolveRelativeRefs(data, p)) };
  }
  if ('not' in predicate) {
    return { not: resolveRelativeRefs(data, predicate.not) };
  }

  // FieldPredicate: check each comparison property for RelativeTimeRef
  if ('field' in predicate) {
    const fp = predicate as FieldPredicate;
    let needsCopy = false;
    const resolved: Partial<FieldPredicate> = {};

    for (const prop of ['lt', 'lte', 'gt', 'gte'] as const) {
      if (isRelativeTimeRef(fp[prop])) {
        resolved[prop] = resolveRef(data, fp.field, fp[prop] as RelativeTimeRef);
        needsCopy = true;
      }
    }

    if (fp.range) {
      const [lo, hi] = fp.range;
      const loResolved = isRelativeTimeRef(lo) ? resolveRef(data, fp.field, lo) : lo;
      const hiResolved = isRelativeTimeRef(hi) ? resolveRef(data, fp.field, hi) : hi;
      if (isRelativeTimeRef(lo) || isRelativeTimeRef(hi)) {
        resolved.range = [loResolved as number, hiResolved as number];
        needsCopy = true;
      }
    }

    if (needsCopy) {
      return { ...fp, ...resolved };
    }
  }

  return predicate;
}

/**
 * Filter data rows by a predicate.
 *
 * If the predicate contains RelativeTimeRef values, they are resolved
 * against the data extent first, then the standard evaluatePredicate
 * logic runs per-row.
 *
 * @param data - Input rows.
 * @param predicate - Filter predicate to evaluate per row.
 * @returns Rows that pass the predicate.
 */
export function runFilter(data: DataRow[], predicate: FilterPredicate): DataRow[] {
  const resolved = resolveRelativeRefs(data, predicate);
  return data.filter((datum) => evaluatePredicate(datum, resolved));
}
