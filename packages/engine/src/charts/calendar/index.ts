/**
 * Calendar heatmap chart module.
 *
 * Exports the calendar renderer and computation function. Calendars emit
 * RectMark day cells plus decorative TextMarkLayout month/weekday/year
 * labels; there are no positional scales or axes (the compile pipeline
 * suppresses them, arc precedent). The quantitative color encoding drives
 * both the cell fills and the default-on continuous color legend.
 */

import type { ChartRenderer } from '../registry';
import { computeCalendarMarks } from './compute';

// ---------------------------------------------------------------------------
// Calendar chart renderer
// ---------------------------------------------------------------------------

/**
 * Calendar heatmap renderer.
 *
 * Produces one rect per day of each calendar year in the data, plus text
 * marks for the month/weekday/year labels.
 */
export const calendarRenderer: ChartRenderer = (spec, scales, chartArea, _strategy, theme) => {
  return computeCalendarMarks(spec, scales, chartArea, theme);
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeCalendarMarks, MIN_CELL_SIZE, parseUtcDay, weekdayRow } from './compute';
