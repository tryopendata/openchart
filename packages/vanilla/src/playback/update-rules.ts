/**
 * The `update()` rules for a playback chart or map (RFC 4.4): which spec changes keep the
 * running playback, and where its playhead lands in the new period list. Each host
 * describes its spec's shape as a list of values; an update keeps the run when the lists
 * match.
 */
import type { PlaybackPeriod, ResolvedPlayback } from '@opendata-ai/openchart-engine';
import type { PlaybackClockState } from './clock';

/** The parts of a compiled playback, chart or map, that the update rules read. */
export interface PlaybackTimeline {
  periods: PlaybackPeriod[];
  timing: ResolvedPlayback;
}

/** The `field` of an encoding channel, or undefined when the channel is absent or has none. */
export function channelField(channel: unknown): unknown {
  if (typeof channel !== 'object' || channel === null) return undefined;
  return (channel as { field?: unknown }).field;
}

function channelType(channel: unknown): unknown {
  if (typeof channel !== 'object' || channel === null) return undefined;
  return (channel as { type?: unknown }).type;
}

/** The part of a time channel's shape an update must keep: its field and type. */
export function timeShape(time: unknown): unknown[] {
  return [channelField(time), channelType(time)];
}

/**
 * Whether an update can keep the running playback: the spec shapes (as a host's `shapeOf`
 * lists them) are equal value for value. Anything else starts over.
 */
export function samePlaybackShape(previous: readonly unknown[], next: readonly unknown[]): boolean {
  return JSON.stringify(previous) === JSON.stringify(next);
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
