import type { RaceLayout, RaceMarkType } from '@opendata-ai/openchart-core';

export type RaceMarkHost<TMark extends RaceMarkType> = TMark extends 'table'
  ? HTMLElement
  : SVGGElement;

export interface RaceShell<TMark extends RaceMarkType = RaceMarkType> {
  root: HTMLElement;
  svg: SVGSVGElement;
  markHost: RaceMarkHost<TMark>;
  controlsSlot: HTMLElement;
}

export function createRaceShell<TLayout extends RaceLayout>(
  _container: HTMLElement,
  _layout: TLayout,
  _idScope: string,
): RaceShell<TLayout['mark']> {
  throw new Error('not implemented');
}
