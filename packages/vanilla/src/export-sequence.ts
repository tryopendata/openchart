/**
 * Multi-spec ("keyframe") GIF export.
 *
 * The single-chart GIF export (`exportGIF`) reproduces ONE chart's entrance
 * animation. Some charts animate a different way: a component swaps in a whole
 * new spec on a timer (e.g. a year-by-year stepper), and the on-screen chart
 * tweens between them via `chart.update()` (bars grow/shrink smoothly). The DATA
 * changes across frames, and the motion is the update transition — neither of
 * which `exportGIF` can express.
 *
 * `exportSpecSequence` reproduces that. It mounts one offscreen chart, holds the
 * first spec, then walks the rest by driving `chart.beginManualUpdate(spec)` and
 * stepping the returned transition frame-by-frame (no rAF clock), rasterizing
 * each step. Between transitions it holds the settled frame for `dwellMs`. The
 * result is the same bar tween the reader sees on screen, captured to GIF.
 *
 * `gifenc` is an optional peer dependency, loaded dynamically.
 */

import type { ChartSpec, LayerSpec, ResolvedTheme, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  embedFonts,
  ensureSVGDimensions,
  exportSVG,
  getSVGBackgroundColor,
  getSVGDimensions,
  rasterizeSVGToCanvas,
} from './export';
import { isModuleNotFound, resolveRepeat } from './export-gif';
import { paletteFromCanvas, readCanvasSRGB } from './gif-encode';
import { createChart } from './mount';
import { injectThemeStyleBlock } from './theme-style-block';

export interface SpecSequenceOptions {
  /** DPI scaling factor, matching PNG export. Defaults to 2. */
  dpi?: number;
  /** Frames per second for the tween between specs. Defaults to 25. */
  fps?: number;
  /** How long to hold each spec's settled frame, in ms. Defaults to 1200 (the common stepper cadence). */
  dwellMs?: number;
  /**
   * Loop behavior, same semantics as `exportGIF`:
   * - `false` / omitted: play once, then hold the final frame
   * - `true`: loop forever
   * - a number: loop that many times, then hold
   */
  loop?: boolean | number;
  /** Render width in CSS px. Required — pass the on-screen chart width so the export matches. */
  width: number;
  /** Render height in CSS px. Required — pass the on-screen chart height so the export matches. */
  height: number;
  /** Dark mode for the rendered charts. Defaults to 'off' (light). */
  darkMode?: 'auto' | 'force' | 'off';
  /**
   * Theme overrides applied when rendering, exactly as a consumer's live wrapper
   * would apply them. Pass the SAME theme your on-screen chart uses (e.g. the
   * blog's `blogChartTheme(isDark)`), or the export won't match — its background,
   * gridlines, and chrome colors fall back to openchart's raw defaults.
   */
  theme?: ThemeConfig;
  /** Embed fonts as base64 so text matches on-screen. Defaults to true. */
  embedFonts?: boolean;
  /** Opaque background fill. Defaults to the chart's own background (white if transparent). */
  backgroundColor?: string;
}

/**
 * Mount one live chart offscreen (used as the persistent host we step through
 * every spec). Entrance is disabled so the first spec renders settled; update
 * transitions are enabled so `beginManualUpdate` can tween between specs.
 */
function mountOffscreen(
  spec: ChartSpec | LayerSpec,
  width: number,
  height: number,
  darkMode: 'auto' | 'force' | 'off',
  themeConfig: ThemeConfig | undefined,
): {
  instance: ReturnType<typeof createChart>;
  svg: SVGElement;
  container: HTMLElement;
} {
  const container = document.createElement('div');
  // Offscreen but laid out, so text measurement (needs a live DOM) works.
  container.style.cssText = `position:absolute;left:-99999px;top:0;width:${width}px;height:${height}px;visibility:hidden;`;
  document.body.appendChild(container);

  // enter:false → first spec settled immediately; update:true → tween on
  // beginManualUpdate. responsive:false → no ResizeObserver on a detached node.
  const settledSpec = {
    ...(spec as unknown as Record<string, unknown>),
    animation: { enter: false, update: true },
  };
  const instance = createChart(container, settledSpec as ChartSpec | LayerSpec, {
    darkMode,
    theme: themeConfig,
    responsive: false,
  });

  const svg = container.querySelector('svg');
  if (!svg) {
    instance.destroy();
    container.remove();
    throw new Error('exportSpecSequence: chart produced no SVG');
  }
  return { instance, svg, container };
}

/**
 * Render an ordered list of specs to an animated GIF Blob. Holds the first spec,
 * then tweens to each subsequent spec (openchart's update transition, driven
 * frame-by-frame) and holds it — reproducing the on-screen bar grow/shrink.
 *
 * @param specs - Ordered specs, one per keyframe (e.g. one per year).
 * @param options - dpi, fps, dwell, loop, size (required), dark mode, theme, fonts.
 * @returns A Promise resolving to the GIF Blob.
 */
