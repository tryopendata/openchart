/**
 * Data filter for clipped scale domains.
 *
 * When an x or y encoding declares `scale.clip: true`, rows whose field value
 * falls outside the declared domain are dropped before scales and marks are
 * computed. Pure and side-effect free.
 *
 * Two domain forms, two semantics:
 * - Numeric `[lo, hi]`: a RANGE. Rows are kept when `lo <= value <= hi`.
 * - Categorical `string[]`: a MEMBERSHIP SET. Rows are kept when the value is
 *   listed. A categorical domain enumerates its categories rather than bounding
 *   them, so range comparison would be meaningless (and lexicographic on years
 *   would only work by accident).
 */

import type { DataRow, Encoding } from '@opendata-ai/openchart-core';

/**
 * Return a new data array with rows outside any clipped scale domain removed.
 *
 * Only inspects the `x` and `y` channels. Channels without `scale.clip` (or
 * without a `scale.domain` to clip to) are passed through unchanged.
 */
export function filterClippedDomains(data: DataRow[], encoding: Encoding): DataRow[] {
  let result = data;
  for (const channel of ['x', 'y'] as const) {
    const enc = encoding[channel];
    if (!enc?.scale?.clip || !enc.scale.domain) continue;
    const domain = enc.scale.domain;
    const field = enc.field;
    if (!Array.isArray(domain)) continue;

    if (domain.length === 2 && typeof domain[0] === 'number') {
      const [lo, hi] = domain as [number, number];
      result = result.filter((row) => {
        const v = Number(row[field]);
        return Number.isFinite(v) && v >= lo && v <= hi;
      });
    } else if (typeof domain[0] === 'string') {
      // Compare as strings: a categorical domain is authored as string[], but
      // the underlying row value may be a number (e.g. a year column), so
      // `domain.includes(row[field])` would miss on a type mismatch.
      const allowed = new Set(domain as string[]);
      result = result.filter((row) => allowed.has(String(row[field])));
    }
  }
  return result;
}
