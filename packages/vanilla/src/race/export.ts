/**
 * Race GIF export: the shared playback GIF export with the race's fixed settings
 * (one device pixel per CSS pixel, a 1.5 s end hold, `.oc-race-*` styles, series
 * colors reserved in the palette).
 */
import type { RaceLayout } from '@opendata-ai/openchart-core';
import type { GIFExportOptions } from '../export-gif';
import { exportPlaybackGIF } from '../playback/export-gif';
import type { RaceShell } from './shell';

interface RaceExportView {
  layout: RaceLayout;
  shell: Pick<RaceShell, 'svg'>;
  mountExportRenderer(svg: SVGSVGElement): { draw(t: number): void; destroy(): void };
  signal?: AbortSignal;
}

const END_HOLD_MS = 1500;
const RACE_DPI = 1;
const RACE_STYLE_SELECTORS = ['.oc-race-mark'];

/**
 * Render the mounted bar or line layout from the first period through the end hold.
 * @throws {Error} If the layout is a table, or the encoder is missing or fails.
 * @throws {RangeError} If fps is not finite and positive, or the duration exceeds GIF limits.
 * @throws The signal's reason when the export is aborted.
 */
export async function exportRaceGIF(
  { layout, shell, mountExportRenderer, signal }: RaceExportView,
  options?: Pick<GIFExportOptions, 'fps'>,
): Promise<Blob> {
  if (layout.mark === 'table') throw new Error('GIF export supports the bar and line marks');
  let renderer: ReturnType<RaceExportView['mountExportRenderer']> | undefined;
  return exportPlaybackGIF(
    {
      svg: shell.svg,
      periodCount: layout.periods.length,
      draw(t, frame) {
        renderer ??= mountExportRenderer(frame);
        renderer.draw(t);
      },
      durationMs: layout.playback.durationMs,
      holdEndMs: END_HOLD_MS,
      styleSelectors: RACE_STYLE_SELECTORS,
      paletteSeed: layout.colors,
      noun: 'race',
      signal,
    },
    { fps: options?.fps, dpi: RACE_DPI, loop: layout.playback.loop, theme: layout.theme },
  );
}
