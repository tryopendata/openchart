import type { RaceRendererFactory } from './renderers';

export const createRaceTableRenderer: RaceRendererFactory<'table'> = (_host, _stat, _idScope) => {
  throw new Error('not implemented');
};
