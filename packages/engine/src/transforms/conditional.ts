/**
 * Conditional encoding evaluation.
 *
 * Resolves conditional value definitions per-datum by evaluating
 * predicates and returning the first matching condition's value.
 */

import type { ConditionalValueDef, DataRow } from '@opendata-ai/openchart-core';
import { evaluatePredicate } from './predicates';

/**
 * Resolve a conditional value definition for a datum.
 *
 * Evaluates conditions in order, returning the value from the first
 * condition whose test passes. Falls back to the default value if
 * no condition matches.
 *
 * @param datum - The data row to evaluate against.
 * @param channelDef - The conditional value definition.
 * @returns The resolved value, or undefined if no condition matches and no default.
 */
export function resolveConditionalValue(datum: DataRow, channelDef: ConditionalValueDef): unknown {
  const conditions = Array.isArray(channelDef.condition)
    ? channelDef.condition
    : [channelDef.condition];

  for (const cond of conditions) {
    if (evaluatePredicate(datum, cond.test)) {
      // If the condition specifies a field, return the datum's field value
      if (cond.field !== undefined) {
        return datum[cond.field];
      }
      return cond.value;
    }
  }

  // No condition matched, return default
  return channelDef.value;
}

/**
 * Check if a channel definition is a ConditionalValueDef.
 */
export function isConditionalValueDef(def: unknown): def is ConditionalValueDef {
  return def !== null && typeof def === 'object' && 'condition' in (def as Record<string, unknown>);
}
