/** Recognizing specs that carry a playback time channel. */

/**
 * The RFC 2.7 warning for a spec with a `playback` block but nothing to play, naming the
 * time channels that would make it play (e.g. `encoding.time`). Undefined without a
 * `playback` block. Callers decide whether the spec plays.
 */
export function playbackWithoutTimeWarning(
  spec: unknown,
  timeChannels: string,
): string | undefined {
  if (typeof spec !== 'object' || spec === null) return undefined;
  if ((spec as { playback?: unknown }).playback === undefined) return undefined;
  return `playback is ignored without ${timeChannels}`;
}

/**
 * Whether a raw spec sets `encoding.time` (any non-null value, so a malformed channel still
 * reaches time validation). Compile, validation and the mounts branch on this, so a spec
 * without `time` never reaches playback code.
 */
export function hasTimeEncoding(spec: unknown): boolean {
  if (typeof spec !== 'object' || spec === null) return false;
  const encoding = (spec as { encoding?: unknown }).encoding;
  if (typeof encoding !== 'object' || encoding === null) return false;
  return (encoding as { time?: unknown }).time != null;
}
