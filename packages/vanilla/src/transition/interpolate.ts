import type { AreaMark, LineMark, Point, RectMark } from '@opendata-ai/openchart-core';
import { buildAreaPath, buildLinePath } from '@opendata-ai/openchart-engine';
import { rectPathWithCorners } from '../renderers/marks';

import type { RectGeom } from './types';

// ---------------------------------------------------------------------------
// Geometry helpers (rect)
// ---------------------------------------------------------------------------

export function geomFromMark(m: RectMark): RectGeom {
  return { x: m.x, y: m.y, width: m.width, height: m.height };
}

/**
 * Resolve the rect/path child a rect mark's geometry is written to.
 * Extracted so tween builders can cache the result once at construction
 * instead of re-querying it every frame.
 */
export function resolveRectShapeElement(el: SVGElement): SVGElement | null {
  return el.querySelector('rect, path') as SVGElement | null;
}

export function applyGeomToElement(
  el: SVGElement,
  geom: RectGeom,
  mark: RectMark,
  cachedShapeEl?: SVGElement | null,
  scratch?: RectMark,
): void {
  const shapeEl = cachedShapeEl !== undefined ? cachedShapeEl : resolveRectShapeElement(el);
  if (!shapeEl) return;

  const sides = mark.cornerRadiusSides;
  const partialCorners =
    !!sides && (!sides.tl || !sides.tr || !sides.br || !sides.bl) && !!mark.cornerRadius;

  if (partialCorners && shapeEl.tagName === 'path') {
    let tempMark: RectMark;
    if (scratch) {
      scratch.x = geom.x;
      scratch.y = geom.y;
      scratch.width = geom.width;
      scratch.height = geom.height;
      tempMark = scratch;
    } else {
      tempMark = { ...mark, ...geom };
    }
    shapeEl.setAttribute('d', rectPathWithCorners(tempMark, sides));
  } else {
    shapeEl.setAttribute('x', String(geom.x));
    shapeEl.setAttribute('y', String(geom.y));
    shapeEl.setAttribute('width', String(geom.width));
    shapeEl.setAttribute('height', String(geom.height));
  }
}

