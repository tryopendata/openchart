import { interpolateRaceValue } from './matrix';

/** Uses key index order as the final tie-break. */
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

export function smoothRanks(raw: Float32Array, halfWidthSamples: number): Float32Array {
  const { length } = raw;
  if (halfWidthSamples === 0 || length < 3) return raw.slice();

  const smoothed = new Float32Array(length);
  const first = raw[0];
  const last = raw[length - 1];
  const width = 2 * halfWidthSamples + 1;
  if (Number.isFinite(width)) {
    // Two box passes sum a prefix sum twice. Extend both sums using the original
    // endpoint ranks so the second box sees the first box's full edge response.
    const prefixOfPrefix = new Float64Array(length + 1);
    let prefix = 0;
    for (let index = 0; index < length; index++) {
      prefixOfPrefix[index + 1] = prefixOfPrefix[index] + prefix;
      prefix += raw[index];
    }

    // Keep the squared window width and padded sums finite.
    const scale = Math.max(1, width / Number.MAX_SAFE_INTEGER);
    const divisor = (width / scale) ** 2;
    function paddedSum(index: number): number {
      if (index < 0) return ((index / scale) * ((index - 1) / scale) * first) / 2;
      if (index <= length) return prefixOfPrefix[index] / scale / scale;
      const extra = index - length;
      return (
        prefixOfPrefix[length] / scale / scale +
        (extra / scale) * (prefix / scale) +
        ((extra / scale) * ((extra - 1) / scale) * last) / 2
      );
    }

    for (let index = 1; index < length - 1; index++) {
      const center = index + 1;
      smoothed[index] =
        (paddedSum(center + width) - 2 * paddedSum(center) + paddedSum(center - width)) / divisor;
    }
  } else {
    // For a window wider than a number can represent, the two pads contribute equally.
    smoothed.fill((first + last) / 2);
  }
  // Keep the opening and closing frames at their exact ranks.
  smoothed[0] = first;
  smoothed[length - 1] = last;
  return smoothed;
}
