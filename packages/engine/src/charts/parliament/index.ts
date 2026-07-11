/**
 * Parliament (hemicycle) chart module.
 *
 * Exports the parliament renderer. Parliament marks emit existing mark types
 * (PointMark seats + a RuleMarkLayout majority line + a TextMarkLayout label),
 * so they render through the existing point/rule/text mark paths with no
 * bespoke renderer or layout type.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeParliamentMarks } from './compute';

// ---------------------------------------------------------------------------
// Parliament chart renderer
// ---------------------------------------------------------------------------

/**
 * Parliament chart renderer.
 *
 * Produces one seat dot per seat (party-grouped, left to right) plus the
 * majority-threshold line and its label.
 */
export const parliamentRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  return computeParliamentMarks(spec, scales, chartArea, strategy, theme) as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeParliamentMarks } from './compute';
