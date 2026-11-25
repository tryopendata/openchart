import { afterEach, describe, expect, it } from 'vitest';
import {
  createPlaybackSession,
  type PlaybackSessionOptions,
  type PlaybackSessionTiming,
} from '../session';

const labels = ['2000', '2001', '2002', '2003', '2004'];
const timing: PlaybackSessionTiming = {
  periodCount: 5,
  durationMs: 1000,
  holdEndMs: 200,
  loop: false,
  autoplay: 'visible',
  controls: true,
};

function setup(overrides: Partial<PlaybackSessionOptions> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const pending = new Map<number, (now: number) => void>();
  let nextId = 0;
  const drawn: number[] = [];
  const seen: Array<() => void> = [];
  let cancelledSeen = 0;
  const session = createPlaybackSession({
    container,
    timing,
    periodLabels: labels,
    periodAt: (index) => ({ index, value: 2000 + index, label: labels[index] }),
    draw: (t) => drawn.push(t),
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
    reducedMotion: () => false,
    whenSeen(_element, cb) {
      seen.push(cb);
      return () => {
        cancelledSeen++;
      };
    },
    ...overrides,
  });
  return {
    container,
    session,
    drawn,
    pending,
    seen,
    cancelled: () => cancelledSeen,
    frame(now: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(now);
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('playback session', () => {
  it('starts "visible" autoplay when the container is seen', () => {
    const { session, seen } = setup();
    expect(seen).toHaveLength(1);
    expect(session.getState().playing).toBe(false);
    seen[0]();
    expect(session.getState()).toMatchObject({ t: 0, playing: true, ended: false });
  });

  it('starts true autoplay at once and leaves false autoplay paused', () => {
    expect(setup({ timing: { ...timing, autoplay: true } }).session.getState().playing).toBe(true);
    const manual = setup({ timing: { ...timing, autoplay: false } });
    expect(manual.seen).toHaveLength(0);
    expect(manual.session.getState().playing).toBe(false);
  });

  it('opens on the final period without autoplay under reduced motion', () => {
    const { session, seen, drawn } = setup({ reducedMotion: () => true });
    expect(seen).toHaveLength(0);
    expect(session.getState()).toMatchObject({
      t: 4,
      playing: false,
      period: { index: 4, value: 2004, label: '2004' },
    });
    expect(drawn.at(-1)).toBe(4);
  });

  it('opens on the final period without autoplay when animation is off', () => {
    const { session, seen } = setup({ animate: false });
    expect(seen).toHaveLength(0);
    expect(session.getState()).toMatchObject({ t: 4, playing: false });
  });

  it('steps whole periods when played under reduced motion', () => {
    const { session, frame, drawn } = setup({ reducedMotion: () => true });
    session.seek(0);
    session.play();
    frame(0);
    frame(300);
    expect(drawn.slice(-1)).toEqual([1]);
    expect(Number.isInteger(session.getState().t)).toBe(true);
  });

  it('draws, reports periods and cancels pending autoplay on seek', () => {
    const { session, drawn, cancelled } = setup();
    const periods: number[] = [];
    session.on('period', (period) => periods.push(period.index));
    session.seek(2.5);
    expect(drawn.at(-1)).toBe(2.5);
    expect(periods).toEqual([2]);
    expect(cancelled()).toBe(1);
    expect(session.getState().period).toEqual({ index: 2, value: 2002, label: '2002' });
  });

  it('mounts controls with the class prefix into the attached slot', () => {
    const slot = document.createElement('div');
    const { session } = setup({ classPrefix: 'oc-race' });
    session.attach({ controls: slot });
    expect(slot.querySelector('.oc-race-controls')).toBe(session.controlsElement);
    const other = setup();
    const otherSlot = document.createElement('div');
    other.session.attach({ controls: otherSlot });
    expect(otherSlot.querySelector('.oc-playback-controls')).not.toBeNull();
  });

  it('announces on pause, not during play', () => {
    const announcer = document.createElement('div');
    const { session, frame } = setup({ describe: (t) => `At ${t}` });
    session.attach({ announcer });
    session.play();
    frame(0);
    frame(250);
    expect(announcer.textContent).toBe('');
    session.pause();
    expect(announcer.textContent).toBe('At 1');
  });

  it('stops the clock on destroy and ignores later playback calls', () => {
    const slot = document.createElement('div');
    const { session, pending, cancelled } = setup();
    session.attach({ controls: slot });
    session.play();
    expect(pending.size).toBe(1);
    session.destroy();
    expect(pending.size).toBe(0);
    expect(session.getState().playing).toBe(false);
    expect(slot.childElementCount).toBe(0);
    expect(cancelled()).toBe(1);
    session.play();
    expect(pending.size).toBe(0);
    session.destroy();
  });
});
