/**
 * Playback session: one playback run's clock, control strip, announcements, period
 * events, visibility autoplay and reduced-motion stepping. The caller renders views and
 * draws the playhead; the session decides when and where the playhead moves.
 */
import { prefersReducedMotion } from '../motion/tween';
import { whenSeen } from '../visibility';
import {
  createPlaybackAnnouncer,
  type PlaybackAnnounceCause,
  type PlaybackAnnouncer,
} from './announcer';
import {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackClockState,
  type PlaybackFrameScheduler,
} from './clock';
import { createPlaybackControls, type PlaybackControls } from './controls';
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

/** What the session plays, how it draws, and the environment hooks tests can replace. */
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

/** A playback controller plus the hooks its mount uses to render, retime and tear down. */
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

type PeriodListener = (period: PlaybackPeriod) => void;

const DEFAULT_CLASS_PREFIX = 'oc-playback';

function reportListenerError(error: unknown): void {
  if (typeof reportError === 'function') reportError(error);
  else
    queueMicrotask(() => {
      throw error;
    });
}

/**
 * Deliver period events in order. A listener error is reported without stopping delivery,
 * and crossings queued during delivery replace any that are still undelivered.
 */
function createPeriodDispatcher(periodAt: (index: number) => PlaybackPeriod) {
  const listeners = new Set<PeriodListener>();
  const pending: Array<{ period: PlaybackPeriod; listeners: PeriodListener[] }> = [];
  let nextPending = 0;

  function deliver() {
    try {
      while (nextPending < pending.length) {
        const { period, listeners: recipients } = pending[nextPending++];
        for (const listener of recipients) {
          if (!listeners.has(listener)) continue;
          try {
            listener({ ...period });
          } catch (error) {
            reportListenerError(error);
          }
        }
      }
    } finally {
      pending.length = 0;
      nextPending = 0;
    }
  }

  return {
    listeners,
    emit(first: number, last: number) {
      if (!listeners.size) return;
      const dispatching = pending.length > 0;
      // Finish delivering the current event before replacing any undelivered crossings.
      pending.length = nextPending;
      const recipients = [...listeners];
      for (let index = first; index <= last; index++) {
        pending.push({ period: periodAt(index), listeners: recipients });
      }
      if (!dispatching) deliver();
    },
  };
}

function timingChanged(a: PlaybackSessionTiming, b: PlaybackSessionTiming): boolean {
  return (
    a.periodCount !== b.periodCount ||
    a.durationMs !== b.durationMs ||
    a.holdEndMs !== b.holdEndMs ||
    a.loop !== b.loop
  );
}

