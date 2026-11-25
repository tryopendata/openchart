/**
 * Chart playback compile: matrix, frozen frame, base layout and the per-frame functions for
 * point, circle and bar charts with `encoding.time`.
 */
import type {
  ChartSpec,
  CompileOptions,
  Encoding,
  EncodingChannel,
  Mark,
} from '@opendata-ai/openchart-core';
import { createFrameDrawer, createFrameMarks } from '../charts/scatter/playback-frames';
import { prepareChartSpec } from '../compile/prepare';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { computeTooltipDescriptors } from '../tooltips/compute';
import {
  type PlaybackIdentity,
  playbackChannels,
  playbackIdentity,
  playbackStaticFields,
} from './channels';
import type { ChartPlayback, FrameMark, ObservedValues } from './chart-types';
import { collectPlaybackWarnings } from './chart-warnings';
import { createFrameSampler, type FrameSampler } from './frame-sampler';
import { freezeChartFrame, specMarkType } from './freeze';
import { buildPlaybackMatrix, type PlaybackChannel, type PlaybackMatrix } from './matrix';
import { resolvePlayback } from './options';
import { createOverlaysAt } from './overlay-plan';
import { paintOrder } from './overlays';
import { formatPeriodLabels } from './period-labels';
import type { PlaybackTimeEncoding, PlaybackTimeType } from './periods';
import { createTrailsAt, resolveTrailKeys } from './trails';

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
  /** What the marks are called in messages and the live-region summary. */
  noun: 'bars' | 'points';
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
  return { source, identity: identity.field, time, channels, observed, noun };
}

/** A compiled playback plus each frame's marks and overlays in paint order. */
export interface PaintedChartPlayback {
  playback: ChartPlayback;
  /** Overlays behind, then marks, then overlays above, at `t`; what static output draws. */
  frameMarksAt(t: number): FrameMark[];
}

/**
 * Validate a time spec, pivot its rows into the playback matrix, freeze the frame and
 * return the base layout plus `marksAt`, `overlaysAt`, `trailsAt`, `observedAt` and
 * `describe`. Frames call the registered chart renderer with the frozen scales, plot area
 * and label plan; no frame compiles. Warnings (RFC 2.7) go to `warnings` and to
 * `options.onWarn`.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 * @throws {RangeError} When `playback.step` overflows over the period count.
 */
export function compileChartPlayback(spec: ChartSpec, options: CompileOptions): ChartPlayback {
  return compilePaintedChartPlayback(spec, options).playback;
}

/**
 * `compileChartPlayback`, also returning `frameMarksAt` so the static compile orders its
 * marks the way the base layout does.
 *
 * @throws The errors `compileChartPlayback` throws.
 */
export function compilePaintedChartPlayback(
  spec: ChartSpec,
  options: CompileOptions,
): PaintedChartPlayback {
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
  // The authored spec: sugar turns a value sort into a fixed domain in `source`.
  collectPlaybackWarnings({ matrix, channels, timing, time: pivot.time, spec }, warn);

  const frame = freezeChartFrame(source, { ...options, onWarn: warn }, matrix);
  const draw = createFrameDrawer(frame, frame.layout.dimensions.width, options.measureText);
  const order = baseKeyOrder(matrix, sampler);
  const { marksAt, fixedMarksAt } = createFrameMarks(draw, sampler, order, {
    identity: pivot.identity,
    channelFields: channels.map(({ field }) => field),
  });
  const finalPeriod = matrix.periods.length - 1;
  const periodLabels = formatPeriodLabels(matrix.periods, pivot.time);
  const overlaysFor = createOverlaysAt({
    source,
    frame,
    timing,
    sampler,
    order,
    time: pivot.time,
    marksAt,
  });
  const fixedMarks = fixedMarksAt(finalPeriod);
  const frameMarksAt = (t: number) => paintOrder(overlaysFor(t), [...marksAt(t), ...fixedMarks]);
  const finalMarks = marksAt(finalPeriod);
  const baseMarks: Mark[] = frameMarksAt(finalPeriod).map(({ mark }) => mark);
  const trailKeys = source.playback?.trails
    ? resolveTrailKeys(source.playback.trails, matrix.keys, warn)
    : [];
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
    const period = sampler.reachedPeriod(t);
    const shown = order.filter((keyIndex) => sampler.isPresent(keyIndex, period)).length;
    return `${periodLabels[period]}: ${shown} of ${order.length} ${pivot.noun} shown.`;
  };

  const playback: ChartPlayback = {
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
    overlaysAt: (t) => {
      const { behind, above } = overlaysFor(t);
      return [...behind, ...above];
    },
    trailsAt: createTrailsAt(matrix, frame, trailKeys),
    observedAt,
    describe,
  };
  return { playback, frameMarksAt };
}
