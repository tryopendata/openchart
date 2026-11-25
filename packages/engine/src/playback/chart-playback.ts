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
import {
  type PlaybackIdentity,
  playbackChannels,
  playbackIdentity,
  playbackStaticFields,
} from '../charts/scatter/playback-channels';
import { createFrameDrawer, type FrameDrawer } from '../charts/scatter/playback-frames';
import { prepareChartSpec } from '../compile/prepare';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { computeTooltipDescriptors } from '../tooltips/compute';
import type { ChartPlayback, FrameMark, ObservedValues } from './chart-types';
import { collectPlaybackWarnings } from './chart-warnings';
import { createFrameSampler, type FrameSampler } from './frame-sampler';
import { freezeChartFrame, specMarkType } from './freeze';
import { buildPlaybackMatrix, type PlaybackChannel, type PlaybackMatrix } from './matrix';
import { resolvePlayback } from './options';
import { formatPeriodLabels } from './period-labels';
import type { PlaybackTimeEncoding, PlaybackTimeType } from './periods';
import { resolveTrailKeys, trailsAt } from './trails';

/**
 * @throws {Error} When the spec names no identity. Validation rejects such specs before
 * this runs, so reaching it means a validation rule is missing.
 */
function requireIdentity(identity: PlaybackIdentity | undefined, spec: ChartSpec) {
  if (identity) return identity;
  throw new Error(
    `Playback found no identity for '${specMarkType(spec)}' marks: points and circles need encoding.key, bars an x/y category. Time validation should have rejected this spec.`,
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
    const value = matrix.values[name][keyIndex][period];
    if (Number.isFinite(value)) values[field] = formatters[field](value);
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
  const prepared = prepareChartSpec(spec, { ...options, onWarn: warn });
  const source = prepared.expandedSpec as ChartSpec;
  const markType = specMarkType(source);
  const encoding = source.encoding as Encoding & { time: EncodingChannel };
  const time = { ...encoding.time, type: encoding.time.type as PlaybackTimeType };
  const identity = requireIdentity(
    playbackIdentity(markType, encoding, prepared.chartSpec.data),
    source,
  );
  const channels = playbackChannels(markType, encoding);
  const staticFields = playbackStaticFields(encoding, channels);
  const noun = markType === 'bar' ? 'bars' : 'points';
  const observed = buildPlaybackMatrix(
    identity.rows,
    { identity: identity.field, time, channels, staticFields, noun },
    'drop',
    warn,
  );
  return { source, identity: identity.field, time, channels, observed };
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
      if (Number.isFinite(value)) row[pivot.channels[channel].field] = value;
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
  // The validating prepare and the envelope compile both run the sugar and normalize
  // passes, so each message is sent once.
  const warn = (message: string) => {
    if (warnings.includes(message)) return;
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
