/**
 * Compiles a chart mount's time specs into playbacks, once per spec, size and option change,
 * and remembers which playback each base layout came from.
 */
import type { ChartLayout, ChartSpec, CompileOptions } from '@opendata-ai/openchart-core';
import { type ChartPlayback, compileChartPlayback } from '@opendata-ai/openchart-engine';
import type { ChartCompiler } from '../chart-sizing';

/** Advisory text for `renderer: 'canvas'` on a time spec, in the engine's refusal wording. */
export const CANVAS_PLAYBACK_WARNING =
  'Chart warning: renderer "canvas" is not supported on playback charts (encoding.time); rendering marks as SVG instead.';

/** A sizer-compatible compiler for time specs plus the lookup back to each playback. */
export interface PlaybackCompiler {
  /** Compile `spec` and return its playback's base layout. */
  compile: ChartCompiler;
  /** The playback whose base is `layout`, or undefined for any other layout. */
  playbackFor(layout: ChartLayout): ChartPlayback | undefined;
  /** Drop the cached playback. */
  clear(): void;
}

function sameOptions(a: CompileOptions, b: CompileOptions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof CompileOptions] !== b[key as keyof CompileOptions]) return false;
  }
  return true;
}

/**
 * Create the compiler for one mount. A `renderer: 'canvas'` request warns once per mount
 * through `console.warn`, like the mount's other advisories, and compiles SVG.
 * @throws What `compileChartPlayback` throws for an invalid spec.
 */
export function createPlaybackCompiler(): PlaybackCompiler {
  const playbackForBase = new WeakMap<ChartLayout, ChartPlayback>();
  let cache: { spec: ChartSpec; options: CompileOptions; playback: ChartPlayback } | undefined;
  let warnedCanvas = false;

  function compile(spec: ChartSpec, options: CompileOptions): ChartLayout {
    if (options.renderer === 'canvas' && !warnedCanvas) {
      warnedCanvas = true;
      console.warn(CANVAS_PLAYBACK_WARNING);
    }
    if (cache && cache.spec === spec && sameOptions(cache.options, options)) {
      return cache.playback.base;
    }
    const playback = compileChartPlayback(spec, { ...options, renderer: 'svg' });
    playbackForBase.set(playback.base, playback);
    cache = { spec, options, playback };
    return playback.base;
  }

  return {
    compile,
    playbackFor: (layout) => playbackForBase.get(layout),
    clear() {
      cache = undefined;
    },
  };
}
