import type { RaceEncoding } from '@opendata-ai/openchart-core';
import type { RaceMatrix, RaceTimeline } from './types';

export function assignRaceColors(
  _matrix: RaceMatrix,
  _timeline: RaceTimeline,
  _palette: readonly string[],
  _colorEncoding: RaceEncoding['color'],
  _keyField: string,
): string[] {
  throw new Error('not implemented');
}