/**
 * Own a playback run: clock, controls, announcer, visibility autoplay and reduced-motion
 * stepping. The caller draws.
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function createPlaybackSession(options: PlaybackSessionOptions): PlaybackSession {
  const { container, periodAt, draw, scheduler, initialState } = options;
  const classPrefix = options.classPrefix ?? DEFAULT_CLASS_PREFIX;
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion;
  const watchSeen = options.whenSeen ?? whenSeen;
  const periods = createPeriodDispatcher(periodAt);
  let timing = options.timing;
  let periodLabels = options.periodLabels;
  let destroyed = false;
  let seeking = false;
  let periodIndex = 0;
  let stepPlayback = reducedMotion();
  let cancelVisibility: (() => void) | undefined;
  let controls: PlaybackControls | undefined;
  let announcer: PlaybackAnnouncer | undefined;
  let clock = makeClock(initialState);

  function makeClock(previous?: PlaybackClockState): PlaybackClock {
    const { periodCount, durationMs, holdEndMs, loop } = timing;
    return createPlaybackClock({
      periodCount,
      durationMs,
      holdEndMs,
      loop,
      scheduler,
      initialState: previous,
      onTick: draw,
      onStateChange(state) {
        controls?.update(state);
        const previousIndex = periodIndex;
        periodIndex = Math.floor(state.t);
        if (seeking || periodIndex === previousIndex) return;
        const first =
          state.playing && periodIndex > previousIndex ? previousIndex + 1 : periodIndex;
        periods.emit(first, periodIndex);
      },
    });
  }

  function cancelAutoplay() {
    cancelVisibility?.();
    cancelVisibility = undefined;
  }

  function announce(cause: PlaybackAnnounceCause) {
    if (destroyed) return;
    const state = clock.getState();
    announcer?.notify(cause, state);
    if (!state.playing) options.onAnnounce?.(state.t);
  }

  function play() {
    cancelAutoplay();
    if (!clock.getState().playing) stepPlayback = reducedMotion();
    clock.play(stepPlayback);
  }

  function pause() {
    cancelAutoplay();
    clock.pause();
    announce('pause');
  }

  function seekTo(t: number, announceSeek: boolean) {
    seeking = true;
    try {
      // Stepped playback draws whole periods, so a fractional seek would draw and then snap back.
      const stepped = stepPlayback && clock.getState().playing && Number.isFinite(t);
      clock.seek(stepped ? Math.floor(t) : t);
    } finally {
      seeking = false;
    }
    cancelAutoplay();
    if (destroyed) return;
    if (announceSeek) announce('seek');
    periods.emit(periodIndex, periodIndex);
  }

  function toggle() {
    if (clock.getState().playing) pause();
    else play();
  }

  function step(delta: 1 | -1) {
    cancelAutoplay();
    clock.stepPeriod(delta);
    announce('step');
  }

  const commitSeek = () => announce('seek');

  function removeControls() {
    controls?.element.removeEventListener('change', commitSeek);
    controls?.destroy();
    controls = undefined;
  }

  function mountControls(slot: HTMLElement | null | undefined) {
    removeControls();
    if (!slot || !timing.controls) return;
    controls = createPlaybackControls({
      classPrefix,
      periodLabels,
      onToggle: toggle,
      onSeek: (t) => seekTo(reducedMotion() ? Math.round(t) : t, false),
      onStep: step,
    });
    controls.element.addEventListener('change', commitSeek);
    slot.append(controls.element);
    controls.update(clock.getState());
  }

  function mountAnnouncer(host: HTMLElement | undefined) {
    const { describe } = options;
    if (!host || !describe) return;
    if (announcer) announcer.attach(host);
    else announcer = createPlaybackAnnouncer({ host, describe });
  }

  function retime(nextTiming: PlaybackSessionTiming, nextLabels: string[]) {
    if (destroyed) return;
    const rebuild = timingChanged(timing, nextTiming);
    timing = nextTiming;
    periodLabels = nextLabels;
    if (timing.autoplay !== 'visible') cancelAutoplay();
    if (!rebuild) return;
    const previous = clock.getState();
    clock.destroy();
    clock = makeClock(previous);
    if (previous.playing) clock.play(stepPlayback);
    const nextIndex = Math.floor(clock.getState().t);
    if (nextIndex === periodIndex) return;
    periodIndex = nextIndex;
    periods.emit(nextIndex, nextIndex);
  }

  /** Open on the final period when motion is off, then resume or schedule autoplay. */
  function start() {
    const still = options.animate === false || stepPlayback;
    if (still && !initialState) clock.seek(timing.periodCount - 1);
    periodIndex = Math.floor(clock.getState().t);
    if (initialState?.playing) {
      clock.play(stepPlayback);
      return;
    }
    if (still) return;
    const pausedAtStart = initialState && !initialState.ended && initialState.t === 0;
    if (timing.autoplay === 'visible' && (!initialState || pausedAtStart)) {
      cancelVisibility = watchSeen(container, play);
    } else if (!initialState && timing.autoplay === true) play();
  }

  start();

  return {
    play,
    pause,
    seek: (t) => seekTo(t, true),
    setSpeed(speed) {
      if (destroyed && (!Number.isFinite(speed) || speed <= 0)) {
        throw new RangeError('Playback speed must be finite and greater than zero');
      }
      clock.setSpeed(speed);
    },
    getState() {
      const { t, playing, speed, ended } = clock.getState();
      return { t, playing, speed, ended, period: periodAt(Math.floor(t)) };
    },
    on(event, cb) {
      if (event !== 'period') {
        throw new TypeError(`Unknown playback event "${event}". Supported: "period".`);
      }
      const listener: PeriodListener = (period) => cb(period);
      if (!destroyed) periods.listeners.add(listener);
      return () => {
        periods.listeners.delete(listener);
      };
    },
    attach({ controls: slot, announcer: host }) {
      if (destroyed) return;
      mountControls(slot);
      mountAnnouncer(host);
    },
    get controlsElement() {
      return controls?.element ?? null;
    },
    retime,
    getClockState: () => clock.getState(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      periods.listeners.clear();
      cancelAutoplay();
      clock.destroy();
      removeControls();
      announcer?.destroy();
      announcer = undefined;
    },
  };
}
