import type { RaceFrame } from '@opendata-ai/openchart-core';
import type { RaceMatrix, RaceSample } from './types';

export interface RacePresentation {
  keys: string[];
  labels: string[];
  colors: string[];
  formatValue: (value: number) => string;
  periods: RaceMatrix['periods'];
  periodLabels: string[];
  summary: boolean;
}

export function buildRaceFrame(_sample: RaceSample, _presentation: RacePresentation): RaceFrame {
  throw new Error('not implemented');
}
