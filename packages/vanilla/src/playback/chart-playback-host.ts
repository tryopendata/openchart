/**
 * The chart mount's side of playback: one session per run, carried across re-renders and
 * updates under the RFC 4.4 rules, a controller whose identity survives a restart, and the
 * playhead-aware tooltips and layout readers.
 */
import {
  type ChartLayout,
  type ChartSpec,
  isLayerSpec,
  type LayerSpec,
  type TooltipContent,
} from '@opendata-ai/openchart-core';
import { type ChartPlayback, hasTimeEncoding } from '@opendata-ai/openchart-engine';
import type { ChartCompiler } from '../chart-sizing';
import type { HoverEmphasis } from '../interactions/hover-emphasis';
import type { TooltipManager } from '../tooltip';
import { type ChartPlaybackMount, mountChartPlayback } from './chart-session';
import {
  type PlaybackTooltips,
  playbackTooltipDescriptors,
  wirePlaybackTooltips,
} from './chart-tooltips';
import { carriedPlayhead, resetPlayhead, samePlaybackShape } from './chart-update';
import { type ControllerRelay, createControllerRelay } from './controller-relay';
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';
import { layoutAtPlayhead } from './frame-layout';
import { createPlaybackCompiler } from './playback-compiler';
import { applySeriesHiding, hiddenSeriesKeys } from './series-hiding';
import type { PlaybackController } from './types';

type MountSpec = ChartSpec | LayerSpec;

/** Whether a mounted spec plays over time. */
export function isPlaybackSpec(spec: MountSpec): spec is ChartSpec {
  return !isLayerSpec(spec) && hasTimeEncoding(spec);
}

/** Height the controls strip takes below the SVG for `spec`: 0 without time or with controls off. */
export function playbackStripHeight(spec: MountSpec): number {
  if (!isPlaybackSpec(spec)) return 0;
  return spec.playback?.controls === false ? 0 : PLAYBACK_CONTROLS_HEIGHT;
}

/** What `render()` hands the host after building the SVG. */
export interface PlaybackRenderArgs {
  svg: SVGElement;
  /** The layout the SVG was built from; a playback's base when the spec has time. */
  layout: ChartLayout;
  spec: MountSpec;
  darkMode: boolean;
}

/** A playback chart's base layout with the playback compiled for it, as GIF export reads it. */
export interface PlaybackExportSource {
  /** The base layout: every keyed mark present, drawn per frame by the playback. */
  layout: ChartLayout;
  playback: ChartPlayback;
  hiddenKeys: ReadonlySet<string>;
}

/** One chart mount's playback, null-safe for specs without time. */
export interface ChartPlaybackHost {
  /**
   * The controller, or null when the rendered spec has no time channel. The same object
   * across re-renders and updates until time is removed.
   */
  readonly controller: PlaybackController | null;
  /** The compiler for `spec` (its playback's base layout), or undefined without time. */
  compilerFor(spec: MountSpec): ChartCompiler | undefined;
  /** Bind playback to a freshly rendered SVG, or tear it down when the layout has none. */
  render(args: PlaybackRenderArgs): void;
  /**
   * The rendered layout with the marks drawn at the playhead (absent and hidden keys
   * dropped), or null without playback. `compiled`, another compile of the same spec (the
   * export's note-band variant), replaces the rendered layout when given.
   */
  frameLayout(compiled?: ChartLayout): ChartLayout | null;
  /**
   * What a playback GIF captures: the rendered layout (or `compiled`, as for
   * `frameLayout`), its playback and the legend-hidden keys. Null without playback.
   */
  exportSource(compiled?: ChartLayout): PlaybackExportSource | null;
  /** Forget compiled playbacks so the next render recompiles, e.g. once webfonts load. */
  invalidate(): void;
  /** Wire tooltips that read the playhead onto the rendered SVG. Returns the cleanup. */
  wireTooltips(svg: SVGElement, tooltips: TooltipManager, emphasis?: HoverEmphasis): () => void;
  /** `base` with lookups read at the playhead, for keyboard navigation over `svg`. */
  tooltipDescriptors(
    svg: SVGElement,
    base: Map<string, TooltipContent>,
  ): Map<string, TooltipContent>;
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
  const compiler = createPlaybackCompiler();
  let mounted: ChartPlaybackMount | null = null;
  let relay: ControllerRelay | null = null;
  // The rendered spec and layout (base, or base with legend state) and their playback.
  let current: {
    spec: ChartSpec;
    layout: ChartLayout;
    playback: ChartPlayback;
    hiddenKeys: Set<string>;
  } | null = null;
  let tooltips: PlaybackTooltips | null = null;
  let tooltipPeriod: number | undefined;

