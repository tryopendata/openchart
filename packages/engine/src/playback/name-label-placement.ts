/**
 * Per-frame placement of the name labels `playback.labels` draws: each label takes its
 * run-long side unless that would cover a label already placed in the frame or leave the
 * plot, in which case it moves to the first side that is clear.
 */
import type { Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import {
  labelPlaybackPoint,
  type PlaybackLabelSide,
  playbackLabelGeometry,
} from '../charts/scatter/playback-labels';
import type { FrameMark } from './chart-types';

/** Sides tried after a label's run-long side, in order. */
const FALLBACK_SIDES: PlaybackLabelSide[] = ['right', 'left', 'above', 'below'];

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Slack for float error when a nudged label sits exactly on the plot edge, in px. */
const EDGE_TOLERANCE = 0.01;

function inside(box: Rect, area: Rect): boolean {
  return (
    box.x >= area.x - EDGE_TOLERANCE &&
    box.y >= area.y - EDGE_TOLERANCE &&
    box.x + box.width <= area.x + area.width + EDGE_TOLERANCE &&
    box.y + box.height <= area.y + area.height + EDGE_TOLERANCE
  );
}

/** What placing a frame's name labels needs, fixed for the run. */
export interface NameLabelPlan {
  /** The run-long side of each labelled point key. */
  labelSides: ReadonlyMap<string, PlaybackLabelSide>;
  theme: ResolvedTheme;
  /** The plot area labels stay inside. */
  area: Rect;
}

/**
 * A name label for each labelled point in `marks`, sharing its presence. Labels are placed
 * in `marks` order (the base order, so the same at every frame): each takes its run-long
 * side (already kept inside the plot's width for the run) when that box is clear of the
 * labels already placed, else the first of right, left, above and below that stays inside
 * the plot and is clear (above and below nudged sideways to stay in the plot), else its
 * run-long side anyway. Building every candidate per label keeps
 * this a few text estimates per labelled point per frame. Pure
 * in `marks`, so the static compile and the live frames place labels alike.
 */
export function placeNameLabels(plan: NameLabelPlan, marks: FrameMark[]): FrameMark[] {
  const placed: Rect[] = [];
  const labels: FrameMark[] = [];
  for (const { key, mark, presence } of marks) {
    const preferred = plan.labelSides.get(key);
    if (mark.type !== 'point' || preferred === undefined) continue;
    const candidates = [preferred, ...FALLBACK_SIDES.filter((side) => side !== preferred)].map(
      (side) => playbackLabelGeometry(mark, key, plan.theme, side, plan.area),
    );
    const clear = ({ box }: { box: Rect }) => !placed.some((other) => overlaps(box, other));
    const [runSide, ...alternatives] = candidates;
    const geometry = clear(runSide)
      ? runSide
      : (alternatives.find((candidate) => inside(candidate.box, plan.area) && clear(candidate)) ??
        runSide);
    placed.push(geometry.box);
    const label = labelPlaybackPoint(mark, key, plan.theme, geometry);
    labels.push({ key: String(label.key), mark: label, presence });
  }
  return labels;
}
