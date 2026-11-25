/** Counting the sides a mirrored bar chart's color field splits its rows into. */

/** At most this many values are quoted when a color field has the wrong count. */
const SHOWN_VALUES = 5;

/**
 * The distinct values of `field` across `rows`, in first-seen order. A row with no value
 * picks no side, so it doesn't count.
 */
export function mirrorSideValues(rows: unknown[], field: string): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const value = (row as Record<string, unknown>)[field];
    if (value !== undefined && value !== null) values.add(String(value));
  }
  return [...values];
}

/** Up to five of `values`, comma separated, for an error or warning message. */
export function quoteSideValues(values: string[]): string {
  return values.slice(0, SHOWN_VALUES).join(', ');
}

/**
 * The warning for transformed rows that don't split into exactly two sides on `field`, else
 * undefined. Validation counts authored rows; this covers specs whose transforms decide the
 * sides.
 */
export function mirrorSidesWarning(rows: unknown[], field: string): string | undefined {
  const values = mirrorSideValues(rows, field);
  if (values.length === 2) return undefined;
  return `mark.mirror needs a color field with exactly two values; after transforms "${field}" has ${values.length} (${quoteSideValues(values)}). Filter the rows to two groups.`;
}
