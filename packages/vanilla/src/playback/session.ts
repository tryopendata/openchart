/**
 * Playback session: one playback run's controller. It ties the clock and period events
 * (session-clock), the controls and live region (session-view), visibility autoplay and
 * reduced-motion stepping together. The caller renders views and draws the playhead.
 */
import { prefersReducedMotion } from '../motion/tween';
import { whenSeen } from '../visibility';
import type { PlaybackAnnounceCause } from './announcer';
import { assertValidSpeed, DEFAULT_PLAYBACK_SUBJECT } from './clock';
import { createPeriodDispatcher, type PeriodListener } from './period-events';
import { createSessionClock } from './session-clock';
import { createSessionView } from './session-view';
import type { PlaybackSession, PlaybackSessionOptions } from './types';

export type {
  PlaybackSession,
  PlaybackSessionHosts,
  PlaybackSessionOptions,
  PlaybackSessionTiming,
} from './types';

/** A session that its mount can also reposition without it counting as a reader's seek. */
export interface MovablePlaybackSession extends PlaybackSession {
  /**
   * Move the playhead for a data change: draws and reports a period change, but announces
   * nothing and leaves a pending visibility autoplay waiting.
   * @throws {RangeError} If t is not finite.
   */
  moveTo(t: number): void;
}

const DEFAULT_CLASS_PREFIX = 'oc-playback';

/**
 * Own a playback run: clock, controls, announcer, visibility autoplay and reduced-motion
 * stepping. The caller draws. Opens on the final period when motion is off, then starts
 * unless `deferStart` is set.
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function createPlaybackSession(options: PlaybackSessionOptions): MovablePlaybackSession {
  const { container, periodAt, initialState } = options;
  const subject = options.subject ?? DEFAULT_PLAYBACK_SUBJECT;
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion;
  const watchSeen = options.whenSeen ?? whenSeen;
  const periods = createPeriodDispatcher(periodAt);
  const view = createSessionView({
    classPrefix: options.classPrefix ?? DEFAULT_CLASS_PREFIX,
    describe: options.describe,
    actions: {
      onToggle: toggle,
      onSeek: (t) => seekTo(reducedMotion() ? Math.round(t) : t, false),
      onStep: step,
    },
    onSeekCommit: () => announce('seek'),
  });
  let timing = options.timing;
  let periodLabels = options.periodLabels;
  let destroyed = false;
  let started = false;
  let stepPlayback = reducedMotion();
  let cancelVisibility: (() => void) | undefined;
  const playhead = createSessionClock({
    timing,
    initialState,
    scheduler: options.scheduler,
    subject,
    draw: options.draw,
    onStateChange: view.update,
    periods,
  });

  function cancelAutoplay() {
    cancelVisibility?.();
    cancelVisibility = undefined;
  }

  function announce(cause: PlaybackAnnounceCause) {
    if (destroyed) return;
    const state = playhead.clock.getState();
    view.announce(cause, state);
    if (!state.playing) options.onAnnounce?.(state.t);
  }

  function play() {
    cancelAutoplay();
    if (!playhead.clock.getState().playing) stepPlayback = reducedMotion();
    playhead.clock.play(stepPlayback);
  }

  function pause() {
    cancelAutoplay();
    playhead.clock.pause();
    announce('pause');
  }

  function toggle() {
    if (playhead.clock.getState().playing) pause();
    else play();
  }

  function seekTo(t: number, announceSeek: boolean) {
    // Stepped playback draws whole periods, so a fractional seek would draw and then snap back.
    const stepped = stepPlayback && playhead.clock.getState().playing && Number.isFinite(t);
    playhead.seekQuietly(stepped ? Math.floor(t) : t);
    cancelAutoplay();
    if (destroyed) return;
    if (announceSeek) announce('seek');
    periods.emit(playhead.periodIndex, playhead.periodIndex);
  }

  function step(delta: 1 | -1) {
    cancelAutoplay();
    playhead.clock.stepPeriod(delta);
    announce('step');
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    if (initialState?.playing) {
      playhead.clock.play(stepPlayback);
      return;
    }
    if (options.animate === false || stepPlayback) return;
    const pausedAtStart = initialState && !initialState.ended && initialState.t === 0;
    if (timing.autoplay === 'visible' && (!initialState || pausedAtStart)) {
      cancelVisibility = watchSeen(container, play);
    } else if (!initialState && timing.autoplay === true) play();
  }

  if ((options.animate === false || stepPlayback) && !initialState) {
    playhead.clock.seek(timing.periodCount - 1);
  }
  if (!options.deferStart) start();

  return {
    start,
    play,
    pause,
    seek: (t) => seekTo(t, true),
    setSpeed(speed) {
      if (destroyed) assertValidSpeed(speed, subject);
      playhead.clock.setSpeed(speed);
    },
    getState() {
      const { t, playing, speed, ended } = playhead.clock.getState();
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
    attach({ controls, announcer }) {
      if (destroyed) return;
      const state = playhead.clock.getState();
      view.mountControls(timing.controls ? controls : null, periodLabels, state);
      view.mountAnnouncer(announcer);
    },
    get controlsElement() {
      return view.controlsElement;
    },
    retime(nextTiming, nextLabels) {
      if (destroyed) return;
      timing = nextTiming;
      periodLabels = nextLabels;
      if (timing.autoplay !== 'visible') cancelAutoplay();
      playhead.retime(timing, stepPlayback);
    },
    moveTo(t) {
      if (destroyed) return;
      const previousIndex = playhead.periodIndex;
      playhead.seekQuietly(t);
      if (playhead.periodIndex !== previousIndex) {
        periods.emit(playhead.periodIndex, playhead.periodIndex);
      }
    },
    syncPeriod() {
      if (!destroyed) playhead.syncPeriod();
    },
    getClockState: () => playhead.clock.getState(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      periods.listeners.clear();
      cancelAutoplay();
      playhead.clock.destroy();
      view.destroy();
    },
  };
}
