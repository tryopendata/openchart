import type { RaceGeometry, RaceLayout, RaceMarkType } from '@opendata-ai/openchart-core';
import type { RaceMarkHost } from './shell';

export type RaceRendererFactory<TMark extends RaceMarkType> = (
  host: RaceMarkHost<TMark>,
  stat: Extract<RaceLayout, { mark: TMark }>['static'],
  idScope: string,
) => {
  draw(geometry: Extract<RaceGeometry, { mark: TMark }>): void;
  destroy(): void;
};

export const RACE_RENDERERS: { [TMark in RaceMarkType]?: RaceRendererFactory<TMark> } = {};
