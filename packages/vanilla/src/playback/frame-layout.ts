/**
 * The chart layout a playback chart shows at a playhead, for `chart.layout`,
 * `sampleLayout()` and exports: the frame's marks and overlays as the reader sees them.
 */
import type { ChartLayout, Mark } from '@opendata-ai/openchart-core';
import {
  type ChartPlayback,
  type FrameMark,
  playbackLabelPointKey,
  trailColorsByKey,
  trailMarks,
} from '@opendata-ai/openchart-engine';

/** Whether `key` is hidden: listed in `hiddenKeys`, or a name label for a hidden point. */
function isHidden(key: string, hiddenKeys: ReadonlySet<string>): boolean {
  if (hiddenKeys.has(key)) return true;
  const pointKey = playbackLabelPointKey(key);
  return pointKey !== null && hiddenKeys.has(pointKey);
}

/**
 * The frame mark as drawn: faded by its presence, or null when it isn't drawn at all. Text
 * marks have no fill opacity to fade, so a fading name label is drawn whole.
 */
function visibleMark({ mark, presence }: FrameMark): Mark | null {
  if (presence <= 0) return null;
  if (presence >= 1 || (mark.type !== 'point' && mark.type !== 'rect')) return mark;
  return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
}

/** The playback's trails at `t`, minus hidden keys, as the engine's decorative trail marks. */
function visibleTrailMarks(
  playback: ChartPlayback,
  t: number,
  base: ChartLayout,
  hiddenKeys: ReadonlySet<string>,
): Mark[] {
  const trails = playback.trailsAt(t).filter((trail) => !hiddenKeys.has(trail.key));
  return trailMarks(trails, trailColorsByKey(base));
}

/**
 * The rendered layout (the playback's base, or a copy of it with legend state) with each
 * keyed mark and overlay replaced by its frame mark at `t`: the period label reads the
 * period at `t` and name labels sit beside their points at `t`. Keys absent at `t`
 * (presence 0), keys in `hiddenKeys` and the name labels of hidden keys are dropped; fading
 * points and bars carry their presence in `fillOpacity`. Marks the frame doesn't name keep
 * their base geometry. Trails at `t` come first, under the marks.
 */
export function layoutAtPlayhead(
  playback: ChartPlayback,
  t: number,
  base: ChartLayout = playback.base,
  hiddenKeys: ReadonlySet<string> = new Set(),
): ChartLayout {
  const frameMarks = new Map<string, Mark | null>();
  for (const frameMark of [...playback.marksAt(t), ...playback.overlaysAt(t)]) {
    frameMarks.set(frameMark.key, visibleMark(frameMark));
  }
  const marks: Mark[] = visibleTrailMarks(playback, t, base, hiddenKeys);
  for (const mark of base.marks) {
    const key = mark.key === undefined ? undefined : String(mark.key);
    if (key === undefined) {
      marks.push(mark);
      continue;
    }
    if (isHidden(key, hiddenKeys)) continue;
    const drawn = frameMarks.has(key) ? frameMarks.get(key) : mark;
    if (drawn) marks.push(drawn);
  }
  return { ...base, marks };
}
