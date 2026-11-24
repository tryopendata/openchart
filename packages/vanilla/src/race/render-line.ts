import type { RaceRendererFactory } from './renderers';

export const createRaceLineRenderer: RaceRendererFactory<'line'> = (_host, _stat, _idScope) => {
  throw new Error('not implemented');
};
