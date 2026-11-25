/**
 * Chart playback compile: matrix, frozen frame, base layout and the per-frame functions for
 * point, circle and bar charts with `encoding.time`.
 */
import type {
  ChartSpec,
  CompileOptions,
  DataRow,
  Encoding,
  EncodingChannel,
  Mark,
} from '@opendata-ai/openchart-core';
import { createFrameDrawer, type FrameDrawer } from '../charts/scatter/playback-frames';
import {
  channelField,
  pointPlaybackChannels,
  pointStaticFields,
} from '../charts/scatter/playback-spec';
import { prepareChartSpec } from '../compile/prepare';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { computeTooltipDescriptors } from '../tooltips/compute';
import type { ChartPlayback, FrameMark, ObservedValues } from './chart-types';
import { freezeChartFrame, isCellPresent, largestPeriodCount } from './freeze';
import { fillInteriorGaps } from './gaps';
import { interpolatePlaybackLogValue, interpolatePlaybackValue } from './interpolate';
import {
  buildPlaybackMatrix,
  type PlaybackChannel,
  type PlaybackGaps,
  type PlaybackMatrix,
} from './matrix';
import { type ResolvedPlayback, resolvePlayback } from './options';
import { formatPeriodLabels } from './period-labels';
import type { PlaybackPeriod, PlaybackTimeEncoding, PlaybackTimeType } from './periods';
import { resolveTrailKeys, trailsAt } from './trails';

// ---------------------------------------------------------------------------
// Frame sampling: each key's values and presence at a playhead
// ---------------------------------------------------------------------------

/** One key at a playhead: its channel values (in channel order) and fade multiplier. */
interface KeyState {
  values: number[];
  presence: number;
}

/** Pure functions of `t` over the gap-filled matrix. */
interface FrameSampler {
  /** The matrix with the gap policy applied. */
  matrix: PlaybackMatrix;
  everPresent(keyIndex: number): boolean;
  /** Has a value on every channel at the period, observed or gap-filled. */
  isPresent(keyIndex: number, period: number): boolean;
  /** Has an observed value on every channel at the period, before gap filling. */
  isObserved(keyIndex: number, period: number): boolean;
  nearestPeriod(t: number): number;
  stateAt(keyIndex: number, t: number): KeyState;
}

/** Which periods a key's values come from at a playhead, and how far between them. */
interface KeySpan {
  from: number;
  to: number;
  fraction: number;
  presence: number;
}

function presenceMasks(matrix: PlaybackMatrix): Uint8Array[] {
  return matrix.keys.map((_, keyIndex) =>
    Uint8Array.from(matrix.periods, (_, period) =>
      isCellPresent(matrix, keyIndex, period) ? 1 : 0,
    ),
  );
}

/** Per key and period: the last present period at or before it, else the first after, else -1. */
function holdPeriods(present: Uint8Array[]): Int32Array[] {
  return present.map((mask) => {
    const hold = new Int32Array(mask.length).fill(-1);
    let last = -1;
    for (let period = 0; period < mask.length; period++) {
      if (mask[period]) last = period;
      hold[period] = last;
    }
    let next = -1;
    for (let period = mask.length - 1; period >= 0; period--) {
      if (mask[period]) next = period;
      if (hold[period] === -1) hold[period] = next;
    }
    return hold;
  });
}

function fillMatrix(
  observed: PlaybackMatrix,
  channels: PlaybackChannel[],
  gaps: PlaybackGaps,
): PlaybackMatrix {
  const values: Record<string, Float64Array[]> = {};
  for (const channel of channels) {
    values[channel.name] = observed.values[channel.name].map((series) => {
      const filled = series.slice();
      fillInteriorGaps(filled, gaps, channel.log);
      return filled;
    });
  }
  return { ...observed, values };
}

/**
 * Sample keys at a continuous period index. A key present at both ends of its interval
 * interpolates; one leaving holds its last values and fades out over the first half; one
 * entering holds its first values and fades in over the second half (RFC 3.5).
 */
