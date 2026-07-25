import type { ResolvedAnnotation } from '@opendata-ai/openchart-core';

/**
 * Stable identity for an annotation across layout snapshots.
 *
 * Annotations have no engine-assigned `mark.key`. When the author supplies
 * `annotation.id` that is the identity; otherwise fall back to type + text,
 * which is stable as long as the annotation keeps saying the same thing.
 *
 * Deliberately NOT keyed on position: an annotation that moves is the same
 * annotation and should tween to its new spot, not cross-fade with itself.
 * And deliberately NOT `data-annotation-index`: that is positional, so
 * inserting an annotation ahead of another would renumber it and make every
 * later annotation look brand new and re-fade.
 *
 * Duplicate keys (same type and text twice) are disambiguated by occurrence
 * order in `keyAnnotations` below, not here.
 */
export function annotationKey(a: ResolvedAnnotation): string {
  if (a.id) return `id:${a.id}`;
  return `${a.type}:${a.label?.text ?? ''}`;
}

/**
 * Key a layout's annotations, suffixing duplicates so every key is unique
 * within the snapshot. Two annotations sharing a key would otherwise both
 * match the same element and fight over it.
 */
export function keyAnnotations(annotations: ResolvedAnnotation[]): string[] {
  const seen = new Map<string, number>();
  return annotations.map((a) => {
    const base = annotationKey(a);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}
