/**
 * Mark key utilities for data-update transitions.
 *
 * Keys uniquely identify marks across data updates so the renderer can
 * match old marks to new marks and animate the difference. Each chart
 * type stamps keys during its compute phase; these helpers provide the
 * shared serialization and deduplication logic.
 */

/** Sentinel string for null/undefined values. Uses a Unicode symbol
 *  that won't collide with real data values. */
const NULL_KEY = '∅';

/**
 * Serialize a datum value into a stable key fragment.
 * - Date -> epoch ms string (avoids locale-dependent Date.toString)
 * - number/string/boolean -> String(v)
 * - null/undefined -> null sentinel
 */
export function serializeKeyValue(v: unknown): string {
  if (v === null || v === undefined) return NULL_KEY;
  if (v instanceof Date) return String(v.getTime());
  return String(v);
}

/**
 * Append `:0`, `:1`... occurrence suffixes to duplicate keys, in order.
 *
 * Only keys that appear more than once get suffixed. Unique keys pass
 * through unchanged so keys remain human-readable when possible.
 */
export function dedupeKeys(keys: string[]): string[] {
  // Count occurrences
  const counts = new Map<string, number>();
  for (const k of keys) {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  // Assign suffixes only to duplicates
  const seen = new Map<string, number>();
  const result: string[] = [];
  for (const k of keys) {
    if (counts.get(k)! > 1) {
      const idx = seen.get(k) ?? 0;
      result.push(`${k}:${idx}`);
      seen.set(k, idx + 1);
    } else {
      result.push(k);
    }
  }

  return result;
}
