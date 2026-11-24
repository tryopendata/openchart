import type { RaceLineStatic } from '@opendata-ai/openchart-core';
import type { RaceTimeline } from './types';

type VisibilityRun = RaceLineStatic['history'][number]['runs'][number];

const VISIBILITY_EPSILON = 1e-6;

/** Visibility on the timeline grid, with the same fractional edges used by the line mark. */
export function lineVisibilityRuns(
  timeline: RaceTimeline,
  key: number,
  values: Float64Array,
): VisibilityRun[] {
  const { samplesPerPeriod } = timeline;
  const threshold = timeline.top - VISIBILITY_EPSILON;
  const runs: VisibilityRun[] = [];
  function add(start: number, end: number, startRank: number, endRank: number) {
    const peakOpacity = Math.min(1, timeline.top - Math.min(startRank, endRank));
    const fullRank = timeline.top - 1;
    let peakTime = end;
    if (endRank > startRank && endRank > fullRank) {
      const fraction = Math.max(0, (fullRank - startRank) / (endRank - startRank));
      peakTime = start + fraction * (end - start);
    }
    const previous = runs.at(-1);
    if (previous && previous.end === start) {
      previous.end = end;
      if (peakOpacity >= previous.peakOpacity) {
        previous.peakOpacity = peakOpacity;
        previous.peakTime = peakTime;
      }
    } else {
      runs.push({ start, end, peakTime, peakOpacity });
    }
  }

  for (let period = 0; period < values.length; period++) {
    if (!Number.isFinite(values[period])) continue;
    let rank = timeline.rankPos(key, period);
    if (rank < threshold) add(period, period, rank, rank);
    if (!Number.isFinite(values[period + 1])) continue;

    // The timeline interpolates smoothed ranks between these samples. Use the
    // crossing time so a direct seek and a sequence of draws see the same history.
    for (let sample = 0; sample < samplesPerPeriod; sample++) {
      const start = period + sample / samplesPerPeriod;
      const end = period + (sample + 1) / samplesPerPeriod;
      const nextRank = timeline.rankPos(key, end);
      if (rank < threshold && nextRank < threshold) {
        add(start, end, rank, nextRank);
      } else if (rank < threshold || nextRank < threshold) {
        const crossing = start + ((threshold - rank) / (nextRank - rank)) * (end - start);
        if (rank < threshold) add(start, crossing, rank, threshold);
        else add(crossing, end, threshold, nextRank);
      }
      rank = nextRank;
    }
  }
  return runs;
}

export function departingLineOpacity(run: VisibilityRun, t: number): number {
  const expiry = run.end + 1;
  return t < run.peakTime ? 0 : run.peakOpacity * ((expiry - t) / (expiry - run.peakTime));
}