export function lerpGeom(from: RectGeom, to: RectGeom, t: number): RectGeom {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

// ---------------------------------------------------------------------------
// Point interpolation helpers (line/area morphing)
// ---------------------------------------------------------------------------

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Normalize two point arrays (prev and next) to equal length by matching
 * on pointKeys. Inserted/removed points get synthetic positions interpolated
 * from surviving neighbors.
 *
 * Returns [fromPts, toPts] of equal length.
 */
export function normalizePointArrays(
  prevPoints: Point[],
  nextPoints: Point[],
  prevKeys: string[],
  nextKeys: string[],
): [Point[], Point[]] {
  // Build merged key sequence preserving order from both sides
  const nextKeySet = new Set(nextKeys);

  // Check for zero survivors (no keys in common)
  const survivors = prevKeys.filter((k) => nextKeySet.has(k));
  if (survivors.length === 0) {
    // Crossfade path: return arrays as-is (caller handles opacity crossfade)
    return [prevPoints, nextPoints];
  }

  // Build key-to-point maps
  const prevByKey = new Map<string, Point>();
  for (let i = 0; i < prevKeys.length; i++) {
    prevByKey.set(prevKeys[i], prevPoints[i]);
  }
  const nextByKey = new Map<string, Point>();
  for (let i = 0; i < nextKeys.length; i++) {
    nextByKey.set(nextKeys[i], nextPoints[i]);
  }

  // Merge keys in order: walk both arrays maintaining relative order
  const merged = mergeKeyOrder(prevKeys, nextKeys);

  // Precompute merged index map for O(1) lookups in insertion/removal helpers
  const mergedIndex = new Map<string, number>();
  for (let i = 0; i < merged.length; i++) {
    mergedIndex.set(merged[i], i);
  }

  const fromPts: Point[] = [];
  const toPts: Point[] = [];

  for (const key of merged) {
    const inPrev = prevByKey.has(key);
    const inNext = nextByKey.has(key);

    if (inPrev && inNext) {
      // Matched point: straightforward interpolation
      fromPts.push(prevByKey.get(key)!);
      toPts.push(nextByKey.get(key)!);
    } else if (inNext && !inPrev) {
      // Inserted point: "to" is nextPoint; "from" is interpolated on prev line
      const nextPt = nextByKey.get(key)!;
      toPts.push(nextPt);
      fromPts.push(findInsertionPosition(key, merged, mergedIndex, prevByKey, nextByKey, nextPt));
    } else if (inPrev && !inNext) {
      // Removed point: "from" is prevPoint; "to" is collapse position
      const prevPt = prevByKey.get(key)!;
      fromPts.push(prevPt);
      toPts.push(findRemovalPosition(key, merged, mergedIndex, prevByKey, nextByKey, prevPt));
    }
  }

  return [fromPts, toPts];
}

/**
 * Merge two key arrays preserving the relative order from both.
 * Keys present in both appear once at their first occurrence position.
 */
export function mergeKeyOrder(prevKeys: string[], nextKeys: string[]): string[] {
  // Precompute index maps for O(1) lookups instead of indexOf
  const nextIndex = new Map<string, number>();
  for (let i = 0; i < nextKeys.length; i++) {
    if (!nextIndex.has(nextKeys[i])) nextIndex.set(nextKeys[i], i);
  }
  const prevIndex = new Map<string, number>();
  for (let i = 0; i < prevKeys.length; i++) {
    if (!prevIndex.has(prevKeys[i])) prevIndex.set(prevKeys[i], i);
  }

  const result: string[] = [];
  const added = new Set<string>();
  let pi = 0;
  let ni = 0;

  while (pi < prevKeys.length && ni < nextKeys.length) {
    const pk = prevKeys[pi];
    const nk = nextKeys[ni];

    if (added.has(pk)) {
      pi++;
      continue;
    }
    if (added.has(nk)) {
      ni++;
      continue;
    }

    if (pk === nk) {
      result.push(pk);
      added.add(pk);
      pi++;
      ni++;
    } else {
      const pkInNext = nextIndex.has(pk) && nextIndex.get(pk)! >= ni ? nextIndex.get(pk)! : -1;
      const nkInPrev = prevIndex.has(nk) && prevIndex.get(nk)! >= pi ? prevIndex.get(nk)! : -1;

      if (pkInNext === -1 && nkInPrev === -1) {
        result.push(pk);
        added.add(pk);
        pi++;
      } else if (pkInNext === -1) {
        result.push(pk);
        added.add(pk);
        pi++;
      } else if (nkInPrev === -1) {
        result.push(nk);
        added.add(nk);
        ni++;
      } else {
        if (pkInNext <= nkInPrev) {
          result.push(pk);
          added.add(pk);
          pi++;
        } else {
          result.push(nk);
          added.add(nk);
          ni++;
        }
      }
    }
  }

  // Drain remaining
  while (pi < prevKeys.length) {
    if (!added.has(prevKeys[pi])) {
      result.push(prevKeys[pi]);
      added.add(prevKeys[pi]);
    }
    pi++;
  }
  while (ni < nextKeys.length) {
    if (!added.has(nextKeys[ni])) {
      result.push(nextKeys[ni]);
      added.add(nextKeys[ni]);
    }
    ni++;
  }

  return result;
}

/**
 * Find where an inserted point should start from on the previous line.
 * Interpolates between the nearest surviving neighbors' prev positions,
 * proportional to the new point's x between neighbors' next x positions.
 * If at head/tail, uses the nearest surviving endpoint's prev position.
 */
export function findInsertionPosition(
  key: string,
  merged: string[],
  mergedIndex: Map<string, number>,
  prevByKey: Map<string, Point>,
  nextByKey: Map<string, Point>,
  nextPt: Point,
): Point {
  const idx = mergedIndex.get(key) ?? -1;

  // Find nearest surviving neighbor before
  let beforeKey: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (prevByKey.has(merged[i]) && nextByKey.has(merged[i])) {
      beforeKey = merged[i];
      break;
    }
  }

  // Find nearest surviving neighbor after
  let afterKey: string | null = null;
  for (let i = idx + 1; i < merged.length; i++) {
    if (prevByKey.has(merged[i]) && nextByKey.has(merged[i])) {
      afterKey = merged[i];
      break;
    }
  }

  if (beforeKey && afterKey) {
    // Interpolate between neighbors
    const beforeNext = nextByKey.get(beforeKey)!;
    const afterNext = nextByKey.get(afterKey)!;
    const beforePrev = prevByKey.get(beforeKey)!;
    const afterPrev = prevByKey.get(afterKey)!;

    const range = afterNext.x - beforeNext.x;
    const t = range === 0 ? 0.5 : (nextPt.x - beforeNext.x) / range;
    return lerpPoint(beforePrev, afterPrev, Math.max(0, Math.min(1, t)));
  }

  if (beforeKey) {
    // At tail: unfold from nearest surviving endpoint
    return { ...prevByKey.get(beforeKey)! };
  }

  if (afterKey) {
    // At head: unfold from nearest surviving endpoint
    return { ...prevByKey.get(afterKey)! };
  }

  // No survivors (shouldn't happen since we check above, but safe fallback)
  return nextPt;
}

/**
 * Find where a removed point should collapse to on the next line.
 * Mirror of findInsertionPosition but for the destination side.
 */
