/**
 * Manual frame clock for driving a real 2D graph mount under happy-dom.
 *
 * The graph's entrance, camera flights and render loop run on
 * requestAnimationFrame and performance.now(). Replacing both with a clock the
 * test advances by hand makes the camera deterministic, so tests can observe
 * the entrance through the public camera instead of mocking the mount.
 *
 * Shared by the vanilla, React, Vue and Svelte graph tests.
 */

import { vi } from 'vitest';

export interface FrameClock {
  /** Run every queued frame callback at timestamp `ts` (ms). */
  pump(ts: number): void;
  /** Restore the real rAF and clock. */
  restore(): void;
}

export function installFrameClock(): FrameClock {
  let callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    callbacks.delete(id);
  });
  const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
  return {
    pump(ts) {
      now = ts;
      const queued = callbacks;
      callbacks = new Map();
      for (const cb of queued.values()) cb(ts);
    },
    restore() {
      nowSpy.mockRestore();
      vi.unstubAllGlobals();
    },
  };
}

/**
 * Whether a freshly mounted graph played its entrance. The entrance opens with
 * the camera pulled back to 0.7x the fit and flies in; a suppressed entrance
 * (or reduced motion) snaps straight to the fit and never moves.
 *
 * Call right after mount, before any other frames have been pumped. Advances
 * the clock past the entrance (start..start+1400ms).
 */
export async function playsEntrance(
  clock: FrameClock,
  getZoom: () => number,
  start = 0,
): Promise<boolean> {
  // The first tick (which starts the entrance) is deferred past a microtask.
  await Promise.resolve();
  clock.pump(start);
  const opening = getZoom();
  for (let t = start + 50; t <= start + 1400; t += 50) clock.pump(t);
  const settled = getZoom();
  if (!(opening > 0 && settled > 0)) throw new Error('graph camera never framed the nodes');
  return opening < settled * 0.9;
}
