/**
 * Predicate evaluation for filter transforms and conditional encoding.
 *
 * Supports field predicates (equal, lt, gt, range, oneOf, valid)
 * and logical combinators (and, or, not).
 */

import type { DataRow, FieldPredicate, FilterPredicate } from '@opendata-ai/openchart-core';

/**
 * Check if a predicate is a FieldPredicate (has a 'field' property).
 */
function isFieldPredicate(pred: FilterPredicate): pred is FieldPredicate {
  return 'field' in pred;
}

/**
 * Evaluate a single field predicate against a datum.
 */
function evaluateFieldPredicate(datum: DataRow, pred: FieldPredicate): boolean {
  const value = datum[pred.field];

  // valid: check for non-null, non-undefined, non-NaN
  if (pred.valid !== undefined) {
    const isValid = value !== null && value !== undefined && !Number.isNaN(value);
    return pred.valid ? isValid : !isValid;
  }

  // equal: use loose equality so "181" == 181 matches across type boundaries
  // (data values may arrive as strings from CSV/JSON parsing)
  if (pred.equal !== undefined) {
    // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality for CSV/JSON type coercion
    return value == pred.equal;
  }

  // Numeric comparisons
  const numValue = Number(value);

  if (pred.lt !== undefined) {
    return numValue < pred.lt;
  }
  if (pred.lte !== undefined) {
    return numValue <= pred.lte;
  }
  if (pred.gt !== undefined) {
    return numValue > pred.gt;
  }
  if (pred.gte !== undefined) {
    return numValue >= pred.gte;
  }

  // range: inclusive [min, max]
  if (pred.range !== undefined) {
    const [min, max] = pred.range;
    return numValue >= min && numValue <= max;
  }

  // oneOf: use loose equality (same rationale as equal above)
  if (pred.oneOf !== undefined) {
    // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality for CSV/JSON type coercion
    return pred.oneOf.some((v) => v == value);
  }

  // No condition specified, default to true
  return true;
}

/**
 * Evaluate a filter predicate (field predicate or logical combinator) against a datum.
 *
 * @param datum - The data row to test.
 * @param predicate - The filter predicate to evaluate.
 * @returns Whether the datum passes the predicate.
 */
export function evaluatePredicate(datum: DataRow, predicate: FilterPredicate): boolean {
  if (isFieldPredicate(predicate)) {
    return evaluateFieldPredicate(datum, predicate);
  }

  if ('and' in predicate) {
    return predicate.and.every((p) => evaluatePredicate(datum, p));
  }

  if ('or' in predicate) {
    return predicate.or.some((p) => evaluatePredicate(datum, p));
  }

  if ('not' in predicate) {
    return !evaluatePredicate(datum, predicate.not);
  }

  return true;
}