export function findRemovalPosition(
  key: string,
  merged: string[],
  mergedIndex: Map<string, number>,
  prevByKey: Map<string, Point>,
  nextByKey: Map<string, Point>,
  prevPt: Point,
): Point {
  const idx = mergedIndex.get(key) ?? -1;

  // Find nearest surviving neighbor before
  let beforeKey: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (prevByKey.has(merged[i]) && nextByKey.has(merged[i])) {
      beforeKey = merged[i];
      break;
    }
  }

  // Find nearest surviving neighbor after
  let afterKey: string | null = null;
  for (let i = idx + 1; i < merged.length; i++) {
    if (prevByKey.has(merged[i]) && nextByKey.has(merged[i])) {
      afterKey = merged[i];
      break;
    }
  }

  if (beforeKey && afterKey) {
    const beforePrev = prevByKey.get(beforeKey)!;
    const afterPrev = prevByKey.get(afterKey)!;
    const beforeNext = nextByKey.get(beforeKey)!;
    const afterNext = nextByKey.get(afterKey)!;

    const range = afterPrev.x - beforePrev.x;
    const t = range === 0 ? 0.5 : (prevPt.x - beforePrev.x) / range;
    return lerpPoint(beforeNext, afterNext, Math.max(0, Math.min(1, t)));
  }

  if (beforeKey) {
    return { ...nextByKey.get(beforeKey)! };
  }

  if (afterKey) {
    return { ...nextByKey.get(afterKey)! };
  }

  return prevPt;
}

// ---------------------------------------------------------------------------
// Line/area path application helpers
// ---------------------------------------------------------------------------

/**
 * Interpolate a point array at parameter t.
 *
 * Accepts an optional reusable `out` buffer: tween builders normalize
 * `fromPts`/`toPts` to equal length once at construction, so that length is
 * stable for the tween's lifetime and a preallocated buffer of the same
 * length can be mutated in place every frame instead of allocating a fresh
 * array (plus one object per point) 60 times a second. Callers that don't
 * pass `out` (e.g. one-off snapshot captures) get the original fresh-array
 * behavior.
 */
export function interpolatePoints(
  fromPts: Point[],
  toPts: Point[],
  t: number,
  out?: Point[],
): Point[] {
  const len = Math.min(fromPts.length, toPts.length);
  const result: Point[] = out ?? new Array(len);
  for (let i = 0; i < len; i++) {
    const from = fromPts[i];
    const to = toPts[i];
    const existing = result[i];
    if (existing) {
      existing.x = from.x + (to.x - from.x) * t;
      existing.y = from.y + (to.y - from.y) * t;
    } else {
      result[i] = lerpPoint(from, to, t);
    }
  }
  if (result.length !== len) result.length = len;
  return result;
}

/** Apply an interpolated path to a line mark's path element. */
export function applyLinePath(
  el: SVGElement,
  points: Point[],
  interpolate?: string,
  cachedPathEl?: SVGElement | null,
): void {
  const pathEl =
    cachedPathEl !== undefined ? cachedPathEl : (el.querySelector('path') as SVGElement | null);
  if (!pathEl) return;
  pathEl.setAttribute('d', buildLinePath(points, interpolate));
}

/** Apply interpolated paths to an area mark's fill and stroke path elements. */
export function applyAreaPaths(
  el: SVGElement,
  topPoints: Point[],
  bottomPoints: Point[],
  interpolate?: string,
  hasStroke?: boolean,
  cachedFillPathEl?: SVGElement | null,
  cachedTopPathEl?: SVGElement | null,
): void {
  const fillPathEl =
    cachedFillPathEl !== undefined
      ? cachedFillPathEl
      : ((el.querySelectorAll('path')[0] as SVGElement | undefined) ?? null);
  if (fillPathEl) {
    fillPathEl.setAttribute('d', buildAreaPath(topPoints, bottomPoints, interpolate));
  }
  if (hasStroke) {
    const topPathEl =
      cachedTopPathEl !== undefined
        ? cachedTopPathEl
        : ((el.querySelectorAll('path')[1] as SVGElement | undefined) ?? null);
    if (topPathEl) {
      topPathEl.setAttribute('d', buildLinePath(topPoints, interpolate));
    }
  }
}

/** Apply the exact final path from the mark data (not from interpolated points). */
export function applyFinalLinePath(el: SVGElement, mark: LineMark): void {
  const pathEl = el.querySelector('path') as SVGElement | null;
  if (!pathEl || !mark.path) return;
  pathEl.setAttribute('d', mark.path);
}

/** Apply the exact final paths from the area mark data. */
export function applyFinalAreaPaths(el: SVGElement, mark: AreaMark): void {
  const paths = el.querySelectorAll('path');
  if (paths[0]) {
    paths[0].setAttribute('d', mark.path);
  }
  if (paths[1] && mark.topPath) {
    paths[1].setAttribute('d', mark.topPath);
  }
}
