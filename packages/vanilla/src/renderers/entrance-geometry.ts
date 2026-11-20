/**
 * Entrance geometry read from the layout, never from the DOM: where each bar
 * and stack grows from, and when a line point is reached by its line's
 * drawing edge.
 *
 * The renderer stamps these as custom properties the generated entrance CSS
 * reads (`--oc-bar-from`, `--oc-stack-from`, `--oc-line-point-delay`), so GIF
 * export and cleanup read the same numbers back from the SVG.
 */

import {
  type Mark,
  type MotionPhase,
  progressTimeMs,
  type RectMark,
} from '@opendata-ai/openchart-core';

/** One stack of segments sharing a band, revealed as one clip. */
export interface StackExtent {
  key: string;
  horizontal: boolean;
  /** Stagger index of the stack (its first segment's). */
  index: number;
  /** Value-axis baseline in px, when the engine stamped one. */
  baseline: number | undefined;
  /** Extent along the value axis, in px (top/left to bottom/right). */
  start: number;
  end: number;
}

function valueExtent(mark: RectMark): { horizontal: boolean; start: number; end: number } {
  const horizontal = mark.orient === 'horizontal';
  const start = horizontal ? mark.x : mark.y;
  return { horizontal, start, end: start + (horizontal ? mark.width : mark.height) };
}

/**
 * Group stacked segments (rects with a stack position) into stacks: same
 * orientation, stack group and band. Keyed by mark.
 */
export function stackExtents(marks: readonly Mark[]): Map<RectMark, StackExtent> {
  const byKey = new Map<string, StackExtent>();
  const byMark = new Map<RectMark, StackExtent>();
  for (const mark of marks) {
    if (mark.type !== 'rect' || mark.stackPos === undefined) continue;
    const { horizontal, start, end } = valueExtent(mark);
    const band = horizontal ? mark.y : mark.x;
    const key = `${horizontal ? 'h' : 'v'}:${mark.stackGroup ?? ''}:${band}`;
    let stack = byKey.get(key);
    if (!stack) {
      stack = {
        key,
        horizontal,
        index: mark.animationIndex ?? 0,
        baseline: mark.baseline,
        start,
        end,
      };
      byKey.set(key, stack);
    }
    stack.start = Math.min(stack.start, start);
    stack.end = Math.max(stack.end, end);
    byMark.set(mark, stack);
  }
  return byMark;
}

/** The default starting inset of each reveal keyframe (grows from bottom / left). */
const DEFAULT_FROM = { vertical: '100% 0 0 0', horizontal: '0 100% 0 0' } as const;

/**
 * The starting clip inset that collapses a reveal onto the baseline, so it
 * grows away from it (both ways when the baseline is inside the extent).
 * Undefined when it equals the keyframe's default, or with no baseline.
 */
export function revealFrom(
  horizontal: boolean,
  start: number,
  end: number,
  baseline: number | undefined,
): string | undefined {
  const size = end - start;
  if (baseline === undefined || !(size > 0)) return undefined;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const pct = (px: number) => {
    const v = Number(clamp((px / size) * 100).toFixed(4));
    return v === 0 ? '0' : `${v}%`;
  };
  // Insets from the extent's own box: top/left side up to the baseline, the rest after.
  const before = pct(baseline - start);
  const after = pct(end - baseline);
  const inset = horizontal ? `0 ${after} 0 ${before}` : `${before} 0 ${after} 0`;
  return inset === DEFAULT_FROM[horizontal ? 'horizontal' : 'vertical'] ? undefined : inset;
}

/**
 * Delays for points that sit on a line or area: each starts when its series'
 * clip edge reaches the dot (cx - r). The clip runs over the line group's box, whose
 * x-extent is the series' own point extent, eased on the line's curve.
 * Keyed by index into `marks`; points on no series are left out.
 */
export function linePointDelays(
  marks: readonly Mark[],
  phase: MotionPhase,
  staggerMs: number,
  markIndexOffset = 0,
): Map<number, number> {
  interface Series {
    index: number;
    minX: number;
    maxX: number;
  }
  const byPoint = new Map<string, Series>();
  marks.forEach((mark, i) => {
    if (mark.type !== 'line' && mark.type !== 'area') return;
    const points = mark.type === 'line' ? mark.points : mark.topPoints;
    if (points.length === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    const series = { index: mark.animationIndex ?? i + markIndexOffset, minX, maxX };
    for (const p of points) {
      const key = `${p.x},${p.y}`;
      if (!byPoint.has(key)) byPoint.set(key, series);
    }
  });
  const delays = new Map<number, number>();
  if (byPoint.size === 0) return delays;
  marks.forEach((mark, i) => {
    if (mark.type !== 'point') return;
    const series = byPoint.get(`${mark.cx},${mark.cy}`);
    if (!series) return;
    // The dot starts when the edge touches it (its leading edge, cx - r), not
    // its centre: an eased curve only reaches exactly 1 at the very end, so
    // keying the last dot to its centre leaves it waiting after the line looks done.
    const span = series.maxX - series.minX;
    const fraction = span > 0 ? Math.max(0, (mark.cx - mark.r - series.minX) / span) : 0;
    delays.set(i, progressTimeMs('line-area', series.index, phase, { staggerMs }, fraction));
  });
  return delays;
}
