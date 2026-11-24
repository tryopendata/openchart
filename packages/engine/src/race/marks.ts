import type {
  MeasureTextFn,
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkDef,
  RaceMarkType,
} from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

export interface RaceMarkEntry<TMark extends RaceMarkType> {
  /** Measure the text this mark needs. The bar name gutter uses `layout.labels`. */
  computeStatic(
    model: RaceModel,
    layout: Omit<RaceLayout, 'mark' | 'static'>,
    mark: Extract<RaceMarkDef, { type: TMark }>,
    measureText: MeasureTextFn,
  ): Extract<RaceLayout, { mark: TMark }>['static'];
  geometry(
    model: RaceModel,
    layout: Extract<RaceLayout, { mark: TMark }>,
    frame: RaceFrame,
  ): Extract<RaceGeometry, { mark: TMark }>;
}

export const RACE_MARKS: { [TMark in RaceMarkType]?: RaceMarkEntry<TMark> } = {};
