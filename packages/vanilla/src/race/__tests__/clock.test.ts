import { describe, expect, it } from 'vitest';
import {
  createPlaybackClock as createRaceClock,
  type PlaybackClockOptions as RaceClockOptions,
  type PlaybackClockState as RaceClockState,
} from '../../playback/clock';

function setup(overrides: Partial<Omit<RaceClockOptions, 'scheduler'>> = {}) {
  const pending = new Map<number, (now: number) => void>();
  let nextId = 0;
  const ticks: number[] = [];
  const states: RaceClockState[] = [];
  const clock = createRaceClock({
    periodCount: 5,
    durationMs: 1000,
    holdEndMs: 200,
    loop: false,
    scheduler: {
      request(cb) {
        const id = nextId++;
        pending.set(id, cb);
        return id;
      },
      cancel(id) {
        pending.delete(id);
      },
    },
    onTick: (t) => ticks.push(t),
    onStateChange: (state) => states.push(state),
    ...overrides,
  });

  return {
    clock,
    ticks,
    states,
    pending,
    frame(now: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(now);
    },
  };
}

describe('race clock', () => {
  it('uses the first frame as its time origin and advances at speeds 1 and 2', () => {
    const { clock, frame, pending, states, ticks } = setup();
    const initial = { t: 0, playing: false, speed: 1, ended: false };
    expect(clock.getState()).toEqual(initial);
    expect(pending.size).toBe(0);
    clock.play();
    clock.play();
    expect(pending.size).toBe(1);
    frame(500);
    expect(ticks).toEqual([]);
    expect(states).toEqual([{ ...initial, playing: true }]);
    frame(750);
    expect(clock.getState()).toEqual({ t: 1, playing: true, speed: 1, ended: false });
    clock.setSpeed(2);
    frame(1000);
    expect(clock.getState()).toEqual({ t: 3, playing: true, speed: 2, ended: false });
    expect(ticks).toEqual([1, 3]);
    expect(pending.size).toBe(1);
    clock.pause();
    expect(states).toEqual([
      { ...initial, playing: true },
      { ...initial, t: 1, playing: true },
      { ...initial, t: 1, playing: true, speed: 2 },
      { ...initial, t: 3, playing: true, speed: 2 },
      { ...initial, t: 3, speed: 2 },
    ]);
  });

  it('holds the final frame in wall-clock time, ends, and restarts at zero on play', () => {
    const { clock, frame, pending, states, ticks } = setup();
    clock.setSpeed(2);
    clock.play();
    frame(0);
    frame(500);
    frame(699);
    expect(clock.getState()).toEqual({ t: 4, playing: true, speed: 2, ended: false });
    expect(ticks).toEqual([4]);
    frame(700);
    expect(clock.getState()).toEqual({ t: 4, playing: false, speed: 2, ended: true });
    expect(states.at(-1)).toEqual(clock.getState());
    expect(pending.size).toBe(0);

    clock.play();
    expect(clock.getState()).toEqual({ t: 0, playing: true, speed: 2, ended: false });
    frame(900);
    frame(1025);
    expect(ticks).toEqual([4, 0, 1]);
  });

  it('loops to zero after the hold and keeps advancing without another play', () => {
    const { clock, frame, pending, ticks } = setup({ loop: true });
    clock.play();
    frame(0);
    frame(1000);
    frame(1199);
    expect(clock.getState().t).toBe(4);
    frame(1200);
    expect(clock.getState()).toEqual({ t: 0, playing: true, speed: 1, ended: false });
    expect(pending.size).toBe(1);
    frame(1450);
    expect(ticks).toEqual([4, 0, 1]);
  });

  it('ends on reaching the last period when the hold is zero', () => {
    const { clock, frame, pending, ticks } = setup({ holdEndMs: 0 });
    clock.play();
    frame(0);
    frame(1000);
    expect(ticks).toEqual([4]);
    expect(clock.getState()).toEqual({ t: 4, playing: false, speed: 1, ended: true });
    expect(pending.size).toBe(0);
  });

  it('starts the hold on the first frame when play begins at the final period', () => {
    const { clock, frame, pending, states, ticks } = setup();
    clock.seek(4);
    clock.play();
    frame(0);
    frame(199);
    expect(states.at(-1)).toEqual({ t: 4, playing: true, speed: 1, ended: false });
    frame(200);
    expect(states.at(-1)).toEqual({ t: 4, playing: false, speed: 1, ended: true });
    expect(ticks).toEqual([4]);
    expect(pending.size).toBe(0);
  });

  it('seeks immediately, clamps both ends, and clears ended', () => {
    const { clock, frame, states, ticks } = setup({ holdEndMs: 0 });
    clock.play();
    frame(0);
    frame(1000);
    expect(clock.getState().ended).toBe(true);
    states.length = 0;
    clock.seek(12);
    clock.seek(-1);
    clock.seek(1.5);
    expect(ticks).toEqual([4, 4, 0, 1.5]);
    expect(states).toEqual([4, 0, 1.5].map((t) => ({ t, playing: false, speed: 1, ended: false })));
  });

  it('keeps playing after a seek from the end hold and starts a fresh hold', () => {
    const { clock, frame, pending, ticks } = setup();
    clock.play();
    frame(0);
    frame(1000);
    frame(1100);
    clock.seek(3);
    expect(clock.getState().playing).toBe(true);
    expect(pending.size).toBe(1);
    frame(1225);
    frame(1350);
    frame(1549);
    expect(ticks).toEqual([4, 3, 3.5, 4]);
    expect(clock.getState().playing).toBe(true);
    frame(1550);
    expect(clock.getState().ended).toBe(true);
  });

  it('steps to adjacent whole periods, stops playback, and clamps at the ends', () => {
    const { clock, pending, states, ticks } = setup();
    clock.seek(1.25);
    clock.play();
    clock.stepPeriod(1);
    expect(pending.size).toBe(0);
    expect(states.at(-1)).toEqual({ t: 2, playing: false, speed: 1, ended: false });
    clock.stepPeriod(1);
    clock.seek(2.75);
    clock.play();
    clock.stepPeriod(-1);
    expect(pending.size).toBe(0);
    expect(states.at(-1)).toEqual({ t: 2, playing: false, speed: 1, ended: false });
    clock.stepPeriod(-1);
    clock.seek(0);
    clock.stepPeriod(-1);
    clock.seek(4);
    clock.stepPeriod(1);
    expect(ticks).toEqual([1.25, 2, 3, 2.75, 2, 1, 0, 0, 4, 4]);
  });

  it('cancels on pause and resumes without counting time spent paused', () => {
    const { clock, frame, pending, ticks } = setup();
    clock.toggle();
    frame(0);
    frame(250);
    clock.pause();
    expect(pending.size).toBe(0);
    expect(clock.getState()).toEqual({ t: 1, playing: false, speed: 1, ended: false });
    clock.toggle();
    frame(1000);
    frame(1250);
    expect(ticks).toEqual([1, 2]);
    clock.toggle();
    expect(pending.size).toBe(0);
  });

  it('rejects invalid seek positions and speeds without changing state', () => {
    const { clock, states, ticks } = setup();
    const before = clock.getState();
    for (const t of [NaN, Infinity, -Infinity]) {
      expect(() => clock.seek(t)).toThrow(RangeError);
    }
    for (const speed of [0, -1, NaN, Infinity, -Infinity]) {
      expect(() => clock.setSpeed(speed)).toThrow(RangeError);
    }
    expect(clock.getState()).toEqual(before);
    expect(ticks).toEqual([]);
    expect(states).toEqual([]);
  });

  it('cancels a pending frame on destroy and ignores later commands', () => {
    const { clock, frame, pending, states, ticks } = setup();
    clock.play();
    expect(pending.size).toBe(1);
    clock.destroy();
    expect(pending.size).toBe(0);
    const destroyed = clock.getState();
    expect(destroyed.playing).toBe(false);
    states.length = 0;
    frame(250);
    clock.play();
    clock.toggle();
    clock.pause();
    clock.seek(3);
    clock.stepPeriod(1);
    clock.setSpeed(0);
    clock.destroy();
    expect(clock.getState()).toEqual(destroyed);
    expect(pending.size).toBe(0);
    expect(ticks).toEqual([]);
    expect(states).toEqual([]);
  });

  it('still rejects non-finite seek positions after destroy', () => {
    const { clock, states, ticks } = setup();
    clock.destroy();
    for (const t of [NaN, Infinity, -Infinity]) {
      expect(() => clock.seek(t)).toThrow(RangeError);
    }
    expect(ticks).toEqual([]);
    expect(states).toEqual([]);
  });

  it('publishes a paused state after a draw callback fails and can restart', () => {
    const error = new Error('Draw failed');
    const { clock, frame, pending, states } = setup({
      onTick(t) {
        if (t === 1) throw error;
      },
    });
    clock.play();
    frame(0);
    expect(() => frame(250)).toThrow(error);
    expect(pending.size).toBe(0);
    expect(clock.getState()).toEqual({ t: 1, playing: false, speed: 1, ended: false });
    expect(states).toEqual([
      { t: 0, playing: true, speed: 1, ended: false },
      { t: 1, playing: false, speed: 1, ended: false },
    ]);
    clock.play();
    frame(500);
    frame(750);
    expect(clock.getState()).toEqual({ t: 2, playing: true, speed: 1, ended: false });
  });

  it('keeps the original callback error if publishing the paused state also fails', () => {
    const error = new Error('State update failed');
    const states: RaceClockState[] = [];
    const { clock, frame, pending } = setup({
      onStateChange(state) {
        states.push(state);
        if (states.length === 1) throw error;
        if (states.length === 2) throw new Error('Paused state update failed');
      },
    });
    expect(() => clock.play()).toThrow(error);
    expect(pending.size).toBe(0);
    expect(clock.getState()).toEqual({ t: 0, playing: false, speed: 1, ended: false });
    expect(states).toEqual([
      { t: 0, playing: true, speed: 1, ended: false },
      { t: 0, playing: false, speed: 1, ended: false },
    ]);
    clock.play();
    frame(0);
    frame(250);
    expect(clock.getState()).toEqual({ t: 1, playing: true, speed: 1, ended: false });
  });
});
