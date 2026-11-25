import type { PlaybackClockState, PlaybackFrameScheduler } from './clock';
import type { PlaybackController, PlaybackPeriod } from './types';

/** Resolved timing the session plays. */
export interface PlaybackSessionTiming {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  autoplay: 'visible' | boolean;
  controls: boolean;
}

export interface PlaybackSessionOptions {
  /** Element watched for visibility autoplay. */
  container: HTMLElement;
  timing: PlaybackSessionTiming;
  /** Readout and scrubber labels, one per period. */
  periodLabels: string[];
  /** The period reported by getState() and `period` events. */
  periodAt(index: number): PlaybackPeriod;
  /** Draw the playhead. Called on every tick and seek. */
  draw(t: number): void;
  /** Announcement text for the playhead. Omit to announce nothing. */
  describe?(t: number): string;
  /** Control class prefix. Defaults to `oc-playback`; the race passes `oc-race`. */
  classPrefix?: string;
  /** False (the spec's `animation: false`) opens on the final period without autoplay. */
  animate?: boolean;
  /** Restore playback from getState(). */
  initialState?: PlaybackClockState;
  /** Defaults to animation frames. */
  scheduler?: PlaybackFrameScheduler;
  /** Defaults to the prefers-reduced-motion media query. True forces stepped playback, no autoplay, and opens on the final period. */
  reducedMotion?: () => boolean;
  /** Defaults to `whenSeen`. Calls `cb` once the element is seen; returns a cancel function. */
  whenSeen?: (element: Element, cb: () => void) => () => void;
}

/** Where the session mounts its controls strip and live region on each render. */
export interface PlaybackSessionHosts {
  /** Controls slot; null or omitted when the view shows no controls. */
  controls?: HTMLElement | null;
  /** Host for the live region. */
  announcer?: HTMLElement;
}

export interface PlaybackSession extends PlaybackController {
  /** Mount (or move) the controls and live region into a freshly rendered view. */
  attach(hosts: PlaybackSessionHosts): void;
  /** The controls strip currently mounted, if any. */
  readonly controlsElement: HTMLElement | null;
  /** Rebuild the clock for new timing or labels, keeping the clamped playhead and resuming if playing. */
  retime(timing: PlaybackSessionTiming, periodLabels: string[]): void;
  /** Raw clock state. */
  getClockState(): PlaybackClockState;
  /** Stop the clock, cancel visibility autoplay, remove controls and the live region. Safe to repeat. */
  destroy(): void;
}

/**
 * Own a playback run: clock, controls, announcer, visibility autoplay and reduced-motion
 * stepping, the wiring the race mount does inline today. The caller draws.
 */
export function createPlaybackSession(options: PlaybackSessionOptions): PlaybackSession {
  void options;
  throw new Error('not implemented');
}
