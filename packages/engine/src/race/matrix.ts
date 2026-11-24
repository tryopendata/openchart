import type { DataRow, RaceEncoding } from '@opendata-ai/openchart-core';
import type { RaceMatrix, ResolvedRaceOptions } from './types';

/** @throws {RaceDataError} DUPLICATE_KEY_PERIOD, TOO_FEW_PERIODS, NO_VALUES */
export function buildRaceMatrix(
  _rows: DataRow[],
  _encoding: RaceEncoding,
  _gaps: ResolvedRaceOptions['gaps'],
  _warn: (message: string) => void,
): RaceMatrix {
  throw new Error('not implemented');
}
