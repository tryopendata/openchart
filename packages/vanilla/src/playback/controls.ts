import type { PlaybackClockState } from './clock';

export interface PlaybackControlsOptions {
  /**
   * Class prefix for the strip and its parts (`<prefix>-controls`, `-play`, `-scrub`,
   * `-readout`) and the scrubber's `--<prefix>-progress` property. The race passes `oc-race`.
   */
  classPrefix: string;
  periodLabels: string[];
  onToggle(): void;
  onSeek(t: number): void;
  onStep(delta: 1 | -1): void;
}

/** A control strip whose caller supplies playback state through `update()`. */
export interface PlaybackControls {
  readonly element: HTMLElement;
  update(state: PlaybackClockState): void;
  destroy(): void;
}

/** Create a detached control strip. Call `update()` when playback state changes. */
export function createPlaybackControls(options: PlaybackControlsOptions): PlaybackControls {
  void options;
  throw new Error('not implemented');
}
