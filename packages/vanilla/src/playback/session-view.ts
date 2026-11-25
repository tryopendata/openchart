/**
 * The DOM a playback session places in each rendered view: the control strip, rebuilt
 * per view, and the live region, moved between views so its text survives a re-render.
 */
import {
  createPlaybackAnnouncer,
  type PlaybackAnnounceCause,
  type PlaybackAnnouncer,
} from './announcer';
import type { PlaybackClockState } from './clock';
import {
  createPlaybackControls,
  type PlaybackControls,
  type PlaybackControlsOptions,
} from './controls';

/** Control class prefix, announcement text and the reader actions the strip reports. */
export interface SessionViewOptions {
  classPrefix: string;
  describe?(t: number): string;
  actions: Pick<PlaybackControlsOptions, 'onToggle' | 'onSeek' | 'onStep'>;
  /** Called when the reader releases the scrubber. */
  onSeekCommit(): void;
}

/** The session's controls and live region in the current view. */
export interface SessionView {
  readonly controlsElement: HTMLElement | null;
  /** Show playback state on the mounted strip. */
  update(state: PlaybackClockState): void;
  /** Replace the strip with a new one in `slot`, or remove it when `slot` is null. */
  mountControls(
    slot: HTMLElement | null | undefined,
    periodLabels: string[],
    state: PlaybackClockState,
  ): void;
  /** Create the live region in `host`, or move it there. Does nothing without `describe`. */
  mountAnnouncer(host: HTMLElement | undefined): void;
  /** Pass a playhead change to the live region's announce policy. */
  announce(cause: PlaybackAnnounceCause, state: PlaybackClockState): void;
  /** Remove the strip and the live region. */
  destroy(): void;
}

/** Create the holder for a session's controls and live region. Nothing is mounted yet. */
export function createSessionView(options: SessionViewOptions): SessionView {
  const { classPrefix, describe, actions, onSeekCommit } = options;
  let controls: PlaybackControls | undefined;
  let announcer: PlaybackAnnouncer | undefined;

  function removeControls() {
    controls?.element.removeEventListener('change', onSeekCommit);
    controls?.destroy();
    controls = undefined;
  }

  return {
    get controlsElement() {
      return controls?.element ?? null;
    },
    update(state) {
      controls?.update(state);
    },
    mountControls(slot, periodLabels, state) {
      removeControls();
      if (!slot) return;
      controls = createPlaybackControls({ classPrefix, periodLabels, ...actions });
      controls.element.addEventListener('change', onSeekCommit);
      slot.append(controls.element);
      controls.update(state);
    },
    mountAnnouncer(host) {
      if (!host || !describe) return;
      if (announcer) announcer.attach(host);
      else announcer = createPlaybackAnnouncer({ host, describe });
    },
    announce(cause, state) {
      announcer?.notify(cause, state);
    },
    destroy() {
      removeControls();
      announcer?.destroy();
      announcer = undefined;
    },
  };
}
