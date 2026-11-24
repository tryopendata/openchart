import type { CompileOptions, RaceLayout, RaceMarkDef } from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

/** The optional mark overrides the model spec's mark for runtime swaps. */
export function layoutRace(
  _model: RaceModel,
  _options: CompileOptions & { mark?: RaceMarkDef },
): RaceLayout {
  throw new Error('not implemented');
}
