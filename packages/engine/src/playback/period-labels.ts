import type { EncodingChannel } from '@opendata-ai/openchart-core';
import type { PlaybackPeriod } from './periods';

/**
 * Formats temporal periods from the matrix's UTC sort keys. A four-digit integer
 * equal to its sort key prints as a year by default and uses January 1 for explicit formats.
 * Automatic labels use years if all dates are January 1, months if all dates are
 * the first of a month, and days otherwise.
 */
export function formatPeriodLabels(periods: PlaybackPeriod[], time: EncodingChannel): string[] {
  void periods;
  void time;
  throw new Error('not implemented');
}
