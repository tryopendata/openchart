/**
 * Calendar heatmap mark computation.
 *
 * GitHub-style layout: weeks as columns, weekdays as rows, month labels
 * above each band, Mon/Wed/Fri weekday labels on the left. Multi-year data
 * partitions into one full-year band per calendar year, stacked vertically
 * with a year label per band; every band shares the figure's single color
 * scale (built once from the full dataset by computeScales).
 *
 * The calendar owns its geometry: no positional scales or axes. All date
 * math runs in UTC (d3-time utc* intervals) so the layout is deterministic
 * regardless of the host machine's timezone -- ISO date strings like
 * "2024-01-15" parse as UTC midnight, and a local-time week interval would
 * shift them across day boundaries in western timezones.
 *
 * Days inside a band's year with no data row (or a non-numeric value)
 * render as empty cells filled with the theme's achromatic surface tint
 * (colors.annotationFill), visually distinct from the chromatic scale
 * minimum in both light and dark modes. Days padding the first/last week
 * but belonging to a neighboring year render nothing.
 */

import type {
  Encoding,
  Mark,
  MarkAria,
  Rect,
  RectMark,
  ResolvedTheme,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { defaultNumberFormatter, formatDate } from '@opendata-ai/openchart-core';
import { type CountableTimeInterval, utcDay, utcMonday, utcSunday } from 'd3-time';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getSequentialColor } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum day-cell size in pixels (the "never shrink marks below legibility"
 * floor, extending the never-shrink-text house rule to marks). When the
 * container is too narrow for 53 legible columns the grid keeps this floor
 * and overflows the chart area instead of shrinking further; hosts that need
 * every column visible at phone widths wrap the figure in a horizontal
 * scroll container.
 */
export const MIN_CELL_SIZE = 7;

/** Maximum grid step (cell + gap) so huge containers stay dense. */
const MAX_STEP = 20;

/** Minimum grid step: the cell floor plus a 1px gap. */
const MIN_STEP = MIN_CELL_SIZE + 1;

/** Vertical gap between stacked year bands. */
const BAND_GAP = 18;

/** Gap between the weekday labels and the first week column. */
const WEEKDAY_LABEL_GAP = 6;

/** Default corner radius for day cells (markDef.cellRadius overrides). */
const DEFAULT_CELL_RADIUS = 1;

/** Weekday labels shown on the left (day-of-week numbers, 0 = Sunday). */
const WEEKDAY_LABELS: Array<{ dow: number; label: string }> = [
  { dow: 1, label: 'Mon' },
  { dow: 3, label: 'Wed' },
  { dow: 5, label: 'Fri' },
];

/** Abbreviated month labels, January first. */
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse a raw field value to a UTC-floored day, or null when unparseable. */
export function parseUtcDay(value: unknown): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return null;
  return utcDay.floor(date);
}

/** ISO yyyy-mm-dd key for a UTC day. */
function isoDayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Week interval for a weekStart option. */
function weekInterval(weekStart: 'monday' | 'sunday'): CountableTimeInterval {
  return weekStart === 'sunday' ? utcSunday : utcMonday;
}

