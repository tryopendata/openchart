/**
 * A playback controller with a stable identity that forwards to whichever session is
 * current, so `chart.playback` and its `period` listeners survive an update that rebuilds
 * the session.
 */
import { reportListenerError } from './period-events';
import type { PlaybackController, PlaybackPeriod } from './types';

/** The stable controller and the hook that points it at a new session. */
export interface ControllerRelay {
  readonly controller: PlaybackController;
  /**
   * Forward to `target` from now on. Listeners carry over and hear the period `target`
   * opened on when it differs from the last one they were told: in a microtask, or first
   * thing when `target` emits sooner, so a listener never runs inside the render that called
   * `follow()`.
   */
  follow(target: PlaybackController): void;
  /** Drop every listener and stop forwarding events. The last state stays readable. */
  release(): void;
}

/**
 * Create a relay that forwards to `initial` until `follow()` names another controller. A
 * listener that throws is reported to the page and the others still hear the period.
 */
export function createControllerRelay(initial: PlaybackController): ControllerRelay {
  let target = initial;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(period: PlaybackPeriod) => void>();
  // The period listeners last heard, or the one the run opened on.
  let lastPeriod = initial.getState().period;
  // The period a followed session opened on, until listeners have been told it.
  let opening: PlaybackPeriod | null = null;

  function deliver(period: PlaybackPeriod) {
    lastPeriod = period;
    for (const listener of [...listeners]) {
      try {
        listener(period);
      } catch (error) {
        reportListenerError(error);
      }
    }
  }

  function samePeriod(a: PlaybackPeriod, b: PlaybackPeriod): boolean {
    return a.index === b.index && a.value === b.value;
  }

  /** Tell listeners the period the followed session opened on, if it's news and still owed. */
  function catchUp() {
    const period = opening;
    opening = null;
    if (period && !samePeriod(period, lastPeriod)) deliver(period);
  }

  function subscribe() {
    unsubscribe?.();
    unsubscribe = target.on('period', (period) => {
      catchUp();
      deliver(period);
    });
  }

  const controller: PlaybackController = {
    play: () => target.play(),
    pause: () => target.pause(),
    seek: (t) => target.seek(t),
    setSpeed: (speed) => target.setSpeed(speed),
    getState: () => target.getState(),
    on(event, cb) {
      if (event !== 'period') {
        throw new TypeError(`Unknown playback event "${event}". Supported: "period".`);
      }
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };

  subscribe();
  return {
    controller,
    follow(next) {
      target = next;
      subscribe();
      opening = next.getState().period;
      queueMicrotask(catchUp);
    },
    release() {
      opening = null;
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
