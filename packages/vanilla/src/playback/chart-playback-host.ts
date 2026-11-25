/**
 * The chart mount's side of playback: compiles time specs into playbacks (once per spec,
 * size and option change), keeps one session across re-renders, decides when an update
 * keeps it or starts over, and wires the playhead-aware tooltips.
 */
import {
  type ChartLayout,
  type ChartSpec,
  type CompileOptions,
  isLayerSpec,
  type LayerSpec,
} from '@opendata-ai/openchart-core';
import {
  type ChartPlayback,
  compileChartPlayback,
  hasTimeEncoding,
} from '@opendata-ai/openchart-engine';
import type { ChartCompiler } from '../chart-sizing';
import type { HoverEmphasis } from '../interactions/hover-emphasis';
import type { TooltipManager } from '../tooltip';
import { type ChartPlaybackMount, mountChartPlayback } from './chart-session';
import { type PlaybackTooltips, wirePlaybackTooltips } from './chart-tooltips';
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';
import type { PlaybackController } from './types';

type MountSpec = ChartSpec | LayerSpec;

/** Advisory text for `renderer: 'canvas'` on a time spec, in the engine's refusal wording. */
export const CANVAS_PLAYBACK_WARNING =
  'Chart warning: renderer "canvas" is not supported on playback charts (encoding.time); rendering marks as SVG instead.';

/** Whether a mounted spec plays over time. */
export function isPlaybackSpec(spec: MountSpec): spec is ChartSpec {
  return !isLayerSpec(spec) && hasTimeEncoding(spec);
}

/** Height the controls strip takes below the SVG for `spec`: 0 without time or with controls off. */
export function playbackStripHeight(spec: MountSpec): number {
  if (!isPlaybackSpec(spec)) return 0;
  return spec.playback?.controls === false ? 0 : PLAYBACK_CONTROLS_HEIGHT;
}

function markType(spec: ChartSpec): string {
  return typeof spec.mark === 'string' ? spec.mark : spec.mark.type;
}

function channelField(channel: unknown): string | undefined {
  if (typeof channel !== 'object' || channel === null) return undefined;
  const { field } = channel as { field?: unknown };
  return typeof field === 'string' ? field : undefined;
}

/**
 * Whether an update can keep the running playback: the same mark type, time field and type,
 * and identity field. Anything else starts over.
 */
export function samePlaybackShape(previous: ChartSpec, next: ChartSpec): boolean {
  const before = previous.encoding as Record<string, unknown>;
  const after = next.encoding as Record<string, unknown>;
  const timeType = (encoding: Record<string, unknown>) =>
    (encoding.time as { type?: unknown } | undefined)?.type;
  return (
    markType(previous) === markType(next) &&
    channelField(before.time) === channelField(after.time) &&
    timeType(before) === timeType(after) &&
    channelField(before.key) === channelField(after.key)
  );
}

function sameOptions(a: CompileOptions, b: CompileOptions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof CompileOptions] !== b[key as keyof CompileOptions]) return false;
  }
  return true;
}

/** What `render()` hands the host after building the SVG. */
export interface PlaybackRenderArgs {
  svg: SVGElement;
  /** The layout the SVG was built from; a playback's base when the spec has time. */
  layout: ChartLayout;
  spec: MountSpec;
  darkMode: boolean;
}

/** One chart mount's playback, null-safe for specs without time. */
export interface ChartPlaybackHost {
  /** The current controller, or null when the rendered spec has no time channel. */
  readonly controller: PlaybackController | null;
  /** The compiler for `spec` (its playback's base layout), or undefined without time. */
  compilerFor(spec: MountSpec): ChartCompiler | undefined;
  /** Bind playback to a freshly rendered SVG, or tear it down when the layout has none. */
  render(args: PlaybackRenderArgs): void;
  /** Wire tooltips that read the playhead onto the rendered SVG. Returns the cleanup. */
  wireTooltips(svg: SVGElement, tooltips: TooltipManager, emphasis?: HoverEmphasis): () => void;
  /** Pause playback, e.g. when an edit gesture starts. */
  pause(): void;
  destroy(): void;
}

/**
 * Create the playback host for one chart mount. `editing` opens every playback on its final
 * period without autoplay.
 */
export function createChartPlaybackHost(options: {
  container: HTMLElement;
  editing: boolean;
}): ChartPlaybackHost {
  const { container, editing } = options;
  const playbackForBase = new WeakMap<ChartLayout, ChartPlayback>();
  let cache: { spec: ChartSpec; options: CompileOptions; playback: ChartPlayback } | undefined;
  let mounted: ChartPlaybackMount | null = null;
  let current: { spec: ChartSpec; playback: ChartPlayback } | null = null;
  let tooltips: PlaybackTooltips | null = null;
  let tooltipPeriod: number | undefined;
  let warnedCanvas = false;

  function compilePlayback(spec: ChartSpec, compileOptions: CompileOptions): ChartLayout {
    if (compileOptions.renderer === 'canvas' && !warnedCanvas) {
      warnedCanvas = true;
      console.warn(CANVAS_PLAYBACK_WARNING);
    }
    if (cache && cache.spec === spec && sameOptions(cache.options, compileOptions)) {
      return cache.playback.base;
    }
    const playback = compileChartPlayback(spec, { ...compileOptions, renderer: 'svg' });
    playbackForBase.set(playback.base, playback);
    cache = { spec, options: compileOptions, playback };
    return playback.base;
  }

  // Tooltips show the nearest period's values, so they change only when that period does.
  function refreshTooltips(t: number) {
    const period = Math.round(t);
    if (period === tooltipPeriod) return;
    tooltipPeriod = period;
    tooltips?.refresh();
  }

  function teardown() {
    mounted?.destroy();
    mounted = null;
    current = null;
  }

  return {
    get controller() {
      return mounted?.controller ?? null;
    },
    compilerFor(spec) {
      return isPlaybackSpec(spec) ? compilePlayback : undefined;
    },
    render({ svg, layout, spec, darkMode }) {
      const playback = playbackForBase.get(layout);
      if (!playback || !isPlaybackSpec(spec)) {
        teardown();
        return;
      }
      if (mounted && current && samePlaybackShape(current.spec, spec)) {
        current = { spec, playback };
        mounted.rebind({ svg, playback, darkMode });
        return;
      }
      teardown();
      current = { spec, playback };
      mounted = mountChartPlayback({
        container,
        svg,
        playback,
        darkMode,
        animate: spec.animation !== false && !editing,
        onFrame: refreshTooltips,
      });
    },
    wireTooltips(svg, tooltipManager, emphasis) {
      const wired = wirePlaybackTooltips({
        svg,
        tooltips: tooltipManager,
        emphasis,
        playback: () => current?.playback ?? null,
        playhead: () => mounted?.controller.getState().t ?? 0,
      });
      tooltips = wired;
      return () => {
        wired.dispose();
        if (tooltips === wired) tooltips = null;
      };
    },
    pause() {
      mounted?.controller.pause();
    },
    destroy() {
      tooltips?.dispose();
      tooltips = null;
      teardown();
      cache = undefined;
    },
  };
}