/** Weekday row index (0..6) for a UTC day under a weekStart option. */
export function weekdayRow(day: Date, weekStart: 'monday' | 'sunday'): number {
  const startDow = weekStart === 'sunday' ? 0 : 1;
  return (day.getUTCDay() - startDow + 7) % 7;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute calendar heatmap marks from a normalized chart spec.
 *
 * Emits one RectMark per day of every calendar year present in the data
 * (days without data get the empty-cell surface tint) plus TextMarkLayout
 * marks for month, weekday, and (multi-year only) year labels.
 */
export function computeCalendarMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  theme: ResolvedTheme,
): Mark[] {
  const encoding = spec.encoding as Encoding;
  const xEnc = encoding.x;
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  if (!xEnc || !colorEnc) return [];

  const weekStart = spec.markDef.weekStart ?? 'monday';
  const week = weekInterval(weekStart);
  const cellRadius = spec.markDef.cellRadius ?? DEFAULT_CELL_RADIUS;

  // Index rows by UTC day. Unparseable dates and non-numeric values were
  // rejected (or warned about) at validation; anything that still slips
  // through renders as an empty cell rather than corrupting the grid.
  const dayData = new Map<string, { row: Record<string, unknown>; value: number }>();
  const years = new Set<number>();
  for (const row of spec.data) {
    const day = parseUtcDay(row[xEnc.field]);
    if (!day) continue;
    years.add(day.getUTCFullYear());
    const value = Number(row[colorEnc.field]);
    if (!Number.isFinite(value)) continue;
    dayData.set(isoDayKey(day), { row: row as Record<string, unknown>, value });
  }
  if (years.size === 0) return [];

  const sortedYears = Array.from(years).sort((a, b) => a - b);

  // Per-band week-column counts. A band always spans its full calendar year
  // (Jan 1 through Dec 31), so partial-year data keeps the familiar 53-column
  // silhouette and missing days read as gaps rather than a shifted grid.
  const bandColumns = sortedYears.map((year) => {
    const firstWeek = week.floor(new Date(Date.UTC(year, 0, 1)));
    const lastDay = new Date(Date.UTC(year, 11, 31));
    return week.count(firstWeek, lastDay) + 1;
  });
  const maxColumns = Math.max(...bandColumns);

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------
  const labelFont = theme.fonts.sizes.small;
  const gutter = Math.ceil(labelFont * 2.6) + WEEKDAY_LABEL_GAP;
  const monthRow = Math.ceil(labelFont * 1.3) + 2;
  const bands = sortedYears.length;
  const showYearLabels = bands > 1;

  const availWidth = Math.max(0, chartArea.width - gutter);
  const stepFromWidth = availWidth / maxColumns;
  const availHeight = Math.max(0, chartArea.height - bands * monthRow - (bands - 1) * BAND_GAP);
  const stepFromHeight = availHeight / (7 * bands);
  // Square cells only: the calendar idiom reads as a grid of days, and
  // wide cells would misalign weekday rows across stacked year bands. At
  // narrow widths the step clamps to the MIN_CELL_SIZE floor instead of
  // going sub-legible (the grid then overflows to the right).
  const step = Math.min(
    MAX_STEP,
    Math.max(MIN_STEP, Math.floor(Math.min(stepFromWidth, stepFromHeight))),
  );
  const cellGap = step >= 14 ? 3 : step >= 10 ? 2 : 1;
  const cell = step - cellGap;

  const gridWidth = maxColumns * step - cellGap;
  const bandHeight = monthRow + 7 * step - cellGap;
  const totalHeight = bands * bandHeight + (bands - 1) * BAND_GAP;
  const originX = chartArea.x + gutter + Math.max(0, (availWidth - gridWidth) / 2);
  const originY = chartArea.y + Math.max(0, (chartArea.height - totalHeight) / 2);

  // Month label thinning: when four week columns can't fit a three-letter
  // label, keep every other month so labels never collide.
  const monthLabelWidth = labelFont * 2.2;
  const monthLabelEvery = step * 4.34 < monthLabelWidth + 4 ? 2 : 1;

  const labelBaseline = labelFont; // baseline offset from the band top

  const cellMarks: RectMark[] = [];
  const labelMarks: TextMarkLayout[] = [];

  const labelAria: MarkAria = { decorative: true };
  const labelStyle = {
    fill: theme.colors.axis,
    fontSize: labelFont,
    fontWeight: theme.fonts.weights.normal,
    fontFamily: theme.fonts.family,
  };

  // -------------------------------------------------------------------------
  // Bands
  // -------------------------------------------------------------------------
  const calendarFmt = defaultNumberFormatter();
  for (let b = 0; b < bands; b++) {
    const year = sortedYears[b];
    const bandTop = originY + b * (bandHeight + BAND_GAP);
    const gridTop = bandTop + monthRow;
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const firstWeek = week.floor(yearStart);

    // Year label (multi-year only), in the weekday gutter column.
    if (showYearLabels) {
      labelMarks.push({
        type: 'textMark',
        x: chartArea.x,
        y: bandTop + labelBaseline,
        text: String(year),
        ...labelStyle,
        fill: theme.colors.text,
        fontWeight: theme.fonts.weights.semibold,
        textAnchor: 'start',
        data: {},
        aria: labelAria,
      });
    }

    // Month labels above the grid, at the column containing the 1st.
    for (let m = 0; m < 12; m += monthLabelEvery) {
      const col = week.count(firstWeek, new Date(Date.UTC(year, m, 1)));
      labelMarks.push({
        type: 'textMark',
        x: originX + col * step,
        y: bandTop + labelBaseline,
        text: MONTH_LABELS[m],
        ...labelStyle,
        textAnchor: 'start',
        data: {},
        aria: labelAria,
      });
    }

    // Weekday labels (Mon/Wed/Fri) left of the grid, centered on their row.
    for (const { dow, label } of WEEKDAY_LABELS) {
      const row = (dow - (weekStart === 'sunday' ? 0 : 1) + 7) % 7;
      labelMarks.push({
        type: 'textMark',
        x: originX - WEEKDAY_LABEL_GAP,
        y: gridTop + row * step + cell / 2 + labelFont * 0.35,
        text: label,
        ...labelStyle,
        textAnchor: 'end',
        data: {},
        aria: labelAria,
      });
    }

    // Day cells: every day of the calendar year.
    for (const day of utcDay.range(yearStart, yearEnd)) {
      const col = week.count(firstWeek, day);
      const row = weekdayRow(day, weekStart);
      const key = isoDayKey(day);
      const datum = dayData.get(key);
      const dateLabel = formatDate(day, undefined, 'day');

      if (datum) {
        cellMarks.push({
          type: 'rect',
          key,
          x: originX + col * step,
          y: gridTop + row * step,
          width: cell,
          height: cell,
          fill: getSequentialColor(scales, datum.value),
          cornerRadius: cellRadius,
          data: datum.row,
          aria: {
            label: `${dateLabel}, ${colorEnc.field}: ${calendarFmt(datum.value)}`,
          },
        });
      } else {
        cellMarks.push({
          type: 'rect',
          key,
          x: originX + col * step,
          y: gridTop + row * step,
          width: cell,
          height: cell,
          fill: theme.colors.annotationFill,
          cornerRadius: cellRadius,
          data: {},
          aria: { decorative: true },
        });
      }
    }
  }

  return [...cellMarks, ...labelMarks];
}
