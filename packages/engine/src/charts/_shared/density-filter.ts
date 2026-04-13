/**
 * Shared density filter for data labels.
 *
 * Maps a `LabelDensity` setting to the subset of marks eligible for
 * labeling. The `'auto'` branch is a pass-through — auto resolution
 * happens upstream in the per-chart label modules (typically via
 * collision detection on the full candidate set).
 */

import type { LabelDensity } from '@opendata-ai/openchart-core';

/**
 * Filter a mark array by label density.
 *
 * - `'none'` returns `[]` (no labels)
 * - `'endpoints'` returns first + last marks when `marks.length > 1`,
 *   otherwise the input unchanged (preserves single-element arrays as-is)
 * - `'all'` and `'auto'` return the input unchanged
 */
export function filterByDensity<T>(marks: T[], density: LabelDensity): T[] {
  if (density === 'none') return [];
  if (density === 'endpoints' && marks.length > 1) {
    return [marks[0], marks[marks.length - 1]];
  }
  return marks;
}
