/**
 * Playback for a mounted chart: the shared playback mount driving the chart frame and trail
 * writers over the SVG the chart mount rendered. The session outlives re-renders: `rebind()`
 * moves it onto a freshly rendered SVG and a recompiled playback.
 */
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import { createChartFrameWriter } from './chart-frames';
import { createChartTrailWriter } from './chart-trails';
import {
  mountPlayback,
  type PlaybackFrameWriter,
  type PlaybackMount,
  type PlaybackMountOptions,
  type PlaybackMountView,
} from './playback-mount';

/** Options for `mountChartPlayback`: the shared mount's options for a chart playback. */
export type ChartPlaybackMountOptions = Omit<PlaybackMountOptions<ChartPlayback>, 'createWriter'>;

/** What a re-render hands an existing playback: the new SVG and the playback compiled for it. */
export type ChartPlaybackView = PlaybackMountView<ChartPlayback>;

/** A chart's running playback. */
export type ChartPlaybackMount = PlaybackMount<ChartPlayback>;

/** The frame writer and, when the playback has trails, the trail writer for one SVG. */
function bindFrameWriters(svg: SVGElement, playback: ChartPlayback): PlaybackFrameWriter {
  const frames = createChartFrameWriter(svg, playback);
  const trails = createChartTrailWriter(svg, playback);
  return {
    draw(t: number) {
      trails?.draw(t);
      frames.draw(t);
    },
    destroy() {
      trails?.destroy();
      frames.destroy();
    },
  };
}

/**
 * Start playback on a rendered time chart: mount the controls strip below the SVG (when
 * `controls` is on and there are two or more periods), draw the opening frame, and wire
 * autoplay. Reduced motion and `animate: false` open on the final period without autoplay.
 *
 * @throws {RangeError} If `initialState` has a non-finite position or an invalid speed.
 */
export function mountChartPlayback(options: ChartPlaybackMountOptions): ChartPlaybackMount {
  return mountPlayback({ ...options, createWriter: bindFrameWriters });
}
