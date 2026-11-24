export interface RaceFrameScheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export interface RaceClockState {
  t: number;
  playing: boolean;
  speed: number;
  ended: boolean;
}

export interface RaceClockOptions {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  onTick: (t: number) => void;
  onStateChange?: (state: RaceClockState) => void;
  /** Defaults to requestAnimationFrame and cancelAnimationFrame. */
  scheduler?: RaceFrameScheduler;
}

export interface RaceClock {
  play(): void;
  pause(): void;
  toggle(): void;
  /** @throws {RangeError} If t is non-finite. */
  seek(t: number): void;
  stepPeriod(delta: 1 | -1): void;
  /** @throws {RangeError} If speed is non-positive or non-finite. */
  setSpeed(speed: number): void;
  getState(): RaceClockState;
  destroy(): void;
}

export function createRaceClock(_options: RaceClockOptions): RaceClock {
  throw new Error('not implemented');
}
