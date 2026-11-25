/**
 * The `update()` rules for a playback chart (RFC 4.4): which spec changes keep the running
 * playback, and where its playhead lands in the new period list.
 */
import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import type { PlaybackClockState } from './clock';

/** The parts of a compiled playback, chart or map, that the update rules read. */
export type PlaybackTimeline = Pick<ChartPlayback, 'periods' | 'timing'>;

function markType(spec: ChartSpec): string {
  return typeof spec.mark === 'string' ? spec.mark : spec.mark.type;
}

function channelField(channel: unknown): string | undefined {
  if (typeof channel !== 'object' || channel === null) return undefined;
  const { field } = channel as { field?: unknown };
  return typeof field === 'string' ? field : undefined;
}

function timeType(spec: ChartSpec): unknown {
  return (spec.encoding as { time?: { type?: unknown } }).time?.type;
}

/**
 * Whether an update can keep the running playback: the same mark type, time field and type,
 * and identity field. Anything else starts over.
 */
export function samePlaybackShape(previous: ChartSpec, next: ChartSpec): boolean {
  const before = previous.encoding as Record<string, unknown>;
  const after = next.encoding as Record<string, unknown>;
  return (
    markType(previous) === markType(next) &&
    channelField(before.time) === channelField(after.time) &&
    timeType(previous) === timeType(next) &&
    channelField(before.key) === channelField(after.key)
  );
}

/**
 * Where a playhead at `t` in `previous` lands in `next`: on the same period value, keeping
 * the progress toward the following period, or on the period nearest by sort key when that
 * value is gone.
 */
export function carriedPlayhead(
  previous: PlaybackTimeline,
  next: PlaybackTimeline,
  t: number,
): number {
  const last = next.periods.length - 1;
  if (last < 0) return 0;
  const index = Math.max(0, Math.min(previous.periods.length - 1, Math.floor(t)));
  const period = previous.periods[index];
  if (!period) return 0;
  const same = next.periods.findIndex((candidate) => candidate.value === period.value);
  if (same >= 0) return Math.min(last, same + (t - index));
  let nearest = 0;
  for (let candidate = 1; candidate <= last; candidate += 1) {
    const distance = Math.abs(next.periods[candidate].sortKey - period.sortKey);
    if (distance < Math.abs(next.periods[nearest].sortKey - period.sortKey)) nearest = candidate;
  }
  return nearest;
}

/**
 * The opening state after an update that starts over: the final period when autoplay is off,
 * else undefined so the session opens as on a fresh mount.
 */
export function resetPlayhead(next: PlaybackTimeline): PlaybackClockState | undefined {
  if (next.timing.autoplay !== false) return undefined;
  return { t: Math.max(0, next.periods.length - 1), playing: false, speed: 1, ended: false };
}
