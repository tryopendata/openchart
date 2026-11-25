/**
 * Advisory warnings for chart playback (RFC 2.7): data that can't sit on a log axis, too
 * few periods, too many marks, irregular period spacing, too little time per period, an
 * oversized matrix, and autoplay without controls.
 */
import { largestPeriodCount } from './freeze';
import type { PlaybackChannel, PlaybackMatrix } from './matrix';
import type { ResolvedPlayback } from './options';
import type { PlaybackPeriod, PlaybackTimeEncoding } from './periods';

const MAX_MARKS_PER_PERIOD = 1000;
const MIN_MS_PER_PERIOD = 50;
const MAX_MATRIX_CELLS = 2_000_000;
const MS_PER_DAY = 86_400_000;

/** What the warnings inspect: the gap-filled matrix, its channels and the timing. */
export interface WarningInput {
  matrix: PlaybackMatrix;
  channels: PlaybackChannel[];
  timing: ResolvedPlayback;
  time: PlaybackTimeEncoding;
}

/** Gaps between consecutive temporal periods, in the coarsest calendar unit that fits. */
function periodSpacing(periods: PlaybackPeriod[]): { gaps: number[]; unit: string } {
  const plainYears = periods.every(
    ({ value, sortKey }) => typeof value === 'number' && value === sortKey,
  );
  const dates = periods.map(
    ({ value, sortKey }) => new Date(plainYears ? Date.UTC(Number(value), 0, 1) : sortKey),
  );
  const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();
  const firstOfMonth = dates.every(
    (date) => date.getTime() === Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const january = firstOfMonth && dates.every((date) => date.getUTCMonth() === 0);
  const between = (measure: (from: Date, to: Date) => number) =>
    dates.slice(1).map((date, index) => measure(dates[index], date));
  if (january) {
    return { gaps: between((a, b) => b.getUTCFullYear() - a.getUTCFullYear()), unit: 'years' };
  }
  if (firstOfMonth) {
    return { gaps: between((a, b) => monthIndex(b) - monthIndex(a)), unit: 'months' };
  }
  return {
    gaps: between((a, b) => Math.round(((b.getTime() - a.getTime()) / MS_PER_DAY) * 100) / 100),
    unit: 'days',
  };
}

function warnIrregularSpacing(input: WarningInput, warn: (message: string) => void): void {
  if ((input.time.type ?? 'temporal') !== 'temporal' || input.matrix.periods.length < 3) return;
  const { gaps, unit } = periodSpacing(input.matrix.periods);
  const smallest = Math.min(...gaps);
  const largest = Math.max(...gaps);
  if (smallest === largest) return;
  warn(
    `Periods are spaced evenly in playback, but the gaps between them range from ${smallest} to ${largest} ${unit}.`,
  );
}

/**
 * Send every advisory warning about a chart playback's data and timing to `warn`.
 * Never throws: these are advice, not errors.
 */
export function collectPlaybackWarnings(
  input: WarningInput,
  warn: (message: string) => void,
): void {
  const { matrix, channels, timing, time } = input;
  const periodCount = matrix.periods.length;
  for (const channel of channels) {
    const count = matrix.nonPositiveCounts[channel.name];
    if (count > 0) {
      warn(
        `${count} values <= 0 in '${channel.field}' can't sit on a log scale, so playback treats them as missing.`,
      );
    }
  }
  if (periodCount < 2) {
    warn(
      `Playback needs at least two periods in '${time.field}' and found ${periodCount}, so the chart renders as a static chart.`,
    );
  }
  const perPeriod = largestPeriodCount(matrix);
  if (perPeriod > MAX_MARKS_PER_PERIOD) {
    warn(
      `${perPeriod} points in one period of '${time.field}' is more than the ${MAX_MARKS_PER_PERIOD.toLocaleString('en')} that playback draws smoothly in SVG. Filter the data to fewer keys.`,
    );
  }
  warnIrregularSpacing(input, warn);
  const msPerPeriod = periodCount >= 2 ? timing.durationMs / (periodCount - 1) : Infinity;
  if (msPerPeriod < MIN_MS_PER_PERIOD) {
    warn(
      `Playback gives each period ${Math.round(msPerPeriod)}ms, under ${MIN_MS_PER_PERIOD}ms. Set a longer playback.duration or a coarser timeUnit on '${time.field}'.`,
    );
  }
  const cells = matrix.keys.length * periodCount * channels.length;
  if (cells > MAX_MATRIX_CELLS) {
    warn(
      `The playback matrix holds ${cells.toLocaleString('en')} cells (${matrix.keys.length} keys x ${periodCount} periods x ${channels.length} channels). Filter keys or coarsen '${time.field}' to keep playback responsive.`,
    );
  }
  if (!timing.controls && timing.autoplay !== false) {
    warn(
      'Playback autoplay is enabled with controls disabled. Set playback.controls to true or playback.autoplay to false so viewers can pause motion (WCAG 2.2.2).',
    );
  }
}
