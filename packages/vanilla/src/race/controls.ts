/**
 * The race's control strip: the shared playback controls under the `oc-race` class prefix.
 */
import {
  createPlaybackControls,
  type PlaybackControls,
  type PlaybackControlsOptions,
} from '../playback/controls';

/** Class prefix of every race control element. */
export const RACE_CLASS_PREFIX = 'oc-race';

/** Labels and action callbacks for the race's control strip. */
export type RaceControlsOptions = Omit<PlaybackControlsOptions, 'classPrefix'>;

/** A race control strip whose caller supplies playback state through `update()`. */
export type RaceControls = PlaybackControls;

/** Create a detached race control strip. Call `update()` when playback state changes. */
export function createRaceControls(options: RaceControlsOptions): RaceControls {
  return createPlaybackControls({ ...options, classPrefix: RACE_CLASS_PREFIX });
}
