/**
 * Playback GIF export for a time-encoded chart: the shared frame-stepped export, drawing
 * each sampled playhead with the same frame and trail writers the live chart uses.
 */
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import type { GIFExportOptions } from '../export-gif';
import { createChartWriters } from './chart-session';
import { exportPlaybackGIF } from './export-gif';
import { applySeriesHiding } from './series-hiding';

/** The chart scene a playback GIF is captured from. */
export interface ChartPlaybackGIFView {
  /**
   * A settled SVG rendered from the playback's base layout (every keyed mark present),
   * with its theme already prepared. It is cloned once; frames are drawn on the clone.
   */
  svg: SVGSVGElement;
  playback: ChartPlayback;
  /** Keys hidden by legend toggles; their marks, labels and trails stay hidden in every frame. */
  hiddenKeys: ReadonlySet<string>;
}

/**
 * Render the chart's playback from the first period through the end hold as a GIF. Run
 * length, end hold and loop come from the resolved playback timing; `durationMs` and `loop`
 * in `options` override them. `fps`, `dpi`, `embedFonts`, `backgroundColor` and `theme`
 * apply as for any playback GIF.
 * @throws {RangeError} If the playback has no periods, fps is not finite and positive, or
 * the duration exceeds GIF limits.
 * @throws {Error} If gifenc is missing or fails to load, or the SVG has zero dimensions.
 */
export function exportChartPlaybackGIF(
  { svg, playback, hiddenKeys }: ChartPlaybackGIFView,
  options?: GIFExportOptions,
): Promise<Blob> {
  const { timing } = playback;
  let drawFrame: ((t: number) => void) | undefined;
  return exportPlaybackGIF(
    {
      svg,
      periodCount: playback.periods.length,
      draw(t, frame) {
        drawFrame ??= bindFrame(frame, playback, hiddenKeys);
        drawFrame(t);
      },
      durationMs: options?.durationMs ?? timing.durationMs,
      holdEndMs: timing.holdEndMs,
      // Chart marks carry their paint as attributes and chrome is covered by the theme block.
      styleSelectors: [],
      paletteSeed: paletteSeed(playback),
    },
    {
      fps: options?.fps,
      dpi: options?.dpi,
      loop: options?.loop ?? timing.loop,
      embedFonts: options?.embedFonts,
      backgroundColor: options?.backgroundColor,
      theme: options?.theme,
    },
  );
}

/** Bind the live writers to the cloned frame and hide the hidden keys, returning the drawer. */
function bindFrame(
  frame: SVGSVGElement,
  playback: ChartPlayback,
  hiddenKeys: ReadonlySet<string>,
): (t: number) => void {
  const writers = createChartWriters(frame, playback);
  applySeriesHiding(frame, hiddenKeys);
  return (t) => writers.draw(t);
}

/** The distinct point fills of the base layout, reserved so series colors survive quantization. */
function paletteSeed(playback: ChartPlayback): string[] {
  const fills = new Set<string>();
  for (const mark of playback.base.marks) {
    if (mark.type === 'point' && typeof mark.fill === 'string') fills.add(mark.fill);
  }
  return [...fills];
}
