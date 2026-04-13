/**
 * Shared numeric value formatter for data labels.
 *
 * Used by bar, column, and dot label computation to display a value:
 * abbreviated (K/M/B/T) for magnitudes >= 1000, otherwise the default
 * numeric format.
 */

import { abbreviateNumber, formatNumber } from '@opendata-ai/openchart-core';

/** Format a label value for display (abbreviate large numbers). */
export function formatLabelValue(value: number): string {
  if (Math.abs(value) >= 1000) return abbreviateNumber(value);
  return formatNumber(value);
}
