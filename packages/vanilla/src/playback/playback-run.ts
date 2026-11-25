/**
 * The run a chart or map playback host holds across re-renders and updates: the mounted
 * playback, restarting it with the controller's identity and speed kept through a relay,
 * tearing it down, and reading its playhead.
 */
import { type ControllerRelay, createControllerRelay } from './controller-relay';
import type { PlaybackController } from './types';

/** The part of a mounted playback the run manages. */
export interface RunMount {
  controller: PlaybackController;
  destroy(): void;
}

/** One host's current run. */
export interface PlaybackRunHolder<Mount extends RunMount> {
  /** The mounted playback, or null before the first run and after teardown. */
  readonly mounted: Mount | null;
  /** The stable controller, or null without a run. The same object across restarts. */
  readonly controller: PlaybackController | null;
  /** The mounted playhead, or 0 without a run. */
  playhead(): number;
  /**
   * Start a run from scratch, keeping the controller (and its speed) when one exists.
   * `mount` hears whether this replaces an earlier run, so an update can open where it
   * should instead of where a fresh mount would.
   */
  restart(mount: (replacing: boolean) => Mount): Mount;
  /** Destroy the run and release the controller's listeners. */
  teardown(): void;
}

/** Create an empty run holder for one host. */
export function createPlaybackRun<Mount extends RunMount>(): PlaybackRunHolder<Mount> {
  let mounted: Mount | null = null;
  let relay: ControllerRelay | null = null;

  return {
    get mounted() {
      return mounted;
    },
    get controller() {
      return relay?.controller ?? null;
    },
    playhead: () => mounted?.controller.getState().t ?? 0,
    restart(mount) {
      const speed = relay?.controller.getState().speed;
      mounted?.destroy();
      const next = mount(relay !== null);
      mounted = next;
      if (speed !== undefined && speed !== 1) next.controller.setSpeed(speed);
      if (relay) relay.follow(next.controller);
      else relay = createControllerRelay(next.controller);
      return next;
    },
    teardown() {
      mounted?.destroy();
      mounted = null;
      relay?.release();
      relay = null;
    },
  };
}

/**
 * A frame callback that runs `onChange` only when the nearest period changes. Tooltips and
 * accessible labels show the nearest period's values, so they change only when it does.
 */
export function onNearestPeriodChange(onChange: () => void): (t: number) => void {
  let shown: number | undefined;
  return (t) => {
    const period = Math.round(t);
    if (period === shown) return;
    shown = period;
    onChange();
  };
}
