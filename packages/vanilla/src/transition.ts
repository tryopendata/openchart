/**
 * Data-update transition driver for bar/column, line, and area charts.
 *
 * Matches marks across layout snapshots by `key`, then animates geometry
 * changes (position, size, path) using a single rAF loop. Enter/exit/update
 * choreography runs in one timeline with cubic-out easing for a smooth
 * deceleration feel.
 *
 * For rect marks: tweens position/size directly.
 * For line/area marks: normalizes point arrays to equal length, interpolates
 * point positions per frame, and rebuilds SVG paths via d3 curve generators.
 * For point marks overlaid on lines: tweens cx/cy.
 *
 * Ghost elements handle exits: cloned into the marks container, they
 * collapse + fade out then get removed. No CSS animations are used here
 * because transitions tween computed geometry, not class-toggled states.
 */

import type {
  AreaMark,
  ChartLayout,
  LineMark,
  Point,
  PointMark,
  RectMark,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';
import { buildAreaPath, buildLinePath } from '@opendata-ai/openchart-engine';
import { rectPathWithCorners, renderSingleMark } from './renderers/marks';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TransitionHandle {
  cancel(): void;
  readonly running: boolean;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/** Cubic-out easing: objects decelerate naturally into place. */
function cubicOut(t: number): number {
  const f = 1 - t;
  return 1 - f * f * f;
}

// ---------------------------------------------------------------------------
// canTransition gate
// ---------------------------------------------------------------------------

/** Mark types that support data-update transitions. */
const TRANSITIONABLE_MARKS = new Set(['bar', 'line', 'area']);

/**
 * Determine whether a data-update transition should run instead of
 * a full tear-down + re-render.
 *
 * Ten gate checks must all pass. If any fails, the caller should fall
 * through to the standard render path (instant swap).
 */
export function canTransition(args: {
  prevLayout: ChartLayout | null;
  nextLayout: ChartLayout;
  prevSpec: unknown;
  nextSpec: unknown;
  isFirstRender: boolean;
  entranceInFlight: boolean;
}): boolean {
  const { prevLayout, nextLayout, prevSpec, nextSpec, isFirstRender, entranceInFlight } = args;

  // 1. Previous layout + spec exist and not first render
  if (!prevLayout || !prevSpec || isFirstRender) return false;

  // 2. Resolved animation.update present on next layout
  if (!nextLayout.animation?.update) return false;

  // 3. Both are chart specs (have `mark`), same mark type, type is transitionable
  const prev = prevSpec as Record<string, unknown>;
  const next = nextSpec as Record<string, unknown>;
  if (!('mark' in prev) || !('mark' in next)) return false;
  const prevMark =
    typeof prev.mark === 'string' ? prev.mark : (prev.mark as Record<string, unknown>)?.type;
  const nextMark =
    typeof next.mark === 'string' ? next.mark : (next.mark as Record<string, unknown>)?.type;
  if (prevMark !== nextMark) return false;
  if (!TRANSITIONABLE_MARKS.has(prevMark as string)) return false;

  // 4. Encoding identity unchanged
  const prevEnc = (prev as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  const nextEnc = (next as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  if (!prevEnc || !nextEnc) return false;
  if (
    prevEnc.x?.field !== nextEnc.x?.field ||
    prevEnc.x?.type !== nextEnc.x?.type ||
    prevEnc.y?.field !== nextEnc.y?.field ||
    prevEnc.y?.type !== nextEnc.y?.type ||
    prevEnc.color?.field !== nextEnc.color?.field
  ) {
    return false;
  }

  // 5. Not sparkline
  if (nextLayout.display === 'sparkline') return false;

  // 6. Entrance animation not in flight
  if (entranceInFlight) return false;

  // 7. Layout dimensions unchanged
  if (
    prevLayout.dimensions.width !== nextLayout.dimensions.width ||
    prevLayout.dimensions.height !== nextLayout.dimensions.height
  ) {
    return false;
  }

  // 8. Mark count <= 500
  if (nextLayout.marks.length > 500) return false;

  // 9. Geometry actually changed (zero-delta check)
  if (!hasGeometryChanged(prevLayout, nextLayout)) return false;

  // 10. prefers-reduced-motion not active
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {
      // happy-dom may not support matchMedia fully; treat as no preference
    }
  }

  return true;
}

/** Check if any mark geometry differs between prev and next layouts. */
function hasGeometryChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prevMarks = prevLayout.marks;
  const nextMarks = nextLayout.marks;

  if (prevMarks.length !== nextMarks.length) return true;

  for (let i = 0; i < prevMarks.length; i++) {
    const p = prevMarks[i];
    const n = nextMarks[i];
    if (p.type !== n.type || p.key !== n.key) return true;

    if (p.type === 'rect' && n.type === 'rect') {
      if (p.x !== n.x || p.y !== n.y || p.width !== n.width || p.height !== n.height) return true;
    } else if (p.type === 'line' && n.type === 'line') {
      if (p.path !== n.path || p.points.length !== n.points.length) return true;
      for (let j = 0; j < p.points.length; j++) {
        if (p.points[j].x !== n.points[j].x || p.points[j].y !== n.points[j].y) return true;
      }
    } else if (p.type === 'area' && n.type === 'area') {
      if (p.path !== n.path) return true;
    } else if (p.type === 'point' && n.type === 'point') {
      if (p.cx !== n.cx || p.cy !== n.cy) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Internal types for tweens
// ---------------------------------------------------------------------------

interface RectGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RectTween {
  tweenType: 'rect';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  from: RectGeom;
  to: RectGeom;
  mark: RectMark;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface LineTween {
  tweenType: 'line';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromPts: Point[];
  toPts: Point[];
  /** The final mark's points (may differ from toPts which is the normalized array). */
  finalPoints: Point[];
  interpolate?: string;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface AreaTween {
  tweenType: 'area';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromTop: Point[];
  toTop: Point[];
  fromBottom: Point[];
  toBottom: Point[];
  /** Final mark's points for the exact path at t=1. */
  finalTopPoints: Point[];
  finalBottomPoints: Point[];
  interpolate?: string;
  /** Whether to also write the topPath stroke element. */
  hasStroke: boolean;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface PointTween {
  tweenType: 'point';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromCx: number;
  fromCy: number;
  toCx: number;
  toCy: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
  /** Whether this point has a renderer-set opacity (e.g. suppressed under endpoint marker). */
  suppressedOpacity?: string;
}

type Tween = RectTween | LineTween | AreaTween | PointTween;

// ---------------------------------------------------------------------------
// Geometry helpers (rect)
// ---------------------------------------------------------------------------

function geomFromMark(m: RectMark): RectGeom {
  return { x: m.x, y: m.y, width: m.width, height: m.height };
}

function applyGeomToElement(el: SVGElement, geom: RectGeom, mark: RectMark): void {
  const shapeEl = el.querySelector('rect, path') as SVGElement | null;
  if (!shapeEl) return;

  const sides = mark.cornerRadiusSides;
  const partialCorners =
    !!sides && (!sides.tl || !sides.tr || !sides.br || !sides.bl) && !!mark.cornerRadius;

  if (partialCorners && shapeEl.tagName === 'path') {
    const tempMark = { ...mark, ...geom };
    shapeEl.setAttribute('d', rectPathWithCorners(tempMark, sides));
  } else {
    shapeEl.setAttribute('x', String(geom.x));
    shapeEl.setAttribute('y', String(geom.y));
    shapeEl.setAttribute('width', String(geom.width));
    shapeEl.setAttribute('height', String(geom.height));
  }
}

function lerpGeom(from: RectGeom, to: RectGeom, t: number): RectGeom {
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

function lerpPoint(a: Point, b: Point, t: number): Point {
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
      fromPts.push(findInsertionPosition(key, merged, prevByKey, nextByKey, nextPt));
    } else if (inPrev && !inNext) {
      // Removed point: "from" is prevPoint; "to" is collapse position
      const prevPt = prevByKey.get(key)!;
      fromPts.push(prevPt);
      toPts.push(findRemovalPosition(key, merged, prevByKey, nextByKey, prevPt));
    }
  }

  return [fromPts, toPts];
}

/**
 * Merge two key arrays preserving the relative order from both.
 * Keys present in both appear once at their first occurrence position.
 */
function mergeKeyOrder(prevKeys: string[], nextKeys: string[]): string[] {
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
      // Determine which to take first by checking if the other appears later
      const pkInNext = nextKeys.indexOf(pk, ni);
      const nkInPrev = prevKeys.indexOf(nk, pi);

      if (pkInNext === -1 && nkInPrev === -1) {
        // Neither is in the other array; take prev first
        result.push(pk);
        added.add(pk);
        pi++;
      } else if (pkInNext === -1) {
        // pk not in next (removed); take it now
        result.push(pk);
        added.add(pk);
        pi++;
      } else if (nkInPrev === -1) {
        // nk not in prev (inserted); take it now
        result.push(nk);
        added.add(nk);
        ni++;
      } else {
        // Both exist in both; take the one that comes first in its opposing array
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
function findInsertionPosition(
  key: string,
  merged: string[],
  prevByKey: Map<string, Point>,
  nextByKey: Map<string, Point>,
  nextPt: Point,
): Point {
  const idx = merged.indexOf(key);

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
function findRemovalPosition(
  key: string,
  merged: string[],
  prevByKey: Map<string, Point>,
  nextByKey: Map<string, Point>,
  prevPt: Point,
): Point {
  const idx = merged.indexOf(key);

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

/** Interpolate a point array at parameter t. */
function interpolatePoints(fromPts: Point[], toPts: Point[], t: number): Point[] {
  const len = Math.min(fromPts.length, toPts.length);
  const result: Point[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = lerpPoint(fromPts[i], toPts[i], t);
  }
  return result;
}

/** Apply an interpolated path to a line mark's path element. */
function applyLinePath(el: SVGElement, points: Point[], interpolate?: string): void {
  const pathEl = el.querySelector('path') as SVGElement | null;
  if (!pathEl) return;
  pathEl.setAttribute('d', buildLinePath(points, interpolate));
}

/** Apply interpolated paths to an area mark's fill and stroke path elements. */
function applyAreaPaths(
  el: SVGElement,
  topPoints: Point[],
  bottomPoints: Point[],
  interpolate?: string,
  hasStroke?: boolean,
): void {
  const paths = el.querySelectorAll('path');
  // First path is the area fill
  if (paths[0]) {
    paths[0].setAttribute('d', buildAreaPath(topPoints, bottomPoints, interpolate));
  }
  // Second path (if present) is the top-line stroke
  if (hasStroke && paths[1]) {
    paths[1].setAttribute('d', buildLinePath(topPoints, interpolate));
  }
}

/** Apply the exact final path from the mark data (not from interpolated points). */
function applyFinalLinePath(el: SVGElement, mark: LineMark): void {
  const pathEl = el.querySelector('path') as SVGElement | null;
  if (!pathEl || !mark.path) return;
  pathEl.setAttribute('d', mark.path);
}

/** Apply the exact final paths from the area mark data. */
function applyFinalAreaPaths(el: SVGElement, mark: AreaMark): void {
  const paths = el.querySelectorAll('path');
  if (paths[0]) {
    paths[0].setAttribute('d', mark.path);
  }
  if (paths[1] && mark.topPath) {
    paths[1].setAttribute('d', mark.topPath);
  }
}

// ---------------------------------------------------------------------------
// runTransition
// ---------------------------------------------------------------------------

export function runTransition(args: {
  svg: SVGSVGElement;
  prevLayout: ChartLayout;
  nextLayout: ChartLayout;
  animation: ResolvedAnimation;
  onComplete: () => void;
}): TransitionHandle {
  const { svg, prevLayout, nextLayout, animation, onComplete } = args;
  const update = animation.update!;
  const exit = animation.exit ?? {
    duration: 300,
    ease: 'smooth',
    staggerDelay: 0,
    staggerOrder: 'index' as const,
  };

  // Total timeline
  const totalMs = Math.max(update.duration, exit.duration);
  const enterDelay = 0.4 * update.duration; // enters start at 40% of update duration
  const enterDuration = update.duration - enterDelay; // remaining 60%

  // Find the marks container in the SVG
  const marksContainer = svg.querySelector('.oc-marks') as SVGElement | null;
  if (!marksContainer) {
    onComplete();
    return {
      cancel() {},
      get running() {
        return false;
      },
    };
  }

  // Build all tweens
  const tweens: Tween[] = [];
  const ghosts: SVGElement[] = [];

  // Determine what mark types we're dealing with
  const hasRects =
    prevLayout.marks.some((m) => m.type === 'rect') ||
    nextLayout.marks.some((m) => m.type === 'rect');
  const hasLines =
    prevLayout.marks.some((m) => m.type === 'line') ||
    nextLayout.marks.some((m) => m.type === 'line');
  const hasAreas =
    prevLayout.marks.some((m) => m.type === 'area') ||
    nextLayout.marks.some((m) => m.type === 'area');
  const hasPoints =
    prevLayout.marks.some((m) => m.type === 'point') ||
    nextLayout.marks.some((m) => m.type === 'point');

  if (hasRects) {
    buildRectTweens(prevLayout, nextLayout, marksContainer, tweens, ghosts);
  }
  if (hasLines) {
    buildLineTweens(prevLayout, nextLayout, marksContainer, tweens, ghosts);
  }
  if (hasAreas) {
    buildAreaTweens(prevLayout, nextLayout, marksContainer, tweens, ghosts);
  }
  if (hasPoints) {
    buildPointTweens(prevLayout, nextLayout, marksContainer, tweens, ghosts);
  }

  // Apply all from-states SYNCHRONOUSLY before scheduling the first rAF
  for (const tw of tweens) {
    applyTweenState(tw, 0, update, exit, enterDelay, enterDuration);
  }

  // Animation loop state
  let rafId: number | null = null;
  let running = true;
  let startTime: number | null = null;

  // Track line/area marks that need final path snapping
  const nextLineMarks = nextLayout.marks.filter((m): m is LineMark => m.type === 'line');
  const nextAreaMarks = nextLayout.marks.filter((m): m is AreaMark => m.type === 'area');

  function tick(now: number): void {
    if (!running) return;
    if (startTime === null) startTime = now;

    const elapsed = now - startTime;
    const tGlobal = Math.min(elapsed / totalMs, 1);

    for (const tw of tweens) {
      applyTweenState(tw, elapsed, update, exit, enterDelay, enterDuration);
    }

    if (tGlobal >= 1) {
      finish();
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function finish(): void {
    if (!running) return;
    running = false;
    rafId = null;

    snapToFinal();
    removeGhosts();
    onComplete();
  }

  function snapToFinal(): void {
    for (const tw of tweens) {
      snapTweenToFinal(tw);
    }
    // Snap line/area paths to exact final mark paths (not interpolated)
    // to ensure round-trip invariant
    for (const mark of nextLineMarks) {
      if (!mark.key) continue;
      const el = marksContainer!.querySelector(`[data-key="${mark.key}"]`) as SVGElement | null;
      if (el) applyFinalLinePath(el, mark);
    }
    for (const mark of nextAreaMarks) {
      if (!mark.key) continue;
      const el = marksContainer!.querySelector(`[data-key="${mark.key}"]`) as SVGElement | null;
      if (el) applyFinalAreaPaths(el, mark);
    }
  }

  function removeGhosts(): void {
    for (const ghost of ghosts) {
      ghost.parentNode?.removeChild(ghost);
    }
  }

  rafId = requestAnimationFrame(tick);

  return {
    cancel(): void {
      if (!running) return;
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      snapToFinal();
      removeGhosts();
    },
    get running() {
      return running;
    },
  };
}

// ---------------------------------------------------------------------------
// Tween state application (shared across all tween types)
// ---------------------------------------------------------------------------

function applyTweenState(
  tw: Tween,
  elapsed: number,
  update: { duration: number },
  exit: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  let tLocal: number;

  if (tw.kind === 'exit') {
    tLocal = Math.min(elapsed / exit.duration, 1);
  } else if (tw.kind === 'enter') {
    if (elapsed < enterDelay) {
      tLocal = 0;
    } else {
      tLocal = Math.min((elapsed - enterDelay) / enterDuration, 1);
    }
  } else {
    tLocal = Math.min(elapsed / update.duration, 1);
  }

  const eased = cubicOut(tLocal);

  switch (tw.tweenType) {
    case 'rect': {
      const geom = lerpGeom(tw.from, tw.to, eased);
      applyGeomToElement(tw.el, geom, tw.mark);
      break;
    }
    case 'line': {
      const pts = interpolatePoints(tw.fromPts, tw.toPts, eased);
      applyLinePath(tw.el, pts, tw.interpolate);
      break;
    }
    case 'area': {
      const top = interpolatePoints(tw.fromTop, tw.toTop, eased);
      const bottom = interpolatePoints(tw.fromBottom, tw.toBottom, eased);
      applyAreaPaths(tw.el, top, bottom, tw.interpolate, tw.hasStroke);
      break;
    }
    case 'point': {
      const cx = tw.fromCx + (tw.toCx - tw.fromCx) * eased;
      const cy = tw.fromCy + (tw.toCy - tw.fromCy) * eased;
      tw.el.setAttribute('cx', String(cx));
      tw.el.setAttribute('cy', String(cy));
      break;
    }
  }

  // Apply opacity interpolation if defined
  if (tw.fromOpacity !== undefined && tw.toOpacity !== undefined) {
    const opacity = tw.fromOpacity + (tw.toOpacity - tw.fromOpacity) * eased;
    tw.el.style.opacity = String(opacity);
  }
}

function snapTweenToFinal(tw: Tween): void {
  switch (tw.tweenType) {
    case 'rect':
      applyGeomToElement(tw.el, tw.to, tw.mark);
      break;
    case 'line':
      applyLinePath(tw.el, tw.toPts, tw.interpolate);
      break;
    case 'area':
      applyAreaPaths(tw.el, tw.toTop, tw.toBottom, tw.interpolate, tw.hasStroke);
      break;
    case 'point':
      tw.el.setAttribute('cx', String(tw.toCx));
      tw.el.setAttribute('cy', String(tw.toCy));
      break;
  }

  if (tw.toOpacity !== undefined) {
    tw.el.style.opacity = String(tw.toOpacity);
  }

  // Restore suppressed-point opacity
  if (tw.tweenType === 'point' && tw.suppressedOpacity !== undefined) {
    tw.el.setAttribute('opacity', tw.suppressedOpacity);
  }
}

// ---------------------------------------------------------------------------
// Rect tween building (extracted from original runTransition)
// ---------------------------------------------------------------------------

function buildRectTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  const prevRects = prevLayout.marks.filter((m): m is RectMark => m.type === 'rect');
  const nextRects = nextLayout.marks.filter((m): m is RectMark => m.type === 'rect');

  const prevByKey = new Map<string, RectMark>();
  for (const m of prevRects) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, RectMark>();
  for (const m of nextRects) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;
    tweens.push({
      tweenType: 'rect',
      kind: 'update',
      el,
      from: geomFromMark(prev),
      to: geomFromMark(next),
      mark: next,
    });
  }

  // Entered
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;

    let fromGeom: RectGeom;
    if (next.orient === 'horizontal') {
      fromGeom = { x: next.x, y: next.y, width: 0, height: next.height };
    } else {
      fromGeom = { x: next.x, y: next.y + next.height, width: next.width, height: 0 };
    }

    tweens.push({
      tweenType: 'rect',
      kind: 'enter',
      el,
      from: fromGeom,
      to: geomFromMark(next),
      mark: next,
    });
  }

  // Exited
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;
    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    let toGeom: RectGeom;
    if (prev.orient === 'horizontal') {
      toGeom = { x: prev.x, y: prev.y, width: 0, height: prev.height };
    } else {
      toGeom = { x: prev.x, y: prev.y + prev.height, width: prev.width, height: 0 };
    }

    tweens.push({
      tweenType: 'rect',
      kind: 'exit',
      el: ghost,
      from: geomFromMark(prev),
      to: toGeom,
      mark: prev,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Line tween building
// ---------------------------------------------------------------------------

function buildLineTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  const prevLines = prevLayout.marks.filter((m): m is LineMark => m.type === 'line');
  const nextLines = nextLayout.marks.filter((m): m is LineMark => m.type === 'line');

  const prevByKey = new Map<string, LineMark>();
  for (const m of prevLines) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, LineMark>();
  for (const m of nextLines) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated series
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;

    const prevPKs = prev.pointKeys ?? prev.points.map((_, i) => `${i}`);
    const nextPKs = next.pointKeys ?? next.points.map((_, i) => `${i}`);

    // Check if zero survivors (fully replaced dataset)
    const prevKeySet = new Set(prevPKs);
    const hasSurvivors = nextPKs.some((k) => prevKeySet.has(k));

    if (!hasSurvivors) {
      // Crossfade: fade out old (ghost), fade in new
      const ghost = renderSingleMark(prev, 0);
      if (ghost) {
        ghost.classList.add('oc-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('pointer-events', 'none');
        ghost.removeAttribute('data-key');
        marksContainer.appendChild(ghost);
        ghosts.push(ghost);

        tweens.push({
          tweenType: 'line',
          kind: 'exit',
          el: ghost,
          fromPts: prev.points,
          toPts: prev.points,
          finalPoints: prev.points,
          interpolate: prev.interpolate,
          ghost,
          fromOpacity: 1,
          toOpacity: 0,
        });
      }

      // Fade in the new one
      tweens.push({
        tweenType: 'line',
        kind: 'enter',
        el,
        fromPts: next.points,
        toPts: next.points,
        finalPoints: next.points,
        interpolate: next.interpolate,
        fromOpacity: 0,
        toOpacity: 1,
      });
    } else {
      // Normal morph with point matching
      const [fromPts, toPts] = normalizePointArrays(prev.points, next.points, prevPKs, nextPKs);

      tweens.push({
        tweenType: 'line',
        kind: 'update',
        el,
        fromPts,
        toPts,
        finalPoints: next.points,
        interpolate: next.interpolate,
      });
    }
  }

  // Entering series (only in next)
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;

    tweens.push({
      tweenType: 'line',
      kind: 'enter',
      el,
      fromPts: next.points,
      toPts: next.points,
      finalPoints: next.points,
      interpolate: next.interpolate,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting series (only in prev)
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'line',
      kind: 'exit',
      el: ghost,
      fromPts: prev.points,
      toPts: prev.points,
      finalPoints: prev.points,
      interpolate: prev.interpolate,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Area tween building
// ---------------------------------------------------------------------------

function buildAreaTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  const prevAreas = prevLayout.marks.filter((m): m is AreaMark => m.type === 'area');
  const nextAreas = nextLayout.marks.filter((m): m is AreaMark => m.type === 'area');

  const prevByKey = new Map<string, AreaMark>();
  for (const m of prevAreas) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, AreaMark>();
  for (const m of nextAreas) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated series
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;

    const prevPKs = prev.pointKeys ?? prev.topPoints.map((_, i) => `${i}`);
    const nextPKs = next.pointKeys ?? next.topPoints.map((_, i) => `${i}`);

    const prevKeySet = new Set(prevPKs);
    const hasSurvivors = nextPKs.some((k) => prevKeySet.has(k));

    const hasGradientFill = typeof next.fill !== 'string';

    if (!hasSurvivors) {
      // Crossfade
      const ghost = renderSingleMark(prev, 0);
      if (ghost) {
        ghost.classList.add('oc-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('pointer-events', 'none');
        ghost.removeAttribute('data-key');
        marksContainer.appendChild(ghost);
        ghosts.push(ghost);

        tweens.push({
          tweenType: 'area',
          kind: 'exit',
          el: ghost,
          fromTop: prev.topPoints,
          toTop: prev.topPoints,
          fromBottom: prev.bottomPoints,
          toBottom: prev.bottomPoints,
          finalTopPoints: prev.topPoints,
          finalBottomPoints: prev.bottomPoints,
          interpolate: prev.interpolate,
          hasStroke: !!prev.stroke && !!prev.topPath,
          ghost,
          fromOpacity: 1,
          toOpacity: 0,
        });
      }

      tweens.push({
        tweenType: 'area',
        kind: 'enter',
        el,
        fromTop: next.topPoints,
        toTop: next.topPoints,
        fromBottom: next.bottomPoints,
        toBottom: next.bottomPoints,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
        fromOpacity: 0,
        toOpacity: 1,
      });
    } else {
      // Morph
      const [fromTop, toTop] = normalizePointArrays(
        prev.topPoints,
        next.topPoints,
        prevPKs,
        nextPKs,
      );
      const [fromBottom, toBottom] = normalizePointArrays(
        prev.bottomPoints,
        next.bottomPoints,
        prevPKs,
        nextPKs,
      );

      // Gradient-filled areas with whole-series exit fall back to opacity fade
      if (hasGradientFill && !hasSurvivors) {
        tweens.push({
          tweenType: 'area',
          kind: 'enter',
          el,
          fromTop: next.topPoints,
          toTop: next.topPoints,
          fromBottom: next.bottomPoints,
          toBottom: next.bottomPoints,
          finalTopPoints: next.topPoints,
          finalBottomPoints: next.bottomPoints,
          interpolate: next.interpolate,
          hasStroke: !!next.stroke && !!next.topPath,
          fromOpacity: 0,
          toOpacity: 1,
        });
      } else {
        tweens.push({
          tweenType: 'area',
          kind: 'update',
          el,
          fromTop,
          toTop,
          fromBottom,
          toBottom,
          finalTopPoints: next.topPoints,
          finalBottomPoints: next.bottomPoints,
          interpolate: next.interpolate,
          hasStroke: !!next.stroke && !!next.topPath,
        });
      }
    }
  }

  // Entering series
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = marksContainer.querySelector(`[data-key="${key}"]`) as SVGElement | null;
    if (!el) continue;

    tweens.push({
      tweenType: 'area',
      kind: 'enter',
      el,
      fromTop: next.topPoints,
      toTop: next.topPoints,
      fromBottom: next.bottomPoints,
      toBottom: next.bottomPoints,
      finalTopPoints: next.topPoints,
      finalBottomPoints: next.bottomPoints,
      interpolate: next.interpolate,
      hasStroke: !!next.stroke && !!next.topPath,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting series
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'area',
      kind: 'exit',
      el: ghost,
      fromTop: prev.topPoints,
      toTop: prev.topPoints,
      fromBottom: prev.bottomPoints,
      toBottom: prev.bottomPoints,
      finalTopPoints: prev.topPoints,
      finalBottomPoints: prev.bottomPoints,
      interpolate: prev.interpolate,
      hasStroke: !!prev.stroke && !!prev.topPath,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Point tween building (overlaid circle marks on line/area charts)
// ---------------------------------------------------------------------------

function buildPointTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  const prevPoints = prevLayout.marks.filter((m): m is PointMark => m.type === 'point');
  const nextPoints = nextLayout.marks.filter((m): m is PointMark => m.type === 'point');

  const prevByKey = new Map<string, PointMark>();
  for (const m of prevPoints) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, PointMark>();
  for (const m of nextPoints) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated points: tween cx/cy
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = marksContainer.querySelector(
      `circle.oc-mark-point[data-key="${key}"]`,
    ) as SVGElement | null;
    if (!el) continue;

    // Read the element's current opacity attribute (NOT style.opacity)
    // to detect suppressed points (opacity="0" set by renderer for endpoint markers)
    const renderedOpacity = el.getAttribute('opacity');
    const isSuppressed = renderedOpacity === '0';

    tweens.push({
      tweenType: 'point',
      kind: 'update',
      el,
      fromCx: prev.cx,
      fromCy: prev.cy,
      toCx: next.cx,
      toCy: next.cy,
      // Do NOT tween opacity for updated points - preserve renderer state
      suppressedOpacity: isSuppressed ? '0' : undefined,
    });
  }

  // Entering points: fade in
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = marksContainer.querySelector(
      `circle.oc-mark-point[data-key="${key}"]`,
    ) as SVGElement | null;
    if (!el) continue;

    // Read rendered opacity for the final value
    const renderedOpacity = el.getAttribute('opacity');
    const targetOpacity = renderedOpacity != null ? Number(renderedOpacity) : 1;

    tweens.push({
      tweenType: 'point',
      kind: 'enter',
      el,
      fromCx: next.cx,
      fromCy: next.cy,
      toCx: next.cx,
      toCy: next.cy,
      fromOpacity: 0,
      toOpacity: targetOpacity,
      suppressedOpacity: renderedOpacity === '0' ? '0' : undefined,
    });
  }

  // Exiting points: ghost fade out
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'point',
      kind: 'exit',
      el: ghost,
      fromCx: prev.cx,
      fromCy: prev.cy,
      toCx: prev.cx,
      toCy: prev.cy,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}
