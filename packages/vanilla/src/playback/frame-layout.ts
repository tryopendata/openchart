/** The chart layout a playback chart shows at a playhead, for readers of `chart.layout`. */
import type { ChartLayout, Mark } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/**
 * The base layout with each keyed mark replaced by its frame mark at `t`. Marks the frame
 * doesn't name keep their base geometry.
 */
export function layoutAtPlayhead(playback: ChartPlayback, t: number): ChartLayout {
  const frameMarks = new Map<string, Mark>();
  for (const { key, mark } of playback.marksAt(t)) frameMarks.set(key, mark);
  const { base } = playback;
  return {
    ...base,
    marks: base.marks.map((mark) =>
      mark.key === undefined ? mark : (frameMarks.get(String(mark.key)) ?? mark),
    ),
  };
}
