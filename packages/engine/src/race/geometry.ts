import type { RaceFrame, RaceGeometry, RaceLayout } from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

export function raceFrameAt(_model: RaceModel, _t: number): RaceFrame {
  throw new Error('not implemented');
}

export function raceGeometryAt(_model: RaceModel, _layout: RaceLayout, _t: number): RaceGeometry {
  throw new Error('not implemented');
}
