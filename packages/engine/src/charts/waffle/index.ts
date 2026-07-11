/**
 * Waffle chart module.
 *
 * Exports the waffle renderer and computation functions. Waffles emit plain
 * RectMark[] (rendered by the existing rect mark path) with no per-cell value
 * labels: the legend names the categories and the tooltip carries the counts,
 * so cell labels would only add noise to the grid.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeWaffleMarks } from './compute';

// ---------------------------------------------------------------------------
// Waffle chart renderer
// ---------------------------------------------------------------------------

/**
 * Waffle chart renderer.
 *
 * Produces one square cell per unit, filled bottom-left to top-right by rows.
 */
export const waffleRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  return computeWaffleMarks(spec, scales, chartArea, strategy) as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeWaffleMarks, largestRemainderCells } from './compute';
