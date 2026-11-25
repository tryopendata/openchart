/** A period as reported to readers of a playback chart. */
export interface PlaybackPeriod {
  index: number;
  value: string | number;
  label: string;
}

/** Playhead and status, including after destroy(). */
export interface PlaybackState {
  /** Continuous period index. */
  t: number;
  playing: boolean;
  speed: number;
  ended: boolean;
  period: PlaybackPeriod;
}

/** Playback control surface shared by races, charts and maps. Matches RaceInstance's methods. */
export interface PlaybackController {
  /** Start or resume playback. Replay from the start after natural completion. */
  play(): void;
  /** Pause playback and cancel any pending visibility-triggered start. */
  pause(): void;
  /**
   * Seek by continuous period index, clamped to the available periods.
   * @throws {RangeError} If t is not finite, including after destroy().
   */
  seek(t: number): void;
  /**
   * Set the playback speed as a multiplier of the authored duration.
   * @throws {RangeError} If speed is not finite and positive, including after destroy().
   */
  setSpeed(speed: number): void;
  /** Read the playhead, speed, playback and completion status, and period. */
  getState(): PlaybackState;
  /** Listen for period crossings and seek destinations. Returns an unsubscribe function. */
  on(event: 'period', cb: (period: PlaybackPeriod) => void): () => void;
}
