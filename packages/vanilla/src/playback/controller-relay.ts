/**
 * A playback controller with a stable identity that forwards to whichever session is
 * current, so `chart.playback` and its `period` listeners survive an update that rebuilds
 * the session.
 */
import type { PlaybackController, PlaybackPeriod } from './types';

/** The stable controller and the hook that points it at a new session. */
export interface ControllerRelay {
  readonly controller: PlaybackController;
  /**
   * Forward to `target` from now on; listeners carry over and hear `target`'s period when
   * it differs from the last one they were told.
   */
  follow(target: PlaybackController): void;
  /** Drop every listener and stop forwarding events. The last state stays readable. */
  release(): void;
}

/** Create a relay that forwards to `initial` until `follow()` names another controller. */
export function createControllerRelay(initial: PlaybackController): ControllerRelay {
  let target = initial;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(period: PlaybackPeriod) => void>();
  // The period listeners last heard, or the one the run opened on.
  let lastPeriod = initial.getState().period;

  function deliver(period: PlaybackPeriod) {
    lastPeriod = period;
    for (const listener of [...listeners]) listener(period);
  }

  function subscribe() {
    unsubscribe?.();
    unsubscribe = target.on('period', deliver);
  }

  function samePeriod(a: PlaybackPeriod, b: PlaybackPeriod): boolean {
    return a.index === b.index && a.value === b.value;
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
      const period = target.getState().period;
      if (!samePeriod(period, lastPeriod)) deliver(period);
    },
    release() {
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