  const playhead = () => mounted?.controller.getState().t ?? 0;
  const currentPlayback = () => current?.playback ?? null;

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
    relay?.release();
    relay = null;
    current = null;
  }

  /** Start a run from scratch, keeping the controller (and its speed) when one exists. */
  function hiddenKeysFor(layout: ChartLayout, spec: ChartSpec, playback: ChartPlayback) {
    return hiddenSeriesKeys(playback.base, spec, compiler.hiddenSeriesFor(layout));
  }

  function exportSource(compiled?: ChartLayout): PlaybackExportSource | null {
    if (!current || !mounted) return null;
    const other = compiled && compiler.playbackFor(compiled);
    if (!compiled || !other) {
      return { layout: current.layout, playback: current.playback, hiddenKeys: current.hiddenKeys };
    }
    const hiddenKeys = hiddenKeysFor(compiled, current.spec, other);
    return { layout: compiled, playback: other, hiddenKeys };
  }

  function restart(args: PlaybackRenderArgs, next: NonNullable<typeof current>) {
    const { spec, playback } = next;
    const speed = relay?.controller.getState().speed;
    mounted?.destroy();
    current = next;
    mounted = mountChartPlayback({
      container,
      svg: args.svg,
      playback,
      darkMode: args.darkMode,
      animate: spec.animation !== false && !editing,
      initialState: relay ? resetPlayhead(playback) : undefined,
      onFrame: refreshTooltips,
    });
    if (speed !== undefined && speed !== 1) mounted.controller.setSpeed(speed);
    if (relay) relay.follow(mounted.controller);
    else relay = createControllerRelay(mounted.controller);
  }

  return {
    get controller() {
      return relay?.controller ?? null;
    },
    compilerFor(spec) {
      return isPlaybackSpec(spec) ? compiler.compilerFor(spec) : undefined;
    },
    render(args) {
      const { spec } = args;
      const playback = compiler.playbackFor(args.layout);
      if (!playback || !isPlaybackSpec(spec)) {
        teardown();
        return;
      }
      const hiddenKeys = hiddenKeysFor(args.layout, spec, playback);
      const next = { spec, layout: args.layout, playback, hiddenKeys };
      if (!mounted || !current || !samePlaybackShape(current.spec, spec)) {
        restart(args, next);
      } else {
        const t = carriedPlayhead(current.playback, playback, playhead());
        current = next;
        mounted.rebind({ svg: args.svg, playback, darkMode: args.darkMode, t });
      }
      applySeriesHiding(args.svg, hiddenKeys);
    },
    frameLayout(compiled) {
      const source = exportSource(compiled);
      if (!source) return null;
      return layoutAtPlayhead(source.playback, playhead(), source.layout, source.hiddenKeys);
    },
    exportSource,
    invalidate() {
      compiler.clear();
    },
    wireTooltips(svg, tooltipManager, emphasis) {
      const wired = wirePlaybackTooltips({
        svg,
        tooltips: tooltipManager,
        emphasis,
        playback: currentPlayback,
        playhead,
      });
      tooltips = wired;
      return () => {
        wired.dispose();
        if (tooltips === wired) tooltips = null;
      };
    },
    tooltipDescriptors(svg, base) {
      return playbackTooltipDescriptors(base, { svg, playback: currentPlayback, playhead });
    },
    pause() {
      mounted?.controller.pause();
    },
    destroy() {
      tooltips?.dispose();
      tooltips = null;
      teardown();
      compiler.clear();
    },
  };
}
