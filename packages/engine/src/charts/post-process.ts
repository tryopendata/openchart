/**
 * Mark post-processing: obstacle computation, renderer dispatch, and
 * animation index assignment. These are mark-type-aware operations that
 * run after the chart renderer has produced marks.
 */

import type {
  Encoding,
  Mark,
  MarkDef,
  PointMark,
  Rect,
  RectMark,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';
import type { ResolvedScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// Mark obstacles for annotation collision avoidance
// ---------------------------------------------------------------------------

/**
 * Compute bounding rects from marks to use as obstacles for annotation nudging.
 *
 * For band-scale charts (bar, dot): groups marks by band row and returns
 * a single obstacle per row spanning the full band height and x-range.
 *
 * For other charts (column, scatter): returns individual mark bounds so
 * annotations avoid overlapping any visible data mark.
 */
export function computeMarkObstacles(marks: Mark[], scales: ResolvedScales): Rect[] {
  // Band-scale y-axis: group marks by row for efficient obstacle computation
  if (scales.y?.type === 'band') {
    return computeBandRowObstacles(marks, scales);
  }

  // All other charts: use individual rect/point mark bounds as obstacles
  const obstacles: Rect[] = [];
  for (const mark of marks) {
    if (mark.type === 'rect') {
      const rm = mark as RectMark;
      obstacles.push({ x: rm.x, y: rm.y, width: rm.width, height: rm.height });
    } else if (mark.type === 'point') {
      const pm = mark as PointMark;
      obstacles.push({
        x: pm.cx - pm.r,
        y: pm.cy - pm.r,
        width: pm.r * 2,
        height: pm.r * 2,
      });
    }
  }
  return obstacles;
}

/** Group band-scale marks by row, returning one obstacle per band. */
function computeBandRowObstacles(marks: Mark[], scales: ResolvedScales): Rect[] {
  const rows = new Map<number, { minX: number; maxX: number; bandY: number }>();

  for (const mark of marks) {
    let cy: number;
    let left: number;
    let right: number;

    if (mark.type === 'point') {
      const pm = mark as PointMark;
      cy = pm.cy;
      left = pm.cx - pm.r;
      right = pm.cx + pm.r;
    } else if (mark.type === 'rect') {
      const rm = mark as RectMark;
      cy = rm.y + rm.height / 2;
      left = rm.x;
      right = rm.x + rm.width;
    } else {
      continue;
    }

    // Round cy to group marks on the same band
    const key = Math.round(cy);
    const existing = rows.get(key);
    if (existing) {
      existing.minX = Math.min(existing.minX, left);
      existing.maxX = Math.max(existing.maxX, right);
    } else {
      rows.set(key, { minX: left, maxX: right, bandY: cy });
    }
  }

  // Get bandwidth from the band scale
  const bandScale = scales.y!.scale as { bandwidth?: () => number };
  const bandwidth = bandScale.bandwidth?.() ?? 0;
  if (bandwidth === 0) return [];

  const obstacles: Rect[] = [];
  for (const { minX, maxX, bandY } of rows.values()) {
    obstacles.push({
      x: minX,
      y: bandY - bandwidth / 2,
      width: maxX - minX,
      height: bandwidth,
    });
  }

  return obstacles;
}

// ---------------------------------------------------------------------------
// Renderer key dispatch
// ---------------------------------------------------------------------------

/**
 * Resolve the renderer key from mark type, encoding, and mark definition.
 *
 * - 'bar' -> 'bar' (horizontal) or 'bar:vertical' based on encoding axis types
 * - 'arc' -> 'arc' (pie) or 'arc:donut' based on innerRadius
 * - All other mark types pass through unchanged
 */
export function resolveRendererKey(
  markType: string,
  encoding: Partial<Encoding>,
  markDef: Partial<MarkDef>,
): string {
  if (markType === 'bar') {
    const xType = encoding.x?.type;
    const yType = encoding.y?.type;
    const isVertical =
      (xType === 'nominal' || xType === 'ordinal' || xType === 'temporal') &&
      yType === 'quantitative';
    if (isVertical) {
      return 'bar:vertical';
    }
  } else if (markType === 'arc') {
    const innerRadius = markDef.innerRadius;
    if (innerRadius && innerRadius > 0) {
      return 'arc:donut';
    }
  }
  return markType;
}

// ---------------------------------------------------------------------------
// Animation index assignment
// ---------------------------------------------------------------------------

/** Extract the primary quantitative value from a mark for value-based stagger ordering. */
function getMarkPrimaryValue(mark: Mark): number {
  switch (mark.type) {
    case 'rect':
      return mark.height; // bar height is the primary value encoding
    case 'point':
      return mark.cy; // y position for scatter
    case 'arc':
      return mark.endAngle - mark.startAngle; // arc angle extent
    case 'line':
    case 'area':
      return 0; // series marks don't have individual values
    default:
      return 0;
  }
}

/**
 * Assign animation indices to marks for stagger ordering.
 *
 * Two phases:
 * 1. Value-based stagger: sorts marks by primary value, assigns sequential indices.
 *    Skips stacked rects since they get group-based indices in phase 2.
 * 2. Stack-based stagger: groups marks by stackGroup, assigns the same index to
 *    all segments in a group, and computes stackPos (segment position: 0, 1, 2...).
 *    This intentionally overwrites any value-based indices for stacked marks.
 */
export function assignAnimationIndices(
  marks: Mark[],
  animation: ResolvedAnimation | undefined,
): void {
  if (!animation?.enabled) return;

  // Phase 1: Value-based stagger ordering. Skip stacked rects
  // since they get group-based indices below (avoids wasted work that gets overwritten).
  if (animation.staggerOrder === 'value') {
    const indexed = marks.map((m, i) => ({ mark: m, idx: i }));
    indexed.sort((a, b) => {
      const av = getMarkPrimaryValue(a.mark);
      const bv = getMarkPrimaryValue(b.mark);
      return av - bv;
    });
    for (let i = 0; i < indexed.length; i++) {
      const m = indexed[i].mark;
      if (m.type === 'rect' && (m as RectMark).stackGroup) continue;
      m.animationIndex = i;
    }
  }

  // Phase 2: For stacked bars/columns, assign the same animationIndex to all segments
  // sharing a stackGroup so they animate as one contiguous bar per category.
  // Also compute stackPos (segment position within each group: 0, 1, 2...)
  // so the renderer can chain segment animations sequentially.
  const groupIndexMap = new Map<string, number>();
  const groupStackPos = new Map<string, number>();
  let nextGroupIndex = 0;
  for (const mark of marks) {
    if (mark.type === 'rect' && (mark as RectMark).stackGroup) {
      const rect = mark as RectMark;
      const group = rect.stackGroup!;
      if (!groupIndexMap.has(group)) {
        groupIndexMap.set(group, nextGroupIndex++);
      }
      rect.animationIndex = groupIndexMap.get(group)!;
      const pos = groupStackPos.get(group) ?? 0;
      rect.stackPos = pos;
      groupStackPos.set(group, pos + 1);
    }
  }
}
