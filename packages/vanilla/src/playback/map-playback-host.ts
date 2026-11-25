/**
 * A geo or tile map mount's side of playback: compiling the run, one session carried across
 * re-renders and updates, a controller whose identity survives a restart, playhead-aware
 * tooltip lookups, and the current frame for exports.
 */
import type { CompileOptions, TooltipContent } from '@opendata-ai/openchart-core';
import { hasMapTimeEncoding } from '@opendata-ai/openchart-engine';
import type { GIFExportOptions } from '../export-gif';
import { carriedPlayhead, resetPlayhead } from './chart-update';
import { exportPlaybackGIF, playbackGIFTiming } from './export-gif';
import { createMapFrameWriter, type MapFrameWriter } from './map-frames';
import { type AnyMapPlayback, type MapPlaybackMount, mountMapPlayback } from './map-session';
import { createPlaybackRun, onNearestPeriodChange } from './playback-run';
import { stripHeight } from './strip';
import type { PlaybackController } from './types';

/** The layout fields the host reads and replaces. */
interface TooltipLayout {
  tooltipDescriptors: Map<string, TooltipContent>;
}

/** How one kind of map compiles a run and decides when an update starts it over. */
export interface MapPlaybackAdapter<Spec, Layout extends TooltipLayout> {
  /** Compile the run (validating the spec). */
  compilePlayback(spec: Spec, options: CompileOptions): AnyMapPlayback & { base: Layout };
  /** Fields whose change starts the run over (time field and type, identity). */
  shapeOf(spec: Spec): unknown[];
  /** Class selectors whose computed styles the GIF clone keeps, e.g. `.oc-map-feature`. */
  styleSelectors: string[];
}

/** What `render()` hands the host after building the SVG. */
export interface MapPlaybackRenderArgs<Spec, Layout> {
  svg: SVGSVGElement;
  /** The layout the SVG was built from: the host's compile for a time spec. */
  layout: Layout;
  spec: Spec;
  darkMode: boolean;
}

/** One map mount's playback, null-safe for specs without time. */
export interface MapPlaybackHost<Spec, Layout> {
  /** The controller, or null without time. The same object across updates until time goes. */
  readonly controller: PlaybackController | null;
  /** Height the controls strip takes below the SVG: 0 without time or with controls off. */
  stripHeight(spec: Spec): number;
  /** Whether `spec` plays over time. */
  isPlaybackSpec(spec: Spec): boolean;
  /**
   * The base layout for a time spec, its tooltip lookups reading the playhead.
   *
   * @throws The spec validation error, or a RangeError for an overflowing `playback.step`.
   */
  compile(spec: Spec, options: CompileOptions): Layout;
  /** Bind playback to a freshly rendered SVG, or tear it down when the layout has none. */
  render(args: MapPlaybackRenderArgs<Spec, Layout>): void;
  /** Write the frame on screen onto `svg`, a fresh render of the current layout. */
  drawFrame(svg: SVGElement): void;
  /**
   * The run as a frame-stepped GIF captured from `svg`, or null without playback.
   *
   * @throws {Error} When the encoder is missing or fails (as a rejection).
   */
  exportGIF(svg: SVGSVGElement, options?: GIFExportOptions): Promise<Blob> | null;
  destroy(): void;
}

/** What the mount hears from its playback host. */
export interface MapPlaybackHostOptions {
  /**
   * Called while playing whenever the nearest period changes, e.g. to refresh an open
   * tooltip, which reads that period's values.
   */
  onPeriodChange?(): void;
}

/** Tooltip lookups that prefer the playback's values at the playhead. */
class PlayheadTooltips extends Map<string, TooltipContent> {
  readonly #read: (key: string) => TooltipContent | undefined;

  constructor(
    base: Map<string, TooltipContent>,
    read: (key: string) => TooltipContent | undefined,
  ) {
    super(base);
    this.#read = read;
  }

  override get(key: string): TooltipContent | undefined {
    return this.#read(key) ?? super.get(key);
  }
}

/** Create the playback host for one map mount. */
export function createMapPlaybackHost<Spec, Layout extends TooltipLayout>(
  container: HTMLElement,
  adapter: MapPlaybackAdapter<Spec, Layout>,
  options: MapPlaybackHostOptions = {},
): MapPlaybackHost<Spec, Layout> {
  const compiled = new WeakMap<object, AnyMapPlayback>();
  const run = createPlaybackRun<MapPlaybackMount>();
  let current: { shape: string; playback: AnyMapPlayback } | null = null;
  const playhead = run.playhead;
  const announcePeriod = onNearestPeriodChange(() => options.onPeriodChange?.());

  function teardown() {
    run.teardown();
    current = null;
  }

  /** Start a run from scratch, keeping the controller (and its speed) when one exists. */
  function restart(args: MapPlaybackRenderArgs<Spec, Layout>, playback: AnyMapPlayback) {
    run.restart((replacing) =>
      mountMapPlayback({
        container,
        svg: args.svg,
        playback,
        darkMode: args.darkMode,
        animate: (args.spec as { animation?: unknown }).animation !== false,
        initialState: replacing ? resetPlayhead(playback) : undefined,
        onFrame: announcePeriod,
      }),
    );
  }

  return {
    get controller() {
      return run.controller;
    },
    stripHeight(spec) {
      return stripHeight(hasMapTimeEncoding(spec), (spec as { playback?: unknown }).playback);
    },
    isPlaybackSpec: (spec) => hasMapTimeEncoding(spec),
    compile(spec, options) {
      const playback = adapter.compilePlayback(spec, options);
      const layout: Layout = {
        ...playback.base,
        tooltipDescriptors: new PlayheadTooltips(playback.base.tooltipDescriptors, (key) =>
          compiled.get(layout) === current?.playback
            ? playback.tooltipAt(key, playhead())
            : undefined,
        ),
      };
      compiled.set(layout, playback);
      return layout;
    },
    render(args) {
      const playback = compiled.get(args.layout as object);
      if (!playback) {
        teardown();
        return;
      }
      const shape = JSON.stringify(adapter.shapeOf(args.spec));
      const { mounted } = run;
      if (!mounted || !current || current.shape !== shape) {
        current = { shape, playback };
        restart(args, playback);
        return;
      }
      const t = carriedPlayhead(current.playback, playback, playhead());
      current = { shape, playback };
      mounted.rebind({ svg: args.svg, playback, darkMode: args.darkMode, t });
    },
    drawFrame(svg) {
      if (!current || !run.mounted) return;
      const writer = createMapFrameWriter(svg, current.playback);
      writer.draw(playhead());
      writer.destroy();
    },
    exportGIF(svg, options) {
      if (!current) return null;
      const { playback } = current;
      const { durationMs, holdEndMs, loop } = playbackGIFTiming(playback.timing, options);
      let writer: MapFrameWriter | null = null;
      return exportPlaybackGIF(
        {
          svg,
          periodCount: playback.periods.length,
          draw(t, frame) {
            writer ??= createMapFrameWriter(frame, playback);
            writer.draw(t);
          },
          durationMs,
          holdEndMs,
          styleSelectors: adapter.styleSelectors,
          paletteSeed: playback.paletteColors(),
          noun: 'playback',
        },
        { ...options, loop },
      );
    },
    destroy: teardown,
  };
}
