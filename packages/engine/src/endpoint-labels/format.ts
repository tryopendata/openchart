/**
 * Shared value-formatting helpers for the endpoint-labels predictor and
 * compute pass. Keeping the format-string path in one place guarantees
 * predicted column width matches the eventual rendered text.
 */

import { format as d3Format } from 'd3-format';

/**
 * Format a value with a d3-format string, falling back to String() on
 * unknown specifiers. When no format string is supplied, applies a
 * sensible default: integers under 1000 render as-is, anything else gets
 * two decimals.
 */
export function formatEndpointValue(
  value: number | string | null,
  formatString: string | undefined,
): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (formatString) {
    try {
      return d3Format(formatString)(value);
    } catch {
      return String(value);
    }
  }
  if (Number.isInteger(value) && Math.abs(value) < 1000) return String(value);
  return value.toFixed(2);
}
