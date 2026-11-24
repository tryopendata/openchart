import type { EncodingChannel } from '@opendata-ai/openchart-core';
import type { RaceMatrix } from './types';

export function formatPeriodLabels(
  _periods: RaceMatrix['periods'],
  _time: EncodingChannel,
): string[] {
  throw new Error('not implemented');
}
