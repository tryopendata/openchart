/**
 * A playback controller with a stable identity that forwards to whichever session is
 * current, so `chart.playback` and its `period` listeners survive an update that rebuilds
 * the session.
 */
import type { PlaybackController, PlaybackPeriod } from './types';

/** The stable controller and the hook that points it at a new session. */
export interface ControllerRelay {
  readonly controller: PlaybackController;
  /** Forward to `target` from now on; listeners carry over. */
  follow(target: PlaybackController): void;
  /** Drop every listener and stop forwarding events. The last state stays readable. */
  release(): void;
}

/** Create a relay that forwards to `initial` until `follow()` names another controller. */
export function createControllerRelay(initial: PlaybackController): ControllerRelay {
  let target = initial;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(period: PlaybackPeriod) => void>();

  function subscribe() {
    unsubscribe?.();
    unsubscribe = target.on('period', (period) => {
      for (const listener of [...listeners]) listener(period);
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
    },
    release() {
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
