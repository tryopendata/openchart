import { interpolateRaceValue } from './matrix';
import { sampleRanks, smoothRanks } from './rank-smoothing';
import type { RaceMatrix, RaceSampleItem, RaceTimeline, RaceTimelineOptions } from './types';

export function createRaceTimeline(matrix: RaceMatrix, options: RaceTimelineOptions): RaceTimeline {
  const { samplesPerPeriod, swapPeriods, rescale } = options;
  const periodCount = matrix.periods.length;
  const keyCount = matrix.keys.length;
  const top = Math.min(options.top, keyCount);
  const halfWidth = Math.round(swapPeriods * (samplesPerPeriod / 4));
  // Keep full ranks for ties and period changes, and smooth the ranks clipped to the fold.
  const exactSamples = sampleRanks(matrix.values, periodCount, samplesPerPeriod, keyCount);
  const smoothedSamples = exactSamples.map((ranks) =>
    smoothRanks(
      ranks.map((rank) => Math.min(rank, top)),
      halfWidth,
    ),
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

  function rankPos(keyIndex: number, t: number): number {
    const sample = clampTime(t) * samplesPerPeriod;
    const ranks = smoothedSamples[keyIndex];
    const start = ranks[Math.floor(sample)];
    const end = ranks[Math.ceil(sample)];
    return start + (end - start) * (sample - Math.floor(sample));
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
        if (!(position < top - 1e-6)) return;

        let change = 0;
        if (periodIndex > 0) {
          const ranks = exactSamples[keyIndex];
          const previous = ranks[(periodIndex - 1) * samplesPerPeriod];
          const current = ranks[periodIndex * samplesPerPeriod];
          if (previous < keyCount && current < keyCount) change = previous - current;
        }

        items.push({
          keyIndex,
          value,
          rank,
          rankPos: position,
          opacity: Math.min(1, top - position),
          change,
        });
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