export async function exportSpecSequence(
  specs: Array<ChartSpec | LayerSpec>,
  options: SpecSequenceOptions,
): Promise<Blob> {
  if (specs.length === 0) {
    throw new Error('exportSpecSequence requires at least one spec');
  }

  let gifenc: typeof import('gifenc');
  try {
    gifenc = await import('gifenc');
  } catch (err) {
    if (isModuleNotFound(err)) {
      throw new Error(
        "GIF export requires the optional 'gifenc' peer dependency. Install it: npm install gifenc",
      );
    }
    throw new Error('GIF export failed to load the gifenc encoder', {
      cause: err,
    });
  }
  const { GIFEncoder, quantize, applyPalette } = gifenc;

  const dpi = options.dpi ?? 2;
  const fps = options.fps ?? 25;
  const dwellMs = options.dwellMs ?? 1200;
  const frameDelay = Math.round(1000 / fps);
  const { width, height } = options;
  const darkMode = options.darkMode ?? 'off';
  const themeConfig = options.theme;
  const shouldEmbed = options.embedFonts ?? true;
  const repeat = resolveRepeat(options.loop);

  const { instance, svg, container } = mountOffscreen(
    specs[0],
    width,
    height,
    darkMode,
    themeConfig,
  );

  try {
    const w = getSVGDimensions(svg).width || width;
    const h = getSVGDimensions(svg).height || height;
    const bgColor = options.backgroundColor ?? getSVGBackgroundColor(svg);
    const fillBackground = (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement): void => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cv.width, cv.height);
    };
    const theme = (): ResolvedTheme | undefined => {
      const layout = instance.layout;
      return layout && 'theme' in layout ? (layout.theme as ResolvedTheme) : undefined;
    };

    // `beginManualUpdate`/`render` REPLACES the live <svg> node each spec, so the
    // injected theme + @font-face blocks don't carry over. Re-inject them into
    // whatever <svg> is currently live. Fonts embed once per spec (not per frame
    // — embedding fetches font files, which across a tween would be far too slow).
    const prepareLiveSvg = async (): Promise<SVGElement> => {
      const live = container.querySelector('svg');
      if (!live) throw new Error('exportSpecSequence: live SVG vanished mid-sequence');
      injectThemeStyleBlock(live, theme());
      if (shouldEmbed) await embedFonts(live);
      return live;
    };

    // Rasterize the given live svg at its current (stepped) state.
    const grab = async (live: SVGElement): Promise<HTMLCanvasElement> => {
      const svgString = ensureSVGDimensions(exportSVG(live), w, h);
      return rasterizeSVGToCanvas(svgString, w, h, dpi, fillBackground);
    };

    // frames: each canvas with its hold duration. Hold the first spec, then for
    // each subsequent spec step its tween (frameDelay each) and hold the result.
    const frames: Array<{ canvas: HTMLCanvasElement; delayMs: number }> = [];
    let live = await prepareLiveSvg();
    frames.push({ canvas: await grab(live), delayMs: dwellMs });

    for (let i = 1; i < specs.length; i++) {
      // Re-apply the same settle/animation wrapper the offscreen mount used, so
      // update transitions stay enabled for each step.
      const nextSpec = {
        ...(specs[i] as unknown as Record<string, unknown>),
        animation: { enter: false, update: true },
      } as ChartSpec | LayerSpec;
      const handle = instance.beginManualUpdate(nextSpec);
      // render() replaced the <svg>; re-inject theme/fonts into the new one.
      live = await prepareLiveSvg();

      if (handle) {
        const totalMs = handle.totalMs;
        // Step across the tween at fps; capture each frame. Start one frame in
        // (t=0 is the previous held frame) and go through the final step.
        for (let t = frameDelay; t < totalMs; t += frameDelay) {
          handle.step(t);
          frames.push({ canvas: await grab(live), delayMs: frameDelay });
        }
        // Final settled frame of this spec, held for the dwell.
        handle.step(totalMs);
        handle.cancel();
      }
      frames.push({ canvas: await grab(live), delayMs: dwellMs });
    }

    // One global palette from the last frame — a full-color settled frame, and
    // stepper frames share a palette by construction.
    const globalPalette = paletteFromCanvas(frames[frames.length - 1].canvas, quantize);

    const gif = GIFEncoder();
    frames.forEach(({ canvas, delayMs }, i) => {
      const index = applyPalette(readCanvasSRGB(canvas), globalPalette);
      gif.writeFrame(index, canvas.width, canvas.height, {
        palette: globalPalette,
        delay: delayMs,
        // `repeat` writes the loop extension; only meaningful on the first frame.
        ...(i === 0 ? { repeat } : {}),
      });
    });

    gif.finish();
    return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
  } finally {
    instance.destroy();
    container.remove();
  }
}
