/**
 * Playback for a mounted chart: the shared session (clock, controls, announcer, autoplay)
 * driving the frame writer over the SVG the chart mount rendered. The session outlives
 * re-renders: `rebind()` moves it onto a freshly rendered SVG and a recompiled playback.
 */
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import { type ChartFrameWriter, createChartFrameWriter } from './chart-frames';
import type { PlaybackClockState, PlaybackFrameScheduler } from './clock';
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';
import { createPlaybackSession, type PlaybackSessionTiming } from './session';
import type { PlaybackController, PlaybackPeriod } from './types';

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
  /** Called after every drawn frame, e.g. to refresh an open tooltip. */
  onFrame?(t: number): void;
}

/** What a re-render hands an existing playback: the new SVG and the playback compiled for it. */
export interface ChartPlaybackView {
  svg: SVGElement;
  playback: ChartPlayback;
  darkMode: boolean;
  /** Playhead to move to once rebound; omit to keep the clamped playhead. */
  t?: number;
}

/** A chart's running playback. */
export interface ChartPlaybackMount {
  /** Play, pause, seek, setSpeed, getState and `period` events, as on `RaceInstance`. */
  controller: PlaybackController;
  /** Draw the frame at `t` without moving the playhead. */
  draw(t: number): void;
  /**
   * Move playback onto a re-rendered SVG and its recompiled playback, keeping the play
   * state and every listener. The playhead moves to `view.t` when given, else stays clamped.
   * Redraws the current frame.
   */
  rebind(view: ChartPlaybackView): void;
  /** Stop the clock and remove the controls strip and live region. Safe to repeat. */
  destroy(): void;
}

const STRIP_SLOT_CLASS = 'oc-playback-strip';

/** Fewer periods than this leave nothing to play: the strip hides and play() does nothing. */
const MIN_PLAYABLE_PERIODS = 2;

function sessionTiming(playback: ChartPlayback): PlaybackSessionTiming {
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

function isPlayable(playback: ChartPlayback): boolean {
  return playback.periods.length >= MIN_PLAYABLE_PERIODS;
}

function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index]);
}

function createStripSlot(doc: Document): HTMLElement {
  const slot = doc.createElement('div');
  slot.className = STRIP_SLOT_CLASS;
  slot.style.height = `${PLAYBACK_CONTROLS_HEIGHT}px`;
  return slot;
}

/** Place `svg` directly above `slot`, moving the fresh SVG rather than the strip so focus in the strip survives. */
function placeAbove(svg: SVGElement, slot: HTMLElement): void {
  if (svg.nextSibling !== slot) slot.before(svg);
}

/**
 * Start playback on a rendered time chart: mount the controls strip below the SVG (when
 * `controls` is on and there are two or more periods), draw the opening frame, and wire
 * autoplay. Reduced motion and `animate: false` open on the final period without autoplay.
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function mountChartPlayback(options: ChartPlaybackMountOptions): ChartPlaybackMount {
  const { container } = options;
  let playback = options.playback;
  let svg = options.svg;
  let writer: ChartFrameWriter = createChartFrameWriter(svg, playback);
  let slot: HTMLElement | null = null;
  // Labels the mounted controls show; undefined until the first attach.
  let mountedLabels: string[] | null | undefined;
  let started = false;
  let destroyed = false;

  function draw(t: number) {
    writer.draw(t);
    options.onFrame?.(t);
  }

  function periodAt(index: number): PlaybackPeriod {
    const clamped = Math.max(0, Math.min(playback.periods.length - 1, index));
    return {
      index: clamped,
      value: playback.periods[clamped]?.value ?? '',
      label: playback.periodLabels[clamped] ?? '',
    };
  }

  const session = createPlaybackSession({
    container,
    timing: sessionTiming(playback),
    periodLabels: playback.periodLabels,
    periodAt,
    draw,
    describe: (t) => playback.describe(t),
    animate: options.animate,
    initialState: options.initialState,
    deferStart: true,
    scheduler: options.scheduler,
    reducedMotion: options.reducedMotion,
    whenSeen: options.whenSeen,
  });

  /** Create, keep or drop the strip slot to match `timing.controls`, below the current SVG. */
  function placeStrip(darkMode: boolean) {
    if (!playback.timing.controls) {
      slot?.remove();
      slot = null;
      return;
    }
    slot ??= createStripSlot(container.ownerDocument);
    if (!slot.isConnected) svg.after(slot);
    else placeAbove(svg, slot);
    slot.classList.toggle('oc-dark', darkMode);
    // A single period keeps the strip's height reserved so the layout doesn't jump when
    // a later update brings a second period.
    slot.style.visibility = isPlayable(playback) ? '' : 'hidden';
  }

  /** Rebuild the controls only when what they show changed, so focus survives a re-render. */
  function attachControls() {
    const controls = slot && isPlayable(playback) ? slot : null;
    const labels = controls ? playback.periodLabels : null;
    const unchanged =
      labels && mountedLabels ? sameLabels(labels, mountedLabels) : labels === mountedLabels;
    if (unchanged && (session.controlsElement?.parentElement ?? null) === controls) return;
    session.attach({ controls, announcer: container });
    mountedLabels = labels;
  }

  function startWhenPlayable() {
    if (started || !isPlayable(playback)) return;
    started = true;
    session.start();
  }

  placeStrip(options.darkMode);
  attachControls();
  draw(session.getClockState().t);
  startWhenPlayable();

  const controller: PlaybackController = {
    play() {
      if (isPlayable(playback)) session.play();
    },
    pause: session.pause,
    seek: session.seek,
    setSpeed: session.setSpeed,
    getState: session.getState,
    on: session.on,
  };

  return {
    controller,
    draw(t) {
      if (!destroyed) draw(t);
    },
    rebind(view) {
      if (destroyed) return;
      writer.destroy();
      playback = view.playback;
      svg = view.svg;
      writer = createChartFrameWriter(svg, playback);
      session.retime(sessionTiming(playback), playback.periodLabels);
      placeStrip(view.darkMode);
      attachControls();
      draw(session.getClockState().t);
      session.syncPeriod();
      if (view.t !== undefined && view.t !== session.getClockState().t) session.seek(view.t);
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
