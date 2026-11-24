import { interpolateRaceValue } from './interpolate';
import { sampleRanks, smoothRanks } from './rank-smoothing';
import type { RaceMatrix, RaceSampleItem, RaceTimeline, RaceTimelineOptions } from './types';

const PRESENCE_FADE = 1;
const PRESENCE_PIN = 2;
const VISIBILITY_EPSILON = 1e-6;

function presenceEdges(
  ranks: Float32Array,
  absentRank: number,
  radius: number,
): Uint8Array | undefined {
  if (!ranks.includes(absentRank)) return undefined;

  const edges = new Uint8Array(ranks.length);
  for (let start = 0; start < ranks.length; ) {
    if (ranks[start] === absentRank) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < ranks.length && ranks[end] !== absentRank) end++;

    // The triangle sees two box half-widths in each direction.
    if (start > 0) edges.fill(PRESENCE_FADE, start, Math.min(end, start + 2 * radius + 1));
    if (end < ranks.length) edges.fill(PRESENCE_FADE, Math.max(start, end - 2 * radius - 1), end);
    if (start > 0) edges.fill(PRESENCE_PIN, start, Math.min(end, start + radius + 1));
    if (end < ranks.length) edges.fill(PRESENCE_PIN, Math.max(start, end - radius - 1), end);
    start = end;
  }
  return edges;
}

function clipVisibleRanks(
  exact: Float32Array[],
  edges: Array<Uint8Array | undefined>,
  top: number,
): Float32Array[] {
  if (edges.every((edge) => edge === undefined)) {
    return exact.map((ranks) => ranks.map((rank) => Math.min(rank, top)));
  }

  const keyCount = exact.length;
  const sampleCount = exact[0].length;
  const visible = exact.map(() => new Float32Array(sampleCount));
  const skippedByRank = new Uint32Array(keyCount);
  for (let sample = 0; sample < sampleCount; sample++) {
    skippedByRank.fill(0);
    for (let key = 0; key < keyCount; key++) {
      if (edges[key]?.[sample] === PRESENCE_PIN) skippedByRank[exact[key][sample]] = 1;
    }
    // A pinned key occupies no slot, so its peers stay in place until it starts moving.
    for (let rank = 1; rank < keyCount; rank++) skippedByRank[rank] += skippedByRank[rank - 1];
    for (let key = 0; key < keyCount; key++) {
      const rank = exact[key][sample];
      visible[key][sample] =
        rank === keyCount || edges[key]?.[sample] === PRESENCE_PIN
          ? top
          : Math.min(rank - skippedByRank[rank], top);
    }
  }
  return visible;
}

/** Builds and owns the timeline's exact and smoothed rank caches. Clamps top to the key count. */
export function createRaceTimeline(matrix: RaceMatrix, options: RaceTimelineOptions): RaceTimeline {
  const { samplesPerPeriod, swapPeriods, rescale } = options;
  const periodCount = matrix.periods.length;
  const lastSample = (periodCount - 1) * samplesPerPeriod;
  const keyCount = matrix.keys.length;
  const top = Math.min(options.top, keyCount);
  const halfWidth = Math.min(lastSample + 1, Math.round(swapPeriods * (samplesPerPeriod / 4)));
  // Keep full ranks for ties and period changes, and smooth the ranks clipped to the fold.
  const exactSamples = sampleRanks(matrix.values, periodCount, samplesPerPeriod, keyCount);
  const edges = exactSamples.map((ranks) => presenceEdges(ranks, keyCount, 2 * halfWidth));
  const smoothedSamples = clipVisibleRanks(exactSamples, edges, top).map((ranks) =>
    smoothRanks(ranks, halfWidth),
  );

  let globalMin = 0;
  let globalMax = -Infinity;
  if (rescale === 'fixed') {
    for (const series of matrix.values) {
      for (const value of series) {
        if (!Number.isFinite(value)) continue;
        globalMin = Math.min(globalMin, value);
        globalMax = Math.max(globalMax, value);
      }
    }
  }

  function clampTime(t: number): number {
    return Math.max(0, Math.min(periodCount - 1, t));
  }

  function valueAt(keyIndex: number, t: number): number {
    t = clampTime(t);
    const period = Math.floor(t);
    return interpolateRaceValue(matrix.values[keyIndex], period, t - period);
  }

  function periodRank(keyIndex: number, period: number): number {
    const rank = exactSamples[keyIndex][period * samplesPerPeriod];
    return rank < keyCount ? rank : Infinity;
  }

  function rankPos(keyIndex: number, t: number): number {
    const sample = clampTime(t) * samplesPerPeriod;
    if (sample === 0 || sample === lastSample) {
      return Math.min(exactSamples[keyIndex][sample], top);
    }
    const ranks = smoothedSamples[keyIndex];
    const startIndex = Math.floor(sample);
    const start = ranks[startIndex];
    const end = ranks[Math.ceil(sample)];
    return start + (end - start) * (sample - startIndex);
  }

  function rankedValues(t: number): Array<{ keyIndex: number; value: number }> {
    const period = Math.floor(t);
    const nearest = Math.round(t * samplesPerPeriod);
    const present = [];
    for (let keyIndex = 0; keyIndex < keyCount; keyIndex++) {
      const value = interpolateRaceValue(matrix.values[keyIndex], period, t - period);
      if (Number.isFinite(value)) present.push({ keyIndex, value });
    }
    return present.sort(
      (a, b) =>
        b.value - a.value ||
        exactSamples[a.keyIndex][nearest] - exactSamples[b.keyIndex][nearest] ||
        a.keyIndex - b.keyIndex,
    );
  }

  return {
    periodCount,
    keyCount,
    top,
    valueAt,
    rankPos,
    periodRank,
    exactRank(keyIndex, t) {
      const rank = rankedValues(clampTime(t)).findIndex((item) => item.keyIndex === keyIndex);
      return rank === -1 ? Infinity : rank;
    },
    sample(t) {
      t = clampTime(t);
      const periodIndex = Math.floor(t);
      let domainMin = 0;
      let domainMax = -Infinity;
      const items: RaceSampleItem[] = [];

      rankedValues(t).forEach(({ keyIndex, value }, rank) => {
        const position = rankPos(keyIndex, t);
        if (!(position < top - VISIBILITY_EPSILON)) return;

        let change = 0;
        if (periodIndex > 0) {
          const previous = periodRank(keyIndex, periodIndex - 1);
          const current = periodRank(keyIndex, periodIndex);
          if (Number.isFinite(previous) && Number.isFinite(current)) change = previous - current;
        }

        const item = {
          keyIndex,
          value,
          rank,
          rankPos: position,
          opacity: Math.min(1, top - position),
          change,
        };
        items.push(item);
        domainMin = Math.min(domainMin, value);
        domainMax = Math.max(domainMax, value);
      });

      if (rescale === 'fixed') {
        domainMin = globalMin;
        domainMax = globalMax;
      } else if (typeof rescale === 'object') {
        domainMax = Math.max(rescale.min, domainMax);
      }

      items.sort((a, b) => a.rankPos - b.rankPos || a.keyIndex - b.keyIndex);
      return { t, periodIndex, items, domainMin, domainMax: domainMax > 0 ? domainMax : 1 };
    },
  };
}
