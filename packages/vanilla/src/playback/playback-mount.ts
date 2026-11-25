/**
 * Playback over one mounted SVG, shared by charts and maps: the session (clock, controls,
 * announcer, autoplay, reduced-motion stepping) driving a frame writer, with the controls
 * strip below the SVG. The mount outlives re-renders: `rebind()` moves it onto a fresh SVG
 * and a recompiled playback, keeping the play state and every listener.
 */
import type {
  PlaybackPeriod as EnginePeriod,
  ResolvedPlayback,
} from '@opendata-ai/openchart-engine';
import type { PlaybackClockState, PlaybackFrameScheduler } from './clock';
import { createPlaybackSession, type PlaybackSessionTiming } from './session';
import { isPlayable, placeStrip } from './strip';
import type { PlaybackController, PlaybackPeriod } from './types';

/** What the mount reads from any compiled playback, chart or map. */
export interface PlaybackRun {
  periods: EnginePeriod[];
  periodLabels: string[];
  timing: ResolvedPlayback;
  /** One-line summary of the frame at `t` for the live region. */
  describe(t: number): string;
}

/** Draws a playback's frames onto one rendered SVG. */
export interface PlaybackFrameWriter {
  draw(t: number): void;
  /** Drop element references. Leaves the SVG as last drawn. */
  destroy(): void;
}

export interface PlaybackMountOptions<Run extends PlaybackRun> {
  /** The host container; the controls strip goes right after the SVG. */
  container: HTMLElement;
  /** The SVG rendered from the playback's base layout. */
  svg: SVGElement;
  playback: Run;
  darkMode: boolean;
  /** Binds the frame writer for an SVG and the playback it was rendered from. */
  createWriter(svg: SVGElement, playback: Run): PlaybackFrameWriter;
  /** False (the spec's `animation: false`, or edit mode) opens on the final period without autoplay. */
  animate?: boolean;
  /** Restore the playhead after an update. */
  initialState?: PlaybackClockState;
  /** Defaults to animation frames. */
  scheduler?: PlaybackFrameScheduler;
  /** Defaults to the prefers-reduced-motion media query. */
  reducedMotion?: () => boolean;
  /** Defaults to `whenSeen`. Calls `cb` once the element is seen; returns a cancel function. */
  whenSeen?: (element: Element, cb: () => void) => () => void;
  /** Called after every drawn frame, e.g. to refresh an open tooltip. */
  onFrame?(t: number): void;
}

/** What a re-render hands an existing playback: the new SVG and the playback compiled for it. */
export interface PlaybackMountView<Run extends PlaybackRun> {
  svg: SVGElement;
  playback: Run;
  darkMode: boolean;
  /** Playhead to move to once rebound; omit to keep the clamped playhead. */
  t?: number;
}

/** A running playback over one mounted SVG. */
export interface PlaybackMount<Run extends PlaybackRun> {
  /** Play, pause, seek, setSpeed, getState and `period` events. */
  controller: PlaybackController;
  /** Draw the frame at `t` without moving the playhead. */
  draw(t: number): void;
  /**
   * Move playback onto a re-rendered SVG and its recompiled playback, keeping the play
   * state and every listener. The playhead moves to `view.t` when given, else stays clamped.
   * Redraws the current frame.
   */
  rebind(view: PlaybackMountView<Run>): void;
  /** Stop the clock and remove the controls strip and live region. Safe to repeat. */
  destroy(): void;
}

function sessionTiming(playback: PlaybackRun): PlaybackSessionTiming {
  const { durationMs, holdEndMs, loop, autoplay, controls } = playback.timing;
  return {
    periodCount: playback.periods.length,
    durationMs,
    holdEndMs,
    loop,
    autoplay,
    controls,
  };
}

function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index]);
}

/** The period a session reports for an index, clamped to the playback's periods. */
function periodOf(playback: PlaybackRun, index: number): PlaybackPeriod {
  const clamped = Math.max(0, Math.min(playback.periods.length - 1, index));
  return {
    index: clamped,
    value: playback.periods[clamped]?.value ?? '',
    label: playback.periodLabels[clamped] ?? '',
  };
}

/**
 * Start playback on a rendered time chart or map: mount the controls strip below the SVG
 * (when `controls` is on and there are two or more periods), draw the opening frame, and
 * wire autoplay. Reduced motion and `animate: false` open on the final period without
 * autoplay.
 *
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function mountPlayback<Run extends PlaybackRun>(
  options: PlaybackMountOptions<Run>,
): PlaybackMount<Run> {
  const { container, createWriter } = options;
  let playback = options.playback;
  let svg = options.svg;
  let writer = createWriter(svg, playback);
  let slot: HTMLElement | null = null;
  // Labels the mounted controls show; undefined until the first attach.
  let mountedLabels: string[] | null | undefined;
  let started = false;
  let destroyed = false;

  function draw(t: number) {
    writer.draw(t);
    options.onFrame?.(t);
  }

  const session = createPlaybackSession({
    container,
    timing: sessionTiming(playback),
    periodLabels: playback.periodLabels,
    periodAt: (index) => periodOf(playback, index),
    draw,
    describe: (t) => playback.describe(t),
    animate: options.animate,
    initialState: options.initialState,
    deferStart: true,
    scheduler: options.scheduler,
    reducedMotion: options.reducedMotion,
    whenSeen: options.whenSeen,
  });

  const playable = () => isPlayable(playback.periods.length);

  function placeControlsStrip(darkMode: boolean) {
    slot = placeStrip({
      slot,
      svg,
      controls: playback.timing.controls,
      periodCount: playback.periods.length,
      darkMode,
    });
  }

  /** Rebuild the controls only when what they show changed, so focus survives a re-render. */
  function attachControls() {
    const controls = slot && playable() ? slot : null;
    const labels = controls ? playback.periodLabels : null;
    const unchanged =
      labels && mountedLabels ? sameLabels(labels, mountedLabels) : labels === mountedLabels;
    if (unchanged && (session.controlsElement?.parentElement ?? null) === controls) return;
    session.attach({ controls, announcer: container });
    mountedLabels = labels;
  }

  function startWhenPlayable() {
    if (started || !playable()) return;
    started = true;
    session.start();
  }

  placeControlsStrip(options.darkMode);
  attachControls();
  draw(session.getClockState().t);
  startWhenPlayable();

  return {
    controller: {
      play() {
        if (playable()) session.play();
      },
      pause: session.pause,
      seek: session.seek,
      setSpeed: session.setSpeed,
      getState: session.getState,
      on: session.on,
    },
    draw(t) {
      if (!destroyed) draw(t);
    },
    rebind(view) {
      if (destroyed) return;
      writer.destroy();
      playback = view.playback;
      svg = view.svg;
      writer = createWriter(svg, playback);
      session.retime(sessionTiming(playback), playback.periodLabels);
      placeControlsStrip(view.darkMode);
      attachControls();
      draw(session.getClockState().t);
      session.syncPeriod();
      // A data change moves the playhead quietly: no announcement, and autoplay still waits.
      if (view.t !== undefined && view.t !== session.getClockState().t) session.moveTo(view.t);
      startWhenPlayable();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      session.destroy();
      writer.destroy();
      slot?.remove();
      slot = null;
    },
  };
}
