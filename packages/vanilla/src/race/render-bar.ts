import type { RaceBarGeometry, RaceBarStatic } from '@opendata-ai/openchart-core';

export interface RaceBarRenderer {
  draw(geometry: RaceBarGeometry): void;
  destroy(): void;
}

export function createRaceBarRenderer(
  _host: SVGGElement,
  _stat: RaceBarStatic,
  _idScope: string,
): RaceBarRenderer {
  throw new Error('not implemented');
}
