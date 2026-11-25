/**
 * Playback for a mounted geo or tile map: the shared playback mount driving the map frame
 * writer over the SVG the mount rendered. The session outlives re-renders: `rebind()` moves
 * it onto a fresh SVG and a recompiled playback.
 */
import type { MapPlayback } from '@opendata-ai/openchart-engine';
import { createMapFrameWriter } from './map-frames';
import {
  mountPlayback,
  type PlaybackMount,
  type PlaybackMountOptions,
  type PlaybackMountView,
} from './playback-mount';

/** Any map playback; the session reads only what geo and tile maps share. */
export type AnyMapPlayback = MapPlayback<unknown>;

/** Options for `mountMapPlayback`: the shared mount's options for a map playback. */
export type MapPlaybackMountOptions = Omit<PlaybackMountOptions<AnyMapPlayback>, 'createWriter'>;

/** What a re-render hands an existing playback. */
export type MapPlaybackView = PlaybackMountView<AnyMapPlayback>;

/** A map's running playback. */
export type MapPlaybackMount = PlaybackMount<AnyMapPlayback>;

/**
 * Start playback on a rendered time map: mount the controls strip below the SVG (when
 * `controls` is on), draw the opening frame and wire autoplay. Reduced motion and
 * `animate: false` open on the final period without autoplay.
 *
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function mountMapPlayback(options: MapPlaybackMountOptions): MapPlaybackMount {
  return mountPlayback({ ...options, createWriter: createMapFrameWriter });
}
