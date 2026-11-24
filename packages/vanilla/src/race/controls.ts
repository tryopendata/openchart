import type { RaceClockState } from './clock';

export interface RaceControlsOptions {
  periodLabels: string[];
  onToggle(): void;
  onSeek(t: number): void;
  onStep(delta: 1 | -1): void;
}

export interface RaceControls {
  readonly element: HTMLElement;
  update(state: RaceClockState): void;
  destroy(): void;
}

export function createRaceControls(_options: RaceControlsOptions): RaceControls {
  throw new Error('not implemented');
}
