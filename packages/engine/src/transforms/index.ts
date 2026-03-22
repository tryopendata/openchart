/**
 * Data transform pipeline.
 *
 * Runs an ordered sequence of transforms (filter, bin, calculate, timeUnit)
 * against a data array. Each transform produces a new array, feeding into
 * the next transform in sequence.
 */

import type { DataRow, Transform } from '@opendata-ai/openchart-core';
import { runBin } from './bin';
import { runCalculate } from './calculate';
import { runFilter } from './filter';
import { runTimeUnit } from './timeunit';

export { runBin } from './bin';
export { runCalculate } from './calculate';
export { isConditionalValueDef, resolveConditionalValue } from './conditional';
export { runFilter } from './filter';
export { evaluatePredicate } from './predicates';
export { runTimeUnit } from './timeunit';

/**
 * Run a sequence of transforms against a data array.
 *
 * Each transform is applied in order, producing a new data array
 * that feeds into the next transform. The original data is not mutated.
 *
 * @param data - Input data rows.
 * @param transforms - Ordered array of transform definitions.
 * @returns Transformed data rows.
 */
export function runTransforms(data: DataRow[], transforms: Transform[]): DataRow[] {
  let result = data;

  for (const transform of transforms) {
    if ('filter' in transform) {
      result = runFilter(result, transform.filter);
    } else if ('bin' in transform) {
      result = runBin(result, transform);
    } else if ('calculate' in transform) {
      result = runCalculate(result, transform);
    } else if ('timeUnit' in transform) {
      result = runTimeUnit(result, transform);
    }
  }

  return result;
}
