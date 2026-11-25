import type { GIFExportOptions } from '../export-gif';

/** A mounted playback view to capture frame by frame. */
export interface PlaybackGIFSource {
  /** The live SVG. It is cloned once; frames are drawn onto the clone. */
  svg: SVGSVGElement;
  /** Number of periods; frames sample t in [0, periodCount - 1]. */
  periodCount: number;
  /** Draw the playhead `t` (continuous period index) onto `frame`, the cloned SVG. */
  draw(t: number, frame: SVGSVGElement): void;
  /** Run length at 1×, sampled at `fps`. */
  durationMs: number;
  /** Delay of the settled final frame. */
  holdEndMs: number;
  /** Class selectors whose computed text and paint styles are snapshotted into the clone, e.g. `.oc-race-mark`. */
  styleSelectors: string[];
  /** Colors reserved in the global palette so series colors survive quantization. */
  paletteSeed: readonly string[];
  /** Rejects the export when aborted. */
  signal?: AbortSignal;
}

/** Options playback export honors. `dpi` defaults to 2 and `fps` to 25, as for chart GIFs. */
export type PlaybackGIFOptions = Pick<
  GIFExportOptions,
  'fps' | 'dpi' | 'loop' | 'embedFonts' | 'backgroundColor' | 'theme'
>;

/**
 * Render the run from the first period through the end hold as a GIF. Frames sample
 * `durationMs` at `fps`; the settled final frame carries `holdEndMs`. A given theme is
 * inlined as a style block.
 * @throws {RangeError} If fps is not finite and positive, or the duration exceeds GIF limits.
 */
export function exportPlaybackGIF(
  source: PlaybackGIFSource,
  options?: PlaybackGIFOptions,
): Promise<Blob> {
  void source;
  void options;
  return Promise.reject(new Error('not implemented'));
}
