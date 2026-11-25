/**
 * Public playback types shared by races, charts and maps: the controller surface a
 * mount exposes, the state and period it reports, and the session a mount builds it from.
 */
import type { PlaybackClockState, PlaybackFrameScheduler } from './clock';

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

/** Resolved timing the session plays. */
export interface PlaybackSessionTiming {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  autoplay: 'visible' | boolean;
  controls: boolean;
}

/** What a session plays, how it draws, and the environment hooks tests can replace. */
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
  /**
   * Called with the playhead when a pause, seek or step leaves playback stopped, for
   * callers that keep their own live region (the race).
   */
  onAnnounce?(t: number): void;
  /** Control class prefix. Defaults to `oc-playback`; the race passes `oc-race`. */
  classPrefix?: string;
  /** Leads RangeError messages. Defaults to `Playback`; the race passes `Race`. */
  subject?: string;
  /** False (the spec's `animation: false`) opens on the final period without autoplay. */
  animate?: boolean;
  /** Restore playback from getState(). */
  initialState?: PlaybackClockState;
  /**
   * True leaves autoplay and restored playback for `start()`, so a mount can render
   * first. By default the session starts as it is created.
   */
  deferStart?: boolean;
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

/** A playback controller plus the hooks its mount uses to render, retime and tear down. */
export interface PlaybackSession extends PlaybackController {
  /** Begin autoplay or resume restored playback. Runs once; later calls are no-ops. */
  start(): void;
  /** Mount (or move) the controls and live region into a freshly rendered view. */
  attach(hosts: PlaybackSessionHosts): void;
  /** The controls strip currently mounted, if any. */
  readonly controlsElement: HTMLElement | null;
  /**
   * Rebuild the clock for new timing or labels, keeping the clamped playhead and resuming
   * if playing. A period change it causes waits for `syncPeriod()`.
   */
  retime(timing: PlaybackSessionTiming, periodLabels: string[]): void;
  /** Emit the period change left by `retime()`. Call once the retimed view is in the document. */
  syncPeriod(): void;
  /** Raw clock state. */
  getClockState(): PlaybackClockState;
  /** Stop the clock, cancel visibility autoplay, remove controls and the live region. Safe to repeat. */
  destroy(): void;
}
