/**
 * Playback clock: turns elapsed frame time into a continuous period index `t`.
 * It requests frames only while playing, holds on the final period, then loops or
 * ends. Drawing and state reporting go through the caller's callbacks.
 */

/** Frame source for the clock, so tests and hosts can drive time themselves. */
export interface PlaybackFrameScheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

/** Playhead and status as reported by the clock. */
export interface PlaybackClockState {
  t: number;
  playing: boolean;
  speed: number;
  ended: boolean;
}

/** Playback settings and callbacks for a clock that requests frames only while playing. */
export interface PlaybackClockOptions {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  initialState?: PlaybackClockState;
  onTick: (t: number) => void;
  onStateChange?: (state: PlaybackClockState) => void;
  /** Defaults to requestAnimationFrame and cancelAnimationFrame. */
  scheduler?: PlaybackFrameScheduler;
}

/** Controls for a running clock. */
export interface PlaybackClock {
  play(stepPeriods?: boolean): void;
  pause(): void;
  toggle(): void;
  /** @throws {RangeError} If t is non-finite. */
  seek(t: number): void;
  stepPeriod(delta: 1 | -1): void;
  /** @throws {RangeError} If speed is non-positive or non-finite. */
  setSpeed(speed: number): void;
  getState(): PlaybackClockState;
  destroy(): void;
}

const animationFrameScheduler: PlaybackFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

function assertFinitePosition(t: number): void {
  if (!Number.isFinite(t)) throw new RangeError('Playback seek position must be finite');
}

function assertValidSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError('Playback speed must be finite and greater than zero');
  }
}

/**
 * The clock's starting state, restored from a previous run when given.
 * @throws {RangeError} If the restored position is non-finite or its speed is invalid.
 */
function startingState(lastPeriod: number, restored?: PlaybackClockState): PlaybackClockState {
  const state: PlaybackClockState = { t: 0, playing: false, speed: 1, ended: false };
  if (!restored) return state;
  assertFinitePosition(restored.t);
  assertValidSpeed(restored.speed);
  state.t = Math.min(Math.max(0, restored.t), lastPeriod);
  state.speed = restored.speed;
  state.ended = restored.ended && state.t === lastPeriod && !restored.playing;
  return state;
}

/**
 * Create a clock driven by the supplied scheduler or browser animation frames.
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function createPlaybackClock(options: PlaybackClockOptions): PlaybackClock {
  const {
    periodCount,
    durationMs,
    holdEndMs,
    loop,
    onTick,
    onStateChange,
    scheduler = animationFrameScheduler,
  } = options;
  const lastPeriod = periodCount - 1;
  const state = startingState(lastPeriod, options.initialState);
  const stepMs = durationMs / lastPeriod;
  let elapsedMs = (state.t / lastPeriod) * durationMs;
  let stepped = false;
  let frameId: number | undefined;
  let previousNow: number | undefined;
  let holdStartedAt: number | undefined;
  let destroyed = false;

  function notifyState(ticked = false) {
    try {
      if (ticked) onTick(state.t);
      if (!destroyed) onStateChange?.({ ...state });
    } catch (error) {
      stop();
      try {
        onStateChange?.({ ...state });
      } catch {
        // Preserve the original callback error if the paused-state notification also fails.
      }
      throw error;
    }
  }

  function draw(t: number) {
    state.t = t;
    notifyState(true);
  }

  function seek(t: number) {
    assertFinitePosition(t);
    if (destroyed) return;
    const position = Math.min(Math.max(0, t), lastPeriod);
    elapsedMs = (position / lastPeriod) * durationMs;
    holdStartedAt = undefined;
    state.ended = false;
    draw(position);
  }

  function stop() {
    state.playing = false;
    if (frameId !== undefined) scheduler.cancel(frameId);
    frameId = undefined;
    previousNow = undefined;
    holdStartedAt = undefined;
  }

  function requestFrame() {
    if (state.playing && frameId === undefined) frameId = scheduler.request(frame);
  }

  function advance(deltaMs: number) {
    elapsedMs += deltaMs * state.speed;
    const playhead = elapsedMs >= durationMs ? lastPeriod : elapsedMs / stepMs;
    const position = stepped ? Math.floor(playhead) : playhead;
    if (position !== state.t) draw(position);
  }

  function holdOrFinish(now: number) {
    holdStartedAt ??= now;
    if (now - holdStartedAt < holdEndMs) return;
    if (loop) {
      seek(0);
      return;
    }
    stop();
    state.ended = true;
    notifyState();
  }

  function frame(now: number) {
    frameId = undefined;
    if (!state.playing) return;
    const previous = previousNow;
    previousNow = now;
    if (previous === undefined) {
      if (state.t === lastPeriod) holdStartedAt = now;
    } else {
      if (state.t < lastPeriod) advance(now - previous);
      if (state.playing && state.t === lastPeriod) holdOrFinish(now);
    }
    requestFrame();
  }

  function play(stepPeriods = false) {
    if (destroyed || state.playing) return;
    stepped = stepPeriods;
    state.playing = true;
    if (state.ended) seek(0);
    else if (stepped && !Number.isInteger(state.t)) draw(Math.floor(state.t));
    else notifyState();
    requestFrame();
  }

  function pause() {
    if (!state.playing) return;
    stop();
    notifyState();
  }

  return {
    play,
    pause,
    toggle() {
      if (state.playing) pause();
      else play();
    },
    seek,
    stepPeriod(delta) {
      if (destroyed) return;
      stop();
      seek(delta === 1 ? Math.floor(state.t) + 1 : Math.ceil(state.t) - 1);
    },
    setSpeed(speed) {
      if (destroyed) return;
      assertValidSpeed(speed);
      if (speed === state.speed) return;
      state.speed = speed;
      notifyState();
    },
    getState: () => ({ ...state }),
    destroy() {
      destroyed = true;
      stop();
    },
  };
}
