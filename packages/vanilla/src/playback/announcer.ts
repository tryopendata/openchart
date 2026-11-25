/**
 * Polite live region for playback charts. It speaks the playhead only when a reader
 * stops or moves it (pause, seek, step), never while playback runs, so screen readers
 * aren't flooded with a message per frame.
 */
import type { PlaybackClockState } from './clock';

/** What changed the playhead. Only `pause`, `seek` and `step` are announced. */
export type PlaybackAnnounceCause = 'play' | 'tick' | 'pause' | 'seek' | 'step';

/** Where the live region goes and how the playhead reads aloud. */
export interface PlaybackAnnouncerOptions {
  /** Element the polite live region is appended to. */
  host: HTMLElement;
  /** Text to announce for the playhead. */
  describe(t: number): string;
}

/** A live region bound to a host, announcing the playhead on reader-driven changes. */
export interface PlaybackAnnouncer {
  /** The polite, atomic live region. */
  readonly element: HTMLElement;
  /** Announce `describe(state.t)` on pause, seek or step while not playing; ignore everything else. */
  notify(cause: PlaybackAnnounceCause, state: Pick<PlaybackClockState, 't' | 'playing'>): void;
  /** Move the live region to a new host, keeping its text. */
  attach(host: HTMLElement): void;
  /** Remove the live region. Later calls are no-ops. */
  destroy(): void;
}

const ANNOUNCED_CAUSES: ReadonlySet<PlaybackAnnounceCause> = new Set(['pause', 'seek', 'step']);

/** Create a live region that announces the playhead only when a reader stops or moves it. */
export function createPlaybackAnnouncer(options: PlaybackAnnouncerOptions): PlaybackAnnouncer {
  const { host, describe } = options;
  const element = host.ownerDocument.createElement('div');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  host.append(element);
  let destroyed = false;

  return {
    element,
    notify(cause, state) {
      if (destroyed || state.playing || !ANNOUNCED_CAUSES.has(cause)) return;
      element.textContent = describe(state.t);
    },
    attach(nextHost) {
      if (destroyed) return;
      nextHost.append(element);
    },
    destroy() {
      destroyed = true;
      element.remove();
    },
  };
}
