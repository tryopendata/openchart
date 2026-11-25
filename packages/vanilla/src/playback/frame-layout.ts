/**
 * The chart layout a playback chart shows at a playhead, for `chart.layout`,
 * `sampleLayout()` and exports: the frame's marks as the reader sees them.
 */
import type { ChartLayout, Mark } from '@opendata-ai/openchart-core';
import type { ChartPlayback, FrameMark } from '@opendata-ai/openchart-engine';

/** The frame mark as drawn: faded by its presence, or null when it isn't drawn at all. */
function visibleMark({ mark, presence }: FrameMark): Mark | null {
  if (presence <= 0) return null;
  if (presence >= 1 || (mark.type !== 'point' && mark.type !== 'rect')) return mark;
  return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
}

/**
 * The rendered layout (the playback's base, or a copy of it with legend state) with each
 * keyed mark replaced by its frame mark at `t`. Keys absent at `t` (presence 0) and keys in
 * `hiddenKeys` are dropped; fading keys carry their presence in `fillOpacity`. Marks the
 * frame doesn't name keep their base geometry.
 */
export function layoutAtPlayhead(
  playback: ChartPlayback,
  t: number,
  base: ChartLayout = playback.base,
  hiddenKeys: ReadonlySet<string> = new Set(),
): ChartLayout {
  const frameMarks = new Map<string, Mark | null>();
  for (const frameMark of playback.marksAt(t)) {
    frameMarks.set(frameMark.key, visibleMark(frameMark));
  }
  const marks: Mark[] = [];
  for (const mark of base.marks) {
    const key = mark.key === undefined ? undefined : String(mark.key);
    if (key === undefined) {
      marks.push(mark);
      continue;
    }
    if (hiddenKeys.has(key)) continue;
    const drawn = frameMarks.has(key) ? frameMarks.get(key) : mark;
    if (drawn) marks.push(drawn);
  }
  return { ...base, marks };
}
