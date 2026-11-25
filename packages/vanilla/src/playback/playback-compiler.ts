/**
 * Compiles a chart mount's time specs into playbacks, once per authored spec, size and
 * option change, and remembers which playback each rendered layout came from. Runtime
 * series toggles never recompile: they only change the legend's hidden state.
 */
import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  LegendLayout,
} from '@opendata-ai/openchart-core';
import { type ChartPlayback, compileChartPlayback } from '@opendata-ai/openchart-engine';
import type { ChartCompiler } from '../chart-sizing';

/** Advisory text for `renderer: 'canvas'` on a time spec, in the engine's refusal wording. */
export const CANVAS_PLAYBACK_WARNING =
  'Chart warning: renderer "canvas" is not supported on playback charts (encoding.time); rendering marks as SVG instead.';

/** A sizer-compatible compiler for time specs plus the lookup back to each playback. */
export interface PlaybackCompiler {
  /**
   * The compiler for one authored spec. It ignores the runtime-toggled spec the sizer
   * passes, except for that spec's `hiddenSeries`, which only marks legend entries hidden.
   */
  compilerFor(authored: ChartSpec): ChartCompiler;
  /** The playback a rendered layout came from, or undefined for any other layout. */
  playbackFor(layout: ChartLayout): ChartPlayback | undefined;
  /** The series hidden in a rendered layout: authored plus runtime toggles. */
  hiddenSeriesFor(layout: ChartLayout): readonly string[];
  /** Drop every cached playback, e.g. once webfonts load and text metrics change. */
  clear(): void;
}

/**
 * Playbacks kept for the current spec. The auto-height loop compiles up to three heights
 * per render and an edit-mode export one more note-band variant; keeping them all means a
 * re-render at the same size compiles nothing.
 */
const MAX_CACHED_PLAYBACKS = 6;

interface CachedPlayback {
  spec: ChartSpec;
  options: CompileOptions;
  playback: ChartPlayback;
}

function sameOptions(a: CompileOptions, b: CompileOptions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof CompileOptions] !== b[key as keyof CompileOptions]) return false;
  }
  return true;
}

function legendWithHidden(legend: LegendLayout, hidden: ReadonlySet<string>): LegendLayout {
  if (!('entries' in legend) || !Array.isArray(legend.entries)) return legend;
  const entries = legend.entries.map((entry) =>
    entry.overflow ? entry : { ...entry, active: !hidden.has(entry.label) },
  );
  return { ...legend, entries } as LegendLayout;
}

/** `base` with the legend entries for `hiddenSeries` drawn as toggled off. */
export function withHiddenSeries(base: ChartLayout, hiddenSeries: readonly string[]): ChartLayout {
  const hidden = new Set(hiddenSeries);
  return {
    ...base,
    legend: legendWithHidden(base.legend, hidden),
    legends: base.legends.map((legend) => legendWithHidden(legend, hidden)),
  };
}

/**
 * Create the compiler for one mount. A `renderer: 'canvas'` request warns once per mount
 * through `console.warn`, like the mount's other advisories, and compiles SVG.
 */
export function createPlaybackCompiler(): PlaybackCompiler {
  const playbackForLayout = new WeakMap<ChartLayout, ChartPlayback>();
  const hiddenForLayout = new WeakMap<ChartLayout, readonly string[]>();
  // Newest first, all for one authored spec.
  let cache: CachedPlayback[] = [];
  let warnedCanvas = false;

  /** @throws What `compileChartPlayback` throws for an invalid spec. */
  function compileAuthored(spec: ChartSpec, options: CompileOptions): ChartPlayback {
    if (options.renderer === 'canvas' && !warnedCanvas) {
      warnedCanvas = true;
      console.warn(CANVAS_PLAYBACK_WARNING);
    }
    const hit = cache.find((entry) => entry.spec === spec && sameOptions(entry.options, options));
    if (hit) return hit.playback;
    const playback = compileChartPlayback(spec, { ...options, renderer: 'svg' });
    playbackForLayout.set(playback.base, playback);
    const sameSpec = cache.filter((entry) => entry.spec === spec);
    cache = [{ spec, options, playback }, ...sameSpec].slice(0, MAX_CACHED_PLAYBACKS);
    return playback;
  }

  return {
    compilerFor: (authored) => (toggled, options) => {
      const playback = compileAuthored(authored, options);
      if (toggled === authored) {
        hiddenForLayout.set(playback.base, authored.hiddenSeries ?? []);
        return playback.base;
      }
      const hidden = toggled.hiddenSeries ?? [];
      const layout = withHiddenSeries(playback.base, hidden);
      playbackForLayout.set(layout, playback);
      hiddenForLayout.set(layout, hidden);
      return layout;
    },
    playbackFor: (layout) => playbackForLayout.get(layout),
    hiddenSeriesFor: (layout) => hiddenForLayout.get(layout) ?? [],
    clear() {
      cache = [];
    },
  };
}
