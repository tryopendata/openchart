/**
 * Playback trails as layout marks: the one description of how a trail looks (a thin line
 * through the key's observed positions to its head, a small dot at each observed position,
 * in the key's color, faded) shared by the static compile, exports and the live writer.
 */
import type { ChartLayout, LineMark, Mark, PointMark } from '@opendata-ai/openchart-core';
import type { TrailPath } from './chart-types';

/** How every trail is drawn, live and static. */
export const TRAIL_STYLE = {
  strokeWidth: 1.5,
  /** Applied to the line and to each dot's fill. */
  opacity: 0.45,
  dotRadius: 2,
} as const;

/**
 * Key prefix of every trail mark. It sits under the `oc-playback-` prefix the stylesheet
 * makes click-through, so trails never take pointer events from the marks.
 */
export const TRAIL_KEY_PREFIX = 'oc-playback-trail';

/** Fallback when a key has no plain fill color to borrow. */
const TRAIL_FALLBACK_COLOR = 'currentColor';

/** The trail line's key for a mark key. */
export function trailLineKey(key: string): string {
  return `${TRAIL_KEY_PREFIX}|${key}`;
}

/** The key of the dot at observed position `index` of a key's trail. */
export function trailDotKey(key: string, index: number): string {
  return `${TRAIL_KEY_PREFIX}-dot|${key}|${index}`;
}

/** The points the trail line passes through: every observed position, then the head. */
export function trailLinePoints(trail: TrailPath): TrailPath['points'] {
  return [...trail.points, trail.head];
}

/** Each keyed point's plain fill, the color its trail borrows. */
export function trailColorsByKey(base: ChartLayout): Map<string, string> {
  const colors = new Map<string, string>();
  for (const mark of base.marks) {
    if (mark.type !== 'point' || mark.key === undefined || typeof mark.fill !== 'string') continue;
    colors.set(String(mark.key), mark.fill);
  }
  return colors;
}

function trailLine(trail: TrailPath, color: string): LineMark {
  return {
    type: 'line',
    key: trailLineKey(trail.key),
    points: trailLinePoints(trail),
    stroke: color,
    strokeWidth: TRAIL_STYLE.strokeWidth,
    opacity: TRAIL_STYLE.opacity,
    data: [],
    aria: { decorative: true },
  };
}

function trailDots(trail: TrailPath, color: string): PointMark[] {
  return trail.points.map((point, index) => ({
    type: 'point',
    key: trailDotKey(trail.key, index),
    cx: point.x,
    cy: point.y,
    r: TRAIL_STYLE.dotRadius,
    fill: color,
    fillOpacity: TRAIL_STYLE.opacity,
    stroke: 'none',
    strokeWidth: 0,
    data: {},
    aria: { decorative: true },
  }));
}

/**
 * Decorative marks drawing `trails`: per trail, its line and then one dot per observed
 * position, colored by the key's entry in `colors`. Paint them before the data marks so
 * trails sit underneath.
 */
export function trailMarks(trails: readonly TrailPath[], colors: Map<string, string>): Mark[] {
  return trails.flatMap((trail) => {
    const color = colors.get(trail.key) ?? TRAIL_FALLBACK_COLOR;
    return [trailLine(trail, color), ...trailDots(trail, color)];
  });
}

/** Whether a mark is part of a trail. */
export function isTrailMark(mark: Mark): boolean {
  return mark.key !== undefined && String(mark.key).startsWith(TRAIL_KEY_PREFIX);
}
