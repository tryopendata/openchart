/** Tooltip content for a mark on a playback chart. */
import type { TooltipContent } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/**
 * The hovered key's observed values at the period nearest `t`, titled with the key and that
 * period's label, never interpolated numbers. Each field is labelled with the title of the
 * encoding channel that reads it (`playback.frame.spec.encoding`), else the field name. A
 * gap-filled period says it was estimated.
 * Returns content with no fields when the key has no values near `t`.
 */
export function playbackTooltip(playback: ChartPlayback, key: string, t: number): TooltipContent {
  void playback;
  void key;
  void t;
  throw new Error('not implemented');
}
