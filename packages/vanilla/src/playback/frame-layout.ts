/**
 * The chart layout a playback chart shows at a playhead, for `chart.layout`,
 * `sampleLayout()` and exports: the frame's marks as the reader sees them.
 */
import type { ChartLayout, LineMark, Mark } from '@opendata-ai/openchart-core';
import type { ChartPlayback, FrameMark } from '@opendata-ai/openchart-engine';

/** Matches the live trail stroke in chart-trails.ts. */
const TRAIL_STROKE_WIDTH = 1.5;
const TRAIL_OPACITY = 0.45;

/** The frame mark as drawn: faded by its presence, or null when it isn't drawn at all. */
function visibleMark({ mark, presence }: FrameMark): Mark | null {
  if (presence <= 0) return null;
  if (presence >= 1 || (mark.type !== 'point' && mark.type !== 'rect')) return mark;
  return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
}

function markColor(mark: Mark | undefined): string {
  if (mark?.type === 'point' && typeof mark.fill === 'string') return mark.fill;
  return 'currentColor';
}

/** The playback's trails at `t` as decorative line marks, so exports and readers carry them. */
function trailMarks(
  playback: ChartPlayback,
  t: number,
  base: ChartLayout,
  hiddenKeys: ReadonlySet<string>,
): LineMark[] {
  const byKey = new Map(base.marks.map((mark) => [String(mark.key), mark]));
  return playback
    .trailsAt(t)
    .filter((trail) => !hiddenKeys.has(trail.key))
    .map((trail) => ({
      type: 'line',
      key: `oc-playback-trail|${trail.key}`,
      points: [...trail.points, trail.head],
      stroke: markColor(byKey.get(trail.key)),
      strokeWidth: TRAIL_STROKE_WIDTH,
      opacity: TRAIL_OPACITY,
      data: [],
      aria: { decorative: true },
    }));
}

/**
 * The rendered layout (the playback's base, or a copy of it with legend state) with each
 * keyed mark replaced by its frame mark at `t`. Keys absent at `t` (presence 0) and keys in
 * `hiddenKeys` are dropped; fading keys carry their presence in `fillOpacity`. Marks the
 * frame doesn't name keep their base geometry. Trails at `t` come first, under the marks.
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
  const marks: Mark[] = [...trailMarks(playback, t, base, hiddenKeys)];
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
