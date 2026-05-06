/**
 * Line & area chart module.
 *
 * Exports line and area chart renderers and computation functions.
 *
 * Area chart multi-series defaults (v6):
 * - Default with `color` encoding is **overlap** -- one translucent gradient
 *   band per series, all anchored at the y-domain baseline.
 * - Stacked rendering is opt-in: set `encoding.y.stack` to `true`, `'zero'`,
 *   `'normalize'`, or `'center'`.
 */

import type { AreaMark, LineMark, Mark } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeAreaMarks } from './area';
import { computeLineMarks } from './compute';
import { computeLineLabels } from './labels';

// ---------------------------------------------------------------------------
// Line chart renderer
// ---------------------------------------------------------------------------

/**
 * Line chart renderer.
 *
 * Computes line marks + point marks for hover targets, then resolves
 * end-of-line labels and attaches them to the corresponding line marks.
 */
export const lineRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeLineMarks(spec, scales, chartArea, strategy);

  // Extract just the line marks for label computation
  const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');

  // Compute and attach labels to line marks by seriesKey lookup
  const labelMap = computeLineLabels(lineMarks, strategy, spec.labels.density, spec.labels.offsets);
  for (const mark of marks) {
    if (mark.type === 'line' && mark.seriesKey) {
      const label = labelMap.get(mark.seriesKey);
      if (label) {
        mark.label = label;
      }
    }
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Area chart renderer
// ---------------------------------------------------------------------------

/**
 * Area chart renderer.
 *
 * Computes area fill marks (stacked or overlapping per `encoding.y.stack`).
 * Also computes line marks for the top boundary and point marks
 * for hover targets, layered on top of the areas.
 *
 * Lines are derived from area top boundaries whenever there's a color
 * encoding -- this keeps each line glued to its band's top edge regardless
 * of whether the layout is stacked (cumulative tops) or overlap (per-series
 * raw values).
 */
export const areaRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const areas = computeAreaMarks(spec, scales, chartArea);

  const encoding = spec.encoding;
  const hasColor = !!(encoding.color && 'field' in encoding.color);

  // With a color encoding (stacked or overlap), derive line marks from the
  // area tops so each line traces the upper edge of its band. For single
  // series, compute lines normally so we get the regular line + point marks.
  const lines = hasColor
    ? linesFromAreas(areas)
    : computeLineMarks(spec, scales, chartArea, strategy);

  // Areas go first (rendered behind lines), then lines on top
  return [...areas, ...lines] as Mark[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive LineMark[] from AreaMark[] using each area's top boundary.
 *
 * Works for both stacked and overlap layouts:
 * - Stacked: `topPoints` is the cumulative top edge of the layer, so the line
 *   sits on top of its band rather than the raw series value.
 * - Overlap: `topPoints` is the series' own y value (areas all share the same
 *   baseline), so the line traces the actual data.
 *
 * No z-order assumption -- each area independently provides its own top.
 */
function linesFromAreas(areas: AreaMark[]): LineMark[] {
  return areas.map((a) => ({
    type: 'line' as const,
    points: a.topPoints,
    path: a.topPath,
    stroke: getRepresentativeColor(a.fill),
    strokeWidth: a.strokeWidth ?? 1,
    seriesKey: a.seriesKey,
    data: a.data,
    dataPoints: a.dataPoints,
    aria: { label: `${a.seriesKey ?? 'Series'}: line with ${a.topPoints.length} data points` },
  }));
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeAreaMarks } from './area';
export { computeLineMarks } from './compute';
export { computeLineLabels } from './labels';
