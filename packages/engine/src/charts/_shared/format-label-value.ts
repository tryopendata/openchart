/**
 * Shared numeric value formatter for data labels.
 *
 * Used by bar, column, and dot label computation to display a value
 * with smart compact defaults (k/M/B/T).
 */

import type { FieldFormatContext } from '@opendata-ai/openchart-core';
import { defaultNumberFormatter } from '@opendata-ai/openchart-core';

/** Format a label value for display (compact by default). */
export function formatLabelValue(value: number, ctx?: FieldFormatContext): string {
  return defaultNumberFormatter(ctx)(value);
}
