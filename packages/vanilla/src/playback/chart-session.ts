/**
 * Playback for a mounted chart: the shared session (clock, controls, announcer, autoplay)
 * driving the frame writer over the SVG the chart mount rendered.
 */
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import type { PlaybackClockState, PlaybackFrameScheduler } from './clock';
import type { PlaybackController } from './types';

export interface ChartPlaybackMountOptions {
  /** The chart container; the controls strip is appended after the SVG. */
  container: HTMLElement;
  /** The SVG rendered from `playback.base`. */
  svg: SVGElement;
  playback: ChartPlayback;
  darkMode: boolean;
  /** False (the spec's `animation: false`, or edit mode) opens on the final period without autoplay. */
  animate?: boolean;
  /** Restore the playhead after a compatible update. */
  initialState?: PlaybackClockState;
  /** Defaults to animation frames. */
  scheduler?: PlaybackFrameScheduler;
  /** Defaults to the prefers-reduced-motion media query. */
  reducedMotion?: () => boolean;
  /** Defaults to `whenSeen`. Calls `cb` once the element is seen; returns a cancel function. */
  whenSeen?: (element: Element, cb: () => void) => () => void;
}

/** A chart's running playback. */
export interface ChartPlaybackMount {
  /** Play, pause, seek, setSpeed, getState and `period` events, as on `RaceInstance`. */
  controller: PlaybackController;
  /** Draw the frame at `t` without moving the playhead. */
  draw(t: number): void;
  /** Stop the clock and remove the controls strip and live region. Safe to repeat. */
  destroy(): void;
}

/**
 * Start playback on a rendered time chart: mount the controls strip below the SVG (when
 * `controls` is on and there are two or more periods), draw the opening frame, and wire
 * autoplay. Reduced motion and `animate: false` open on the final period without autoplay.
 */
export function mountChartPlayback(options: ChartPlaybackMountOptions): ChartPlaybackMount {
  void options;
  throw new Error('not implemented');
}
