/**
 * Data filter for clipped scale domains.
 *
 * When an x or y encoding declares `scale.clip: true` with a numeric
 * [lo, hi] domain, rows whose field value falls outside that range are
 * dropped before scales and marks are computed. Pure and side-effect free.
 */

import type { DataRow, Encoding } from '@opendata-ai/openchart-core';

/**
 * Return a new data array with rows outside any clipped scale domain removed.
 *
 * Only inspects the `x` and `y` channels. Non-numeric domains and channels
 * without `scale.clip` are passed through unchanged.
 */
export function filterClippedDomains(data: DataRow[], encoding: Encoding): DataRow[] {
  let result = data;
  for (const channel of ['x', 'y'] as const) {
    const enc = encoding[channel];
    if (!enc?.scale?.clip || !enc.scale.domain) continue;
    const domain = enc.scale.domain;
    const field = enc.field;
    if (Array.isArray(domain) && domain.length === 2 && typeof domain[0] === 'number') {
      const [lo, hi] = domain as [number, number];
      result = result.filter((row) => {
        const v = Number(row[field]);
        return Number.isFinite(v) && v >= lo && v <= hi;
      });
    }
  }
  return result;
}