function createFrameSampler(
  observed: PlaybackMatrix,
  channels: PlaybackChannel[],
  gaps: PlaybackGaps,
): FrameSampler {
  const matrix = fillMatrix(observed, channels, gaps);
  const present = presenceMasks(matrix);
  const observedMask = presenceMasks(observed);
  const hold = holdPeriods(present);
  const lastPeriod = Math.max(matrix.periods.length - 1, 0);
  const series = channels.map(({ name }) => matrix.values[name]);
  const interpolators = channels.map(({ log }) =>
    log ? interpolatePlaybackLogValue : interpolatePlaybackValue,
  );

  const clamp = (t: number) => (Number.isFinite(t) ? Math.min(Math.max(t, 0), lastPeriod) : 0);
  const held = (keyIndex: number, period: number): KeySpan => {
    const source = hold[keyIndex][period];
    return { from: source, to: source, fraction: 0, presence: 0 };
  };
  const spanAt = (keyIndex: number, t: number): KeySpan => {
    const position = clamp(t);
    const index = Math.floor(position);
    const fraction = index >= lastPeriod ? 0 : position - index;
    const here = present[keyIndex][index] === 1;
    if (fraction === 0) {
      return here ? { from: index, to: index, fraction, presence: 1 } : held(keyIndex, index);
    }
    const next = present[keyIndex][index + 1] === 1;
    if (here && next) return { from: index, to: index + 1, fraction, presence: 1 };
    if (here)
      return { from: index, to: index, fraction: 0, presence: Math.max(0, 1 - 2 * fraction) };
    if (next) {
      return {
        from: index + 1,
        to: index + 1,
        fraction: 0,
        presence: Math.max(0, 2 * fraction - 1),
      };
    }
    return held(keyIndex, index);
  };

  return {
    matrix,
    everPresent: (keyIndex) => present[keyIndex].includes(1),
    isPresent: (keyIndex, period) => present[keyIndex][period] === 1,
    isObserved: (keyIndex, period) => observedMask[keyIndex][period] === 1,
    nearestPeriod: (t) => Math.round(clamp(t)),
    stateAt: (keyIndex, t) => {
      const { from, to, fraction, presence } = spanAt(keyIndex, t);
      const values = series.map((keyed, channel) =>
        interpolators[channel](keyed[keyIndex], from, fraction, to),
      );
      return { values, presence };
    },
  };
}

// ---------------------------------------------------------------------------
// Warnings (RFC 2.7)
// ---------------------------------------------------------------------------

const MAX_MARKS_PER_PERIOD = 1000;
const MIN_MS_PER_PERIOD = 50;
const MAX_MATRIX_CELLS = 2_000_000;
const MS_PER_DAY = 86_400_000;

