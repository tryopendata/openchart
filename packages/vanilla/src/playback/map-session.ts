/**
 * Playback for a mounted geo or tile map: the shared session (clock, controls, announcer,
 * autoplay, reduced-motion stepping) driving the map frame writer over the SVG the mount
 * rendered. The session outlives re-renders: `rebind()` moves it onto a fresh SVG and a
 * recompiled playback.
 */
import type { MapPlayback } from '@opendata-ai/openchart-engine';
import type { PlaybackClockState } from './clock';
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';
import { createMapFrameWriter, type MapFrameWriter } from './map-frames';
import { createPlaybackSession, type PlaybackSessionTiming } from './session';
import type { PlaybackController, PlaybackPeriod } from './types';

/** Any map playback; the session reads only what geo and tile maps share. */
export type AnyMapPlayback = MapPlayback<unknown>;

export interface MapPlaybackMountOptions {
  /** The map container; the controls strip goes right after the SVG. */
  container: HTMLElement;
  /** The SVG rendered from `playback.base`. */
  svg: SVGElement;
  playback: AnyMapPlayback;
  darkMode: boolean;
  /** False (the spec's `animation: false`) opens on the final period without autoplay. */
  animate?: boolean;
  /** Restore the playhead after an update. */
  initialState?: PlaybackClockState;
  /** Defaults to the prefers-reduced-motion media query. */
  reducedMotion?: () => boolean;
  /** Defaults to `whenSeen`. Calls `cb` once the element is seen; returns a cancel function. */
  whenSeen?: (element: Element, cb: () => void) => () => void;
}

/** What a re-render hands an existing playback. */
export interface MapPlaybackView {
  svg: SVGElement;
  playback: AnyMapPlayback;
  darkMode: boolean;
  /** Playhead to move to once rebound; omit to keep the clamped playhead. */
  t?: number;
}

/** A map's running playback. */
export interface MapPlaybackMount {
  controller: PlaybackController;
  /** Move onto a re-rendered SVG and recompiled playback, keeping play state and listeners. */
  rebind(view: MapPlaybackView): void;
  /** Stop the clock and remove the controls strip and live region. Safe to repeat. */
  destroy(): void;
}

const STRIP_SLOT_CLASS = 'oc-playback-strip';
/** Fewer periods than this leave nothing to play: the strip hides and play() does nothing. */
const MIN_PLAYABLE_PERIODS = 2;

function sessionTiming(playback: AnyMapPlayback): PlaybackSessionTiming {
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

function isPlayable(playback: AnyMapPlayback): boolean {
  return playback.periods.length >= MIN_PLAYABLE_PERIODS;
}

function createStripSlot(doc: Document): HTMLElement {
  const slot = doc.createElement('div');
  slot.className = STRIP_SLOT_CLASS;
  slot.style.height = `${PLAYBACK_CONTROLS_HEIGHT}px`;
  return slot;
}

/**
 * Start playback on a rendered time map: mount the controls strip below the SVG (when
 * `controls` is on), draw the opening frame and wire autoplay. Reduced motion and
 * `animate: false` open on the final period without autoplay.
 *
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function mountMapPlayback(options: MapPlaybackMountOptions): MapPlaybackMount {
  const { container } = options;
  let playback = options.playback;
  let svg = options.svg;
  let writer: MapFrameWriter = createMapFrameWriter(svg, playback);
  let slot: HTMLElement | null = null;
  let mountedLabels: string[] | null | undefined;
  let started = false;
  let destroyed = false;

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
    draw: (t) => writer.draw(t),
    describe: (t) => playback.describe(t),
    animate: options.animate,
    initialState: options.initialState,
    deferStart: true,
    reducedMotion: options.reducedMotion,
    whenSeen: options.whenSeen,
  });

  /** Create, keep or drop the strip to match `timing.controls`, directly below the SVG. */
  function placeStrip(darkMode: boolean) {
    if (!playback.timing.controls) {
      slot?.remove();
      slot = null;
      return;
    }
    slot ??= createStripSlot(container.ownerDocument);
    // Move the SVG rather than the strip, so focus inside the strip survives a re-render.
    if (!slot.isConnected) svg.after(slot);
    else if (svg.nextSibling !== slot) slot.before(svg);
    slot.classList.toggle('oc-dark', darkMode);
    // One period keeps the strip's height so the layout doesn't jump when data arrives.
    slot.style.visibility = isPlayable(playback) ? '' : 'hidden';
  }

  /** Rebuild the controls only when their labels or slot changed, so focus survives. */
  function attachControls() {
    const controls = slot && isPlayable(playback) ? slot : null;
    const labels = controls ? playback.periodLabels : null;
    const same =
      labels && mountedLabels
        ? labels.length === mountedLabels.length &&
          labels.every((label, index) => label === mountedLabels?.[index])
        : labels === mountedLabels;
    if (same && (session.controlsElement?.parentElement ?? null) === controls) return;
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
  writer.draw(session.getClockState().t);
  startWhenPlayable();

  return {
    controller: {
      play() {
        if (isPlayable(playback)) session.play();
      },
      pause: session.pause,
      seek: session.seek,
      setSpeed: session.setSpeed,
      getState: session.getState,
      on: session.on,
    },
    rebind(view) {
      if (destroyed) return;
      writer.destroy();
      playback = view.playback;
      svg = view.svg;
      writer = createMapFrameWriter(svg, playback);
      session.retime(sessionTiming(playback), playback.periodLabels);
      placeStrip(view.darkMode);
      attachControls();
      writer.draw(session.getClockState().t);
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
