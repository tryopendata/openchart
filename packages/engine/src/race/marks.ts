import type {
  CompileOptions,
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkDef,
  RaceMarkType,
} from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

interface RaceMarkMeasurements {
  maxLabelWidth: number;
  maxValueLabelWidth: number;
}

export interface RaceMarkEntry<TMark extends RaceMarkType> {
  measure(
    model: RaceModel,
    layout: Omit<RaceLayout, 'mark' | 'static'>,
    options: CompileOptions,
  ): RaceMarkMeasurements;
  computeStatic(
    model: RaceModel,
    layout: Omit<RaceLayout, 'mark' | 'static'>,
    mark: Extract<RaceMarkDef, { type: TMark }>,
    measurements: RaceMarkMeasurements,
  ): Extract<RaceLayout, { mark: TMark }>['static'];
  geometry(
    model: RaceModel,
    layout: Extract<RaceLayout, { mark: TMark }>,
    frame: RaceFrame,
  ): Extract<RaceGeometry, { mark: TMark }>;
}

export const RACE_MARKS: { [TMark in RaceMarkType]?: RaceMarkEntry<TMark> } = {};
