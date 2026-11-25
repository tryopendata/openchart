/** Writes a playback chart's frames onto the SVG built from its base layout. */
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/** Draws frames onto one rendered SVG. */
export interface ChartFrameWriter {
  /** Write `playback.marksAt(t)` onto the base elements. */
  draw(t: number): void;
  /** Drop element references. Leaves the SVG as last drawn. */
  destroy(): void;
}

/**
 * Bind to the `[data-key]` mark elements of `svg` and write each frame's geometry (cx, cy,
 * r for points; x, y, width, height for rects) and opacity (`presence` times the mark's own
 * opacity) by key. Keys with no element are ignored, and elements without `data-key` are
 * never touched; matching never uses array position or `data-mark-id`.
 */
export function createChartFrameWriter(svg: SVGElement, playback: ChartPlayback): ChartFrameWriter {
  void svg;
  void playback;
  throw new Error('not implemented');
}