interface WarningInput {
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

/** Advisory warnings about the data and timing of a chart playback. */
function collectPlaybackWarnings(input: WarningInput, warn: (message: string) => void): void {
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

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

function requireIdentity(encoding: Encoding): string {
  const identity = channelField(encoding.key);
  if (identity) return identity;
  throw new Error(
    'Playback needs encoding.key to follow each mark from one period to the next. Add encoding.key naming the identity field.',
  );
}

/** Keys drawn in any period, largest maximum size first so small marks draw on top. */
function baseKeyOrder(matrix: PlaybackMatrix, sampler: FrameSampler): number[] {
  const drawn = matrix.keys.map((_, index) => index).filter(sampler.everPresent);
  const sizes = matrix.values.size;
  if (!sizes) return drawn;
  const largest = (index: number) =>
    sizes[index].reduce((max, value) => (value > max ? value : max), -Infinity);
  return drawn.sort((a, b) => largest(b) - largest(a) || a - b);
}

function observedValues(
  matrix: PlaybackMatrix,
  channels: PlaybackChannel[],
  formatters: Record<string, (value: number) => string>,
  keyIndex: number,
  period: number,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [field, value] of Object.entries(matrix.statics[keyIndex])) {
    values[field] = String(value);
  }
  for (const { name, field } of channels) {
    values[field] = formatters[field](matrix.values[name][keyIndex][period]);
  }
  return values;
}

/** A time spec's transformed rows pivoted into the observed (not yet gap-filled) matrix. */
interface PivotedSpec {
  /** The authored spec after sugar expansion. */
  source: ChartSpec;
  identity: string;
  time: EncodingChannel & PlaybackTimeEncoding;
  channels: PlaybackChannel[];
  observed: PlaybackMatrix;
}

/**
 * Validate and transform the spec's rows, then pivot them with no gap filling.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 */
function pivotSpecRows(
  spec: ChartSpec,
  options: CompileOptions,
  warn: (message: string) => void,
): PivotedSpec {
  // Sugar and normalize warnings surface once, from the envelope compile.
  const prepared = prepareChartSpec(spec, { ...options, onWarn: () => {} });
  const source = prepared.expandedSpec as ChartSpec;
  const encoding = source.encoding as Encoding & { time: EncodingChannel };
  const time = { ...encoding.time, type: encoding.time.type as PlaybackTimeType };
  const identity = requireIdentity(encoding);
  const channels = pointPlaybackChannels(encoding);
  const staticFields = pointStaticFields(encoding, channels);
  const observed = buildPlaybackMatrix(
    prepared.chartSpec.data,
    { identity, time, channels, staticFields, noun: 'points' },
    'drop',
    warn,
  );
  return { source, identity, time, channels, observed };
}

/** Every base key's mark at `t`, in base order, drawn by the renderer from interpolated rows. */
function drawFrame(
  pivot: PivotedSpec,
  sampler: FrameSampler,
  order: number[],
  draw: FrameDrawer,
  t: number,
): FrameMark[] {
  const { matrix } = sampler;
  const states = order.map((keyIndex) => sampler.stateAt(keyIndex, t));
  const rows: DataRow[] = order.map((keyIndex, position) => {
    const row: DataRow = { ...matrix.statics[keyIndex], [pivot.identity]: matrix.keys[keyIndex] };
    for (const [channel, value] of states[position].values.entries()) {
      row[pivot.channels[channel].field] = value;
    }
    return row;
  });
  const drawn = draw(rows);
  const frameMarks: FrameMark[] = [];
  order.forEach((keyIndex, position) => {
    const key = matrix.keys[keyIndex];
    const mark = drawn.get(key);
    // Statics are constant per key and held values stay finite, so a key the renderer
    // draws once it draws at every t; this only skips keys it can never draw.
    if (mark) frameMarks.push({ key, mark, presence: states[position].presence });
  });
  return frameMarks;
}

/**
 * Validate a time spec, pivot its rows into the playback matrix, freeze the frame and
 * return the base layout plus `marksAt`, `trailsAt`, `observedAt` and `describe`. Frames
 * call the registered chart renderer with the frozen scales, plot area and label plan; no
 * frame compiles. Warnings (RFC 2.7) go to `warnings` and to `options.onWarn`.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 * @throws {RangeError} When `playback.step` overflows over the period count.
 */
export function compileChartPlayback(spec: ChartSpec, options: CompileOptions): ChartPlayback {
  const warnings: string[] = [];
  const warn = (message: string) => {
    warnings.push(message);
    emitSpecWarnings([message], options.onWarn);
  };
  const pivot = pivotSpecRows(spec, options, warn);
  const { source, channels, observed } = pivot;
  const timing = resolvePlayback(source.playback, observed.periods.length);
  const sampler = createFrameSampler(observed, channels, timing.gaps);
  const { matrix } = sampler;
  collectPlaybackWarnings({ matrix, channels, timing, time: pivot.time }, warn);

  const frame = freezeChartFrame(source, { ...options, onWarn: warn }, matrix);
  const labelled = new Set(source.playback?.labels ?? []);
  const draw = createFrameDrawer(frame, frame.layout.dimensions.width, labelled);
  const order = baseKeyOrder(matrix, sampler);
  const marksAt = (t: number) => drawFrame(pivot, sampler, order, draw, t);
  const finalMarks = marksAt(matrix.periods.length - 1);
  const baseMarks: Mark[] = finalMarks.map(({ mark }) => mark);
  const trailKeys = source.playback?.trails
    ? resolveTrailKeys(source.playback.trails, matrix.keys, warn)
    : [];
  const periodLabels = formatPeriodLabels(matrix.periods, pivot.time);
  const keyIndexes = new Map(matrix.keys.map((key, index) => [key, index]));

  const observedAt = (key: string, t: number): ObservedValues | null => {
    const keyIndex = keyIndexes.get(key);
    if (keyIndex === undefined || matrix.periods.length === 0) return null;
    const period = sampler.nearestPeriod(t);
    if (!sampler.isPresent(keyIndex, period)) return null;
    return {
      periodLabel: periodLabels[period],
      filled: !sampler.isObserved(keyIndex, period),
      values: observedValues(matrix, channels, frame.formatters, keyIndex, period),
    };
  };

  const describe = (t: number): string => {
    if (matrix.periods.length === 0) return 'No periods to play.';
    const period = sampler.nearestPeriod(t);
    const shown = order.filter((keyIndex) => sampler.isPresent(keyIndex, period)).length;
    return `${periodLabels[period]}: ${shown} of ${order.length} points shown.`;
  };

  return {
    frame,
    base: {
      ...frame.layout,
      marks: baseMarks,
      tooltipDescriptors: computeTooltipDescriptors(frame.spec, baseMarks),
    },
    periods: matrix.periods,
    periodLabels,
    timing,
    keys: finalMarks.map(({ key }) => key),
    warnings,
    marksAt,
    trailsAt: (t) => (trailKeys.length ? trailsAt(matrix, frame, trailKeys, t) : []),
    observedAt,
    describe,
  };
}
