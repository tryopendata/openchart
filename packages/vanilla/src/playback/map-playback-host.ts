/**
 * A geo or tile map mount's side of playback: compiling the run, one session carried across
 * re-renders and updates, a controller whose identity survives a restart, playhead-aware
 * tooltip lookups, and the current frame for exports.
 */
import type { CompileOptions, TooltipContent } from '@opendata-ai/openchart-core';
import { type ChartPlayback, hasMapTimeEncoding } from '@opendata-ai/openchart-engine';
import type { GIFExportOptions } from '../export-gif';
import { carriedPlayhead, resetPlayhead } from './chart-update';
import { type ControllerRelay, createControllerRelay } from './controller-relay';
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';
import { exportPlaybackGIF } from './export-gif';
import { createMapFrameWriter, type MapFrameWriter } from './map-frames';
import { type AnyMapPlayback, type MapPlaybackMount, mountMapPlayback } from './map-session';
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
  /** Pause playback, e.g. when a gesture starts. */
  pause(): void;
  destroy(): void;
}

const MAX_PALETTE_SEED = 224;

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

/** Every fill a run paints, so the GIF palette keeps the class colors exact. */
function paletteSeed(playback: AnyMapPlayback): string[] {
  const colors = new Set<string>();
  for (let period = 0; period < playback.periods.length; period += 1) {
    for (const frame of playback.fillsAt(period)) colors.add(frame.fill);
    for (const frame of playback.pointsAt(period)) colors.add(frame.fill);
  }
  return [...colors].filter((color) => !color.startsWith('url(')).slice(0, MAX_PALETTE_SEED);
}

// carriedPlayhead and resetPlayhead read only `periods` and `timing`, which every playback has.
const asChartPlayback = (playback: AnyMapPlayback) => playback as unknown as ChartPlayback;

/** Create the playback host for one map mount. */
export function createMapPlaybackHost<Spec, Layout extends TooltipLayout>(
  container: HTMLElement,
  adapter: MapPlaybackAdapter<Spec, Layout>,
): MapPlaybackHost<Spec, Layout> {
  const compiled = new WeakMap<object, AnyMapPlayback>();
  let mounted: MapPlaybackMount | null = null;
  let relay: ControllerRelay | null = null;
  let current: { shape: string; playback: AnyMapPlayback } | null = null;

  const playhead = () => mounted?.controller.getState().t ?? 0;

  function teardown() {
    mounted?.destroy();
    mounted = null;
    relay?.release();
    relay = null;
    current = null;
  }

  /** Start a run from scratch, keeping the controller (and its speed) when one exists. */
  function restart(args: MapPlaybackRenderArgs<Spec, Layout>, playback: AnyMapPlayback) {
    const speed = relay?.controller.getState().speed;
    mounted?.destroy();
    mounted = mountMapPlayback({
      container,
      svg: args.svg,
      playback,
      darkMode: args.darkMode,
      animate: (args.spec as { animation?: unknown }).animation !== false,
      initialState: relay ? resetPlayhead(asChartPlayback(playback)) : undefined,
    });
    if (speed !== undefined && speed !== 1) mounted.controller.setSpeed(speed);
    if (relay) relay.follow(mounted.controller);
    else relay = createControllerRelay(mounted.controller);
  }

  return {
    get controller() {
      return relay?.controller ?? null;
    },
    stripHeight(spec) {
      if (!hasMapTimeEncoding(spec)) return 0;
      const block = (spec as { playback?: { controls?: boolean } }).playback;
      return block?.controls === false ? 0 : PLAYBACK_CONTROLS_HEIGHT;
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
      if (!mounted || !current || current.shape !== shape) {
        current = { shape, playback };
        restart(args, playback);
        return;
      }
      const prev = asChartPlayback(current.playback);
      const t = carriedPlayhead(prev, asChartPlayback(playback), playhead());
      current = { shape, playback };
      mounted.rebind({ svg: args.svg, playback, darkMode: args.darkMode, t });
    },
    drawFrame(svg) {
      if (!current || !mounted) return;
      const writer = createMapFrameWriter(svg, current.playback);
      writer.draw(playhead());
      writer.destroy();
    },
    exportGIF(svg, options) {
      if (!current) return null;
      const { playback } = current;
      let writer: MapFrameWriter | null = null;
      return exportPlaybackGIF(
        {
          svg,
          periodCount: playback.periods.length,
          draw(t, frame) {
            writer ??= createMapFrameWriter(frame, playback);
            writer.draw(t);
          },
          durationMs: playback.timing.durationMs,
          holdEndMs: playback.timing.holdEndMs,
          styleSelectors: adapter.styleSelectors,
          paletteSeed: paletteSeed(playback),
          noun: 'playback',
        },
        options,
      );
    },
    pause() {
      mounted?.controller.pause();
    },
    destroy: teardown,
  };
}
