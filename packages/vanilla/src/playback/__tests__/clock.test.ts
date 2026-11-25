import { describe, expect, it } from 'vitest';
import { createPlaybackClock, type PlaybackClockOptions, type PlaybackClockState } from '../clock';

function setup(overrides: Partial<Omit<PlaybackClockOptions, 'scheduler'>> = {}) {
  const pending = new Map<number, (now: number) => void>();
  let nextId = 0;
  const ticks: number[] = [];
  const states: PlaybackClockState[] = [];
  const clock = createPlaybackClock({
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

describe('playback clock', () => {
  it('advances from its first frame at the requested speed', () => {
    const { clock, frame, ticks } = setup();
    clock.play();
    frame(500);
    frame(750);
    expect(clock.getState()).toEqual({ t: 1, playing: true, speed: 1, ended: false });
    clock.setSpeed(2);
    frame(1000);
    expect(clock.getState()).toEqual({ t: 3, playing: true, speed: 2, ended: false });
    expect(ticks).toEqual([1, 3]);
  });

  it('holds the final frame, then ends, and replays from zero', () => {
    const { clock, frame, pending } = setup();
    clock.play();
    frame(0);
    frame(1000);
    frame(1199);
    expect(clock.getState()).toEqual({ t: 4, playing: true, speed: 1, ended: false });
    frame(1200);
    expect(clock.getState()).toEqual({ t: 4, playing: false, speed: 1, ended: true });
    expect(pending.size).toBe(0);
    clock.play();
    expect(clock.getState()).toEqual({ t: 0, playing: true, speed: 1, ended: false });
  });

  it('loops to zero after the hold', () => {
    const { clock, frame, pending } = setup({ loop: true });
    clock.play();
    frame(0);
    frame(1000);
    frame(1200);
    expect(clock.getState()).toEqual({ t: 0, playing: true, speed: 1, ended: false });
    expect(pending.size).toBe(1);
  });

  it('clamps seeks and steps whole periods', () => {
    const { clock, ticks } = setup();
    clock.seek(12);
    clock.seek(-1);
    clock.seek(1.25);
    clock.stepPeriod(1);
    clock.stepPeriod(-1);
    expect(ticks).toEqual([4, 0, 1.25, 2, 1]);
  });

  it('plays stepped periods without fractional ticks', () => {
    const { clock, frame, ticks } = setup();
    clock.seek(0.5);
    clock.play(true);
    frame(0);
    frame(300);
    expect(ticks).toEqual([0.5, 0, 1]);
  });

  it('rejects invalid seeks and speeds, and stops on destroy', () => {
    const { clock, pending } = setup();
    expect(() => clock.seek(Number.NaN)).toThrow(RangeError);
    expect(() => clock.setSpeed(0)).toThrow(RangeError);
    clock.play();
    clock.destroy();
    expect(pending.size).toBe(0);
    clock.play();
    expect(clock.getState().playing).toBe(false);
  });
});
