import type { CompileWarning } from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

/** @throws A validation error for invalid specs. @throws {RaceDataError} For invalid data. */
export function prepareRace(
  _spec: unknown,
  _options: { onWarn?: (w: CompileWarning) => void },
): RaceModel {
  throw new Error('not implemented');
}
