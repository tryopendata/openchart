/**
 * Frame sampling for chart playback: each key's channel values and fade multiplier at a
 * continuous playhead, read from the gap-filled matrix. Every answer is a pure function of t.
 */
import { isCellPresent } from './freeze';
import { fillInteriorGaps } from './gaps';
import { interpolatePlaybackLogValue, interpolatePlaybackValue } from './interpolate';
import type { PlaybackChannel, PlaybackGaps, PlaybackMatrix } from './matrix';

/** One key at a playhead: its channel values (in channel order) and fade multiplier. */
export interface KeyState {
  values: number[];
  presence: number;
}

/** Pure functions of `t` over the gap-filled matrix. */
export interface FrameSampler {
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
 * Where one key's values come from at a clamped playhead, and its fade: interpolate when
 * present at both ends, hold the last values while leaving (fade out over the first half),
 * hold the first values while entering (fade in over the second half), else hold the nearest
 * present period at presence 0.
 */
function keySpanAt(
  present: Uint8Array,
  hold: Int32Array,
  lastPeriod: number,
  position: number,
): KeySpan {
  const index = Math.floor(position);
  const fraction = index >= lastPeriod ? 0 : position - index;
  const here = present[index] === 1;
  const held: KeySpan = { from: hold[index], to: hold[index], fraction: 0, presence: 0 };
  if (fraction === 0) return here ? { from: index, to: index, fraction, presence: 1 } : held;
  const next = present[index + 1] === 1;
  if (here && next) return { from: index, to: index + 1, fraction, presence: 1 };
  if (here) return { from: index, to: index, fraction: 0, presence: Math.max(0, 1 - 2 * fraction) };
  const entering = index + 1;
  if (next) {
    return { from: entering, to: entering, fraction: 0, presence: Math.max(0, 2 * fraction - 1) };
  }
  return held;
}

/**
 * Sample keys at a continuous period index. A key present at both ends of its interval
 * interpolates; one leaving holds its last values and fades out over the first half; one
 * entering holds its first values and fades in over the second half (RFC 3.5).
 */
export function createFrameSampler(
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
  const spanAt = (keyIndex: number, t: number) =>
    keySpanAt(present[keyIndex], hold[keyIndex], lastPeriod, clamp(t));

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
