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
import { layoutAtPlayhead } from './frame-layout';
import { createPlaybackCompiler } from './playback-compiler';
import { createPlaybackRun, onNearestPeriodChange } from './playback-run';
import { applySeriesHiding, hiddenSeriesKeys } from './series-hiding';
import { stripHeight } from './strip';
import type { PlaybackController } from './types';

type MountSpec = ChartSpec | LayerSpec;

/** Whether a mounted spec plays over time. */
export function isPlaybackSpec(spec: MountSpec): spec is ChartSpec {
  return !isLayerSpec(spec) && hasTimeEncoding(spec);
}

/** Height the controls strip takes below the SVG for `spec`: 0 without time or with controls off. */
export function playbackStripHeight(spec: MountSpec): number {
  return stripHeight(isPlaybackSpec(spec), isPlaybackSpec(spec) ? spec.playback : undefined);
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
  const run = createPlaybackRun<ChartPlaybackMount>();
  // The rendered spec and layout (base, or base with legend state) and their playback.
  let current: {
    spec: ChartSpec;
    layout: ChartLayout;
    playback: ChartPlayback;
    hiddenKeys: Set<string>;
  } | null = null;
  let tooltips: PlaybackTooltips | null = null;

  const playhead = run.playhead;
  const currentPlayback = () => current?.playback ?? null;
  const refreshTooltips = onNearestPeriodChange(() => tooltips?.refresh());

  function teardown() {
    run.teardown();
    current = null;
  }

  function hiddenKeysFor(layout: ChartLayout, spec: ChartSpec, playback: ChartPlayback) {
    return hiddenSeriesKeys(playback.base, spec, compiler.hiddenSeriesFor(layout));
  }

  /** Start a run from scratch, keeping the controller (and its speed) when one exists. */
  function restart(args: PlaybackRenderArgs, next: NonNullable<typeof current>) {
    const { spec, playback } = next;
    current = next;
    run.restart((replacing) =>
      mountChartPlayback({
        container,
        svg: args.svg,
        playback,
        darkMode: args.darkMode,
        animate: spec.animation !== false && !editing,
        initialState: replacing ? resetPlayhead(playback) : undefined,
        onFrame: refreshTooltips,
      }),
    );
  }

  return {
    get controller() {
      return run.controller;
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
      const { mounted } = run;
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
      if (!current || !run.mounted) return null;
      const other = compiled && compiler.playbackFor(compiled);
      if (!compiled || !other) {
        return layoutAtPlayhead(current.playback, playhead(), current.layout, current.hiddenKeys);
      }
      const hiddenKeys = hiddenKeysFor(compiled, current.spec, other);
      return layoutAtPlayhead(other, playhead(), compiled, hiddenKeys);
    },
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
      run.mounted?.controller.pause();
    },
    destroy() {
      tooltips?.dispose();
      tooltips = null;
      teardown();
      compiler.clear();
    },
  };
}
