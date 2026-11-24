export interface RaceFrameScheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export interface RaceClockState {
  t: number;
  playing: boolean;
  speed: number;
  ended: boolean;
}

export interface RaceClockOptions {
  periodCount: number;
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  onTick: (t: number) => void;
  onStateChange?: (state: RaceClockState) => void;
  /** Defaults to requestAnimationFrame and cancelAnimationFrame. */
  scheduler?: RaceFrameScheduler;
}

export interface RaceClock {
  play(): void;
  pause(): void;
  toggle(): void;
  /** @throws {RangeError} If t is non-finite. */
  seek(t: number): void;
  stepPeriod(delta: 1 | -1): void;
  /** @throws {RangeError} If speed is non-positive or non-finite. */
  setSpeed(speed: number): void;
  getState(): RaceClockState;
  destroy(): void;
}

export function createRaceClock(options: RaceClockOptions): RaceClock {
  const {
    periodCount,
    durationMs,
    holdEndMs,
    loop,
    onTick,
    onStateChange,
    scheduler = {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id),
    },
  } = options;
  const lastPeriod = periodCount - 1;
  const state: RaceClockState = { t: 0, playing: false, speed: 1, ended: false };
  let elapsedMs = 0;
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
      throw error;
    }
  }

  function draw(t: number) {
    state.t = t;
    notifyState(true);
  }

  function seek(t: number) {
    if (destroyed) return;
    if (!Number.isFinite(t)) throw new RangeError('Race seek position must be finite');
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

  function frame(now: number) {
    frameId = undefined;
    if (!state.playing) return;
    const previous = previousNow;
    previousNow = now;
    if (previous === undefined) {
      if (state.t === lastPeriod) holdStartedAt = now;
    } else {
      if (state.t < lastPeriod) {
        elapsedMs += (now - previous) * state.speed;
        const position = Math.min(1, elapsedMs / durationMs) * lastPeriod;
        if (position !== state.t) draw(position);
      }
      if (state.playing && state.t === lastPeriod) {
        holdStartedAt ??= now;
        if (now - holdStartedAt >= holdEndMs) {
          if (loop) seek(0);
          else {
            stop();
            state.ended = true;
            notifyState();
          }
        }
      }
    }
    requestFrame();
  }

  function play() {
    if (destroyed || state.playing) return;
    state.playing = true;
    if (state.ended) seek(0);
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
      if (!Number.isFinite(speed) || speed <= 0) {
        throw new RangeError('Race playback speed must be finite and greater than zero');
      }
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
