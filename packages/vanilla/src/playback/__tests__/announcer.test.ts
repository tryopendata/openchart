import { afterEach, describe, expect, it } from 'vitest';
import { createPlaybackAnnouncer } from '../announcer';

const paused = (t: number) => ({ t, playing: false, speed: 1, ended: false });
const playing = (t: number) => ({ t, playing: true, speed: 1, ended: false });

function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const announcer = createPlaybackAnnouncer({ host, describe: (t) => `Period ${t}` });
  return { host, announcer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('playback announcer', () => {
  it('adds a polite atomic live region to the host', () => {
    const { host, announcer } = setup();
    expect(announcer.element.parentElement).toBe(host);
    expect(announcer.element.getAttribute('aria-live')).toBe('polite');
    expect(announcer.element.getAttribute('aria-atomic')).toBe('true');
    expect(announcer.element.textContent).toBe('');
  });

  it.each(['pause', 'seek', 'step'] as const)('announces describe(t) on %s', (cause) => {
    const { announcer } = setup();
    announcer.notify(cause, paused(2));
    expect(announcer.element.textContent).toBe('Period 2');
  });

  it('never announces during play', () => {
    const { announcer } = setup();
    announcer.notify('play', playing(0));
    announcer.notify('tick', playing(0.5));
    announcer.notify('seek', playing(1));
    announcer.notify('tick', paused(1));
    expect(announcer.element.textContent).toBe('');
  });

  it('moves to a new host and stops after destroy', () => {
    const { announcer } = setup();
    const next = document.createElement('div');
    announcer.notify('pause', paused(1));
    announcer.attach(next);
    expect(announcer.element.parentElement).toBe(next);
    expect(announcer.element.textContent).toBe('Period 1');
    announcer.destroy();
    expect(announcer.element.isConnected).toBe(false);
    announcer.notify('pause', paused(3));
    expect(announcer.element.textContent).toBe('Period 1');
  });
});
