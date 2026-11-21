/**
 * Where an entry sits in the gallery: the entries before and after it in wall
 * order, and the others to suggest under it, same kind first.
 */
import type { GalleryEntry } from "../../lib/gallery-types";

/** The entries either side of `entry` in wall order; the first has no previous, the last no next. */
export function pagerFor(
  entries: readonly GalleryEntry[],
  entry: GalleryEntry,
): { previous?: GalleryEntry; next?: GalleryEntry } {
  const index = entries.indexOf(entry);
  return { previous: entries[index - 1], next: entries[index + 1] };
}

/**
 * Up to `count` other entries to show under `entry`: those of its kind in wall
 * order, then, when its kind has too few, the entries that follow it on the
 * wall, wrapping round to the start.
 */
export function relatedTo(
  entries: readonly GalleryEntry[],
  entry: GalleryEntry,
  count: number,
): GalleryEntry[] {
  const others = entries.filter((candidate) => candidate !== entry);
  const sameKind = others.filter((candidate) => candidate.kind === entry.kind);
  const index = entries.indexOf(entry);
  const following = [...entries.slice(index + 1), ...entries.slice(0, index)].filter(
    (candidate) => candidate.kind !== entry.kind,
  );
  return [...sameKind, ...following].slice(0, count);
}
