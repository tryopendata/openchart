/** Recognizing specs that carry a playback time channel. */

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
