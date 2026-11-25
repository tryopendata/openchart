export interface PlaybackFrameScheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export interface PlaybackClockState {
  t: number;
  playing: boolean;
  speed: number;
  ended: boolean;
}

/** Playback settings and callbacks for a clock that requests frames only while playing. */
export interface PlaybackClockOptions {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  initialState?: PlaybackClockState;
  onTick: (t: number) => void;
  onStateChange?: (state: PlaybackClockState) => void;
  /** Defaults to requestAnimationFrame and cancelAnimationFrame. */
  scheduler?: PlaybackFrameScheduler;
}

export interface PlaybackClock {
  play(stepPeriods?: boolean): void;
  pause(): void;
  toggle(): void;
  /** @throws {RangeError} If t is non-finite. */
  seek(t: number): void;
  stepPeriod(delta: 1 | -1): void;
  /** @throws {RangeError} If speed is non-positive or non-finite. */
  setSpeed(speed: number): void;
  getState(): PlaybackClockState;
  destroy(): void;
}

/** Create a clock driven by the supplied scheduler or browser animation frames. */
export function createPlaybackClock(options: PlaybackClockOptions): PlaybackClock {
  void options;
  throw new Error('not implemented');
}
