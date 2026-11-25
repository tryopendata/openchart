/**
 * A session's clock and the period index it tracks: emits the periods the playhead
 * crosses, mutes emission around seeks and rebuilds, and holds the period change a
 * rebuild causes until the mount has rendered.
 */
import {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackClockState,
  type PlaybackFrameScheduler,
} from './clock';
import type { PeriodDispatcher } from './period-events';
import type { PlaybackSessionTiming } from './types';

/** Timing, callbacks and environment for a session's clock. */
export interface SessionClockOptions {
  timing: PlaybackSessionTiming;
  initialState?: PlaybackClockState;
  scheduler?: PlaybackFrameScheduler;
  subject: string;
  draw(t: number): void;
  /** Called on every clock state change, before period events. */
  onStateChange(state: PlaybackClockState): void;
  periods: PeriodDispatcher;
}

/** The current clock plus the period bookkeeping around it. */
export interface SessionClock {
  /** The clock in use; replaced when `retime()` rebuilds it. */
  readonly clock: PlaybackClock;
  /** Period index of the playhead after the last state change. */
  readonly periodIndex: number;
  /**
   * Seek without emitting the crossings in between.
   * @throws {RangeError} If t is non-finite.
   */
  seekQuietly(t: number): void;
  /** Rebuild the clock when the period count, duration, hold or loop changed. */
  retime(timing: PlaybackSessionTiming, resumeStepped: boolean): void;
  /** Emit the period change held back by the last rebuild, if any. */
  syncPeriod(): void;
}

/** Whether new timing needs a new clock; autoplay and controls changes don't. */
function clockTimingChanged(a: PlaybackSessionTiming, b: PlaybackSessionTiming): boolean {
  return (
    a.periodCount !== b.periodCount ||
    a.durationMs !== b.durationMs ||
    a.holdEndMs !== b.holdEndMs ||
    a.loop !== b.loop
  );
}

/**
 * Create a session clock at the restored or starting playhead.
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function createSessionClock(options: SessionClockOptions): SessionClock {
  const { scheduler, subject, draw, onStateChange, periods } = options;
  let timing = options.timing;
  let muted = false;
  let periodIndex = 0;
  let pendingPeriod: number | undefined;
  let clock = build(options.initialState);
  periodIndex = Math.floor(clock.getState().t);

  function build(previous?: PlaybackClockState): PlaybackClock {
    const { periodCount, durationMs, holdEndMs, loop } = timing;
    return createPlaybackClock({
      periodCount,
      durationMs,
      holdEndMs,
      loop,
      scheduler,
      subject,
      initialState: previous,
      onTick: draw,
      onStateChange: follow,
    });
  }

  function follow(state: PlaybackClockState) {
    onStateChange(state);
    const previousIndex = periodIndex;
    periodIndex = Math.floor(state.t);
    if (muted || periodIndex === previousIndex) return;
    const first = state.playing && periodIndex > previousIndex ? previousIndex + 1 : periodIndex;
    periods.emit(first, periodIndex);
  }

  function quietly(action: () => void) {
    muted = true;
    try {
      action();
    } finally {
      muted = false;
    }
  }

  function rebuild(resumeStepped: boolean) {
    const previous = clock.getState();
    const previousIndex = periodIndex;
    clock.destroy();
    quietly(() => {
      clock = build(previous);
      if (previous.playing) clock.play(resumeStepped);
    });
    periodIndex = Math.floor(clock.getState().t);
    if (periodIndex !== previousIndex) pendingPeriod = periodIndex;
  }

  return {
    get clock() {
      return clock;
    },
    get periodIndex() {
      return periodIndex;
    },
    seekQuietly(t) {
      quietly(() => clock.seek(t));
    },
    retime(nextTiming, resumeStepped) {
      const changed = clockTimingChanged(timing, nextTiming);
      timing = nextTiming;
      if (changed) rebuild(resumeStepped);
    },
    syncPeriod() {
      const index = pendingPeriod;
      pendingPeriod = undefined;
      if (index !== undefined) periods.emit(index, index);
    },
  };
}
