import type { PlaybackClockState } from './clock';

/** What changed the playhead. Only `pause`, `seek` and `step` are announced. */
export type PlaybackAnnounceCause = 'play' | 'tick' | 'pause' | 'seek' | 'step';

export interface PlaybackAnnouncerOptions {
  /** Element the polite live region is appended to. */
  host: HTMLElement;
  /** Text to announce for the playhead. */
  describe(t: number): string;
}

export interface PlaybackAnnouncer {
  /** The polite, atomic live region. */
  readonly element: HTMLElement;
  /** Announce `describe(state.t)` on pause, seek or step while not playing; ignore everything else. */
  notify(cause: PlaybackAnnounceCause, state: PlaybackClockState): void;
  /** Move the live region to a new host, keeping its text. */
  attach(host: HTMLElement): void;
  /** Remove the live region. Later calls are no-ops. */
  destroy(): void;
}

/** Create a live region that announces the playhead only when a reader stops or moves it. */
export function createPlaybackAnnouncer(options: PlaybackAnnouncerOptions): PlaybackAnnouncer {
  void options;
  throw new Error('not implemented');
}
