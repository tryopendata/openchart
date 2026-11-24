import type { RaceFrame } from '@opendata-ai/openchart-core';
import type { RaceModel } from '@opendata-ai/openchart-engine';
import type { RaceShell } from './shell';

export function createRaceA11y(
  _shell: RaceShell,
  _model: RaceModel,
): { announce(frame: RaceFrame): void; destroy(): void } {
  throw new Error('not implemented');
}
