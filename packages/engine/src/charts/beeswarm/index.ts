/**
 * Beeswarm chart module.
 *
 * Exports the beeswarm renderer and computation functions. Beeswarms emit
 * plain PointMark[] (rendered by the existing point mark path) with no
 * per-dot value labels: a swarm carries hundreds of observations, so labels
 * would only recreate the overplotting the layout exists to solve.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeBeeswarmMarks } from './compute';

// ---------------------------------------------------------------------------
// Beeswarm chart renderer
// ---------------------------------------------------------------------------

/**
 * Beeswarm chart renderer.
 *
 * Produces one dodged PointMark per observation.
 */
export const beeswarmRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  return computeBeeswarmMarks(spec, scales, chartArea, strategy) as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeBeeswarmMarks } from './compute';
export { DEFAULT_DODGE_PADDING, dodgeOffsets } from './dodge';
