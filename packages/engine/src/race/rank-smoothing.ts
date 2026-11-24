import { interpolateRaceValue } from './interpolate';

/**
 * Samples (periodCount - 1) * samplesPerPeriod + 1 ranks per key in key index order.
 * Absent keys and ranks outside the visible slots use the sentinel top.
 * Equal values keep their previous sample's rank order, then fall back to key index.
 */
export function sampleRanks(
  values: Float64Array[],
  periodCount: number,
  samplesPerPeriod: number,
  top: number,
): Float32Array[] {
  const sampleCount = (periodCount - 1) * samplesPerPeriod + 1;
  const keyCount = values.length;
  const ranks = values.map(() => new Float32Array(sampleCount));
  const sampleValues = new Float64Array(keyCount);
  const previousRanks = new Uint32Array(keyCount).fill(keyCount);
  const present: number[] = [];
  const compare = (a: number, b: number) =>
    sampleValues[b] - sampleValues[a] || previousRanks[a] - previousRanks[b] || a - b;

  for (let sample = 0; sample < sampleCount; sample++) {
    const t = sample / samplesPerPeriod;
    const period = Math.floor(t);
    const fraction = t - period;
    present.length = 0;
    for (let key = 0; key < keyCount; key++) {
      const value = interpolateRaceValue(values[key], period, fraction);
      if (Number.isFinite(value)) {
        sampleValues[key] = value;
        present.push(key);
      } else {
        ranks[key][sample] = top;
      }
    }

    present.sort(compare);
    previousRanks.fill(keyCount);
    for (let rank = 0; rank < present.length; rank++) {
      const key = present[rank];
      previousRanks[key] = rank;
      ranks[key][sample] = Math.min(rank, top);
    }
  }
  return ranks;
}

function boxPass(values: Float64Array, width: number): Float64Array {
  const prefix = new Float64Array(values.length + 1);
  for (let index = 0; index < values.length; index++) {
    prefix[index + 1] = prefix[index] + values[index];
  }
  const result = new Float64Array(values.length - width + 1);
  for (let index = 0; index < result.length; index++) {
    result[index] = (prefix[index + width] - prefix[index]) / width;
  }
  return result;
}

/** Triangle-smooths ranks with exact endpoints. A zero half-width returns a copy. */
export function smoothRanks(raw: Float32Array, halfWidthSamples: number): Float32Array {
  const { length } = raw;
  if (halfWidthSamples === 0 || length < 3) return raw.slice();

  // Each box pass consumes one half-width of padding at each end.
  const pad = 2 * halfWidthSamples;
  const values = new Float64Array(length + 2 * pad);
  values.fill(raw[0], 0, pad);
  values.set(raw, pad);
  values.fill(raw[length - 1], pad + length);
  const width = pad + 1;
  const smoothed = new Float32Array(boxPass(boxPass(values, width), width));
  smoothed[0] = raw[0];
  smoothed[length - 1] = raw[length - 1];
  return smoothed;
}
