/**
 * Maps the pinned section's scroll progress to a stop and back. The scrub is
 * split into equal parts, one per stop; the browser island and the pin both use
 * these so a button press and a scroll agree on where each stop lives.
 */

/** The stop shown at `progress` (0 to 1) of a scrub with `count` stops. */
export function stopAt(progress: number, count: number): number {
  if (count <= 0) return 0;
  const clamped = Math.min(Math.max(progress, 0), 1);
  return Math.min(count - 1, Math.floor(clamped * count));
}

/** The progress at the middle of stop `index`, where a button press scrolls to. */
export function progressOf(index: number, count: number): number {
  if (count <= 0) return 0;
  const clamped = Math.min(Math.max(index, 0), count - 1);
  return (clamped + 0.5) / count;
}
