import type { RaceGeometry, RaceLayout, RaceMarkType } from '@opendata-ai/openchart-core';
import { createRaceBarRenderer } from './render-bar';
import { createRaceLineRenderer } from './render-line';
import { createRaceTableRenderer } from './render-table';
import type { RaceMarkHost } from './shell';

/** Creates a mark renderer from a shell host, static layout, and a scope for renderer IDs. */
export type RaceRendererFactory<TMark extends RaceMarkType> = (
  host: RaceMarkHost<TMark>,
  stat: Extract<RaceLayout, { mark: TMark }>['static'],
  idScope: string,
) => {
  draw(geometry: Extract<RaceGeometry, { mark: TMark }>): void;
  destroy(): void;
};

/** Maps each registered race mark to its renderer factory. */
export const RACE_RENDERERS: { [TMark in RaceMarkType]?: RaceRendererFactory<TMark> } = {
  bar: createRaceBarRenderer,
  line: createRaceLineRenderer,
  table: createRaceTableRenderer,
};
