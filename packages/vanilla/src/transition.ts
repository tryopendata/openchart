/**
 * Data-update transition driver for bar/column, line, area, scatter/dot,
 * rule, tick, and text charts. Also transitions axis ticks, tick labels,
 * and gridlines so the whole chart adjusts as one system.
 *
 * Matches marks across layout snapshots by `key`, then animates geometry
 * changes (position, size, path) using a single rAF loop. Enter/exit/update
 * choreography runs in one timeline with cubic-out easing for a smooth
 * deceleration feel.
 *
 * For rect marks: tweens position/size directly.
 * For line/area marks: normalizes point arrays to equal length, interpolates
 * point positions per frame, and rebuilds SVG paths via d3 curve generators.
 * For point marks (scatter/dot/line overlay): tweens cx/cy/r.
 * For rule/tick marks: tweens line endpoints (x1/y1/x2/y2).
 * For text marks: tweens x/y position.
 * For axis ticks/gridlines: matches by value key and tweens positions.
 *
 * Ghost elements handle exits: cloned into the marks container, they
 * collapse + fade out then get removed. No CSS animations are used here
 * because transitions tween computed geometry, not class-toggled states.
 */

import type {
  AreaMark,
  AxisLayout,
  ChartLayout,
  GradientDef,
  LineMark,
  Point,
  PointMark,
  RectMark,
  ResolvedAnimation,
  ResolvedAnnotation,
  RuleMarkLayout,
  TextMarkLayout,
  TickMarkLayout,
} from '@opendata-ai/openchart-core';
import { isGradientDef } from '@opendata-ai/openchart-core';
import {
  buildAreaPath,
  buildLinePath,
  EXIT_DEFAULTS,
  serializeKeyValue,
} from '@opendata-ai/openchart-engine';
import { interpolateRgb } from 'd3-interpolate';
import { buildGradientDefs, resolveMarkFill } from './gradient-utils';
import { cubicOut } from './motion/easing';
import { rectPathWithCorners, renderSingleMark } from './renderers/marks';
import { flattenFill } from './scatter-canvas/state';

/**
 * Stable identity for an annotation across layout snapshots.
 *
 * Annotations have no engine-assigned `mark.key`. When the author supplies
 * `annotation.id` that is the identity; otherwise fall back to type + text,
 * which is stable as long as the annotation keeps saying the same thing.
 *
 * Deliberately NOT keyed on position: an annotation that moves is the same
 * annotation and should tween to its new spot, not cross-fade with itself.
 * And deliberately NOT `data-annotation-index`: that is positional, so
 * inserting an annotation ahead of another would renumber it and make every
 * later annotation look brand new and re-fade.
 *
 * Duplicate keys (same type and text twice) are disambiguated by occurrence
 * order in `keyAnnotations` below, not here.
 */
function annotationKey(a: ResolvedAnnotation): string {
  if (a.id) return `id:${a.id}`;
  return `${a.type}:${a.label?.text ?? ''}`;
}

/**
 * Key a layout's annotations, suffixing duplicates so every key is unique
 * within the snapshot. Two annotations sharing a key would otherwise both
 * match the same element and fight over it.
 */
function keyAnnotations(annotations: ResolvedAnnotation[]): string[] {
  const seen = new Map<string, number>();
  return annotations.map((a) => {
    const base = annotationKey(a);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Snapshot of in-flight tween geometry, keyed by mark key.
 * Used for interruption retargeting: the next transition starts from
 * whatever position the previous transition had reached.
 */
export type GeometrySnapshot = Map<string, SnapshotGeometry>;

export type SnapshotGeometry =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'point'; cx: number; cy: number; r?: number }
  | { type: 'rule'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'tick'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'textMark'; x: number; y: number }
  | { type: 'line'; d: string }
  | { type: 'area'; d: string; topD?: string };

export interface TransitionHandle {
  cancel(): void;
  readonly running: boolean;
  /** Capture current interpolated geometry for all in-flight tweens. */
  snapshot(): GeometrySnapshot;
  /**
   * Apply the transition's DOM state at an explicit elapsed time (ms), without
   * the rAF clock. Only meaningful when the transition was started with
   * `manual: true` (which suppresses the internal rAF loop). Used by headless
   * frame capture (GIF export) to sample the tween deterministically at each
   * frame's timestamp. Returns true while the transition is still in progress
   * (elapsed < total), false once it has reached its end.
   */
  step(elapsedMs: number): boolean;
  /** The transition's total duration in ms (update/exit, whichever is longer). */
  readonly totalMs: number;
}

// ---------------------------------------------------------------------------
// canTransition gate
// ---------------------------------------------------------------------------

/** Mark types that support data-update transitions. */
const TRANSITIONABLE_MARKS = new Set(['bar', 'line', 'area', 'point']);

/**
 * Default cap on the mark count that still runs a tweened data-update
 * transition. Override per chart with `animation.update.maxMarks`.
 */
export const DEFAULT_UPDATE_MAX_MARKS = 500;

/**
 * Default cap when the destination layout renders its points on canvas.
 *
 * Two orders of magnitude above the SVG cap because the cost model is
 * different: a canvas frame writes into typed arrays and issues one batched
 * fill per color bucket, where the SVG path writes attributes on one DOM
 * element per mark. The cap that keeps low-end devices honest for DOM writes
 * would veto exactly the high-cardinality morphs canvas mode exists to serve.
 */
export const CANVAS_DEFAULT_UPDATE_MAX_MARKS = 20_000;

/**
 * Spec-shape half of the transition gate (mark type + encoding identity),
 * usable before either spec has been compiled. Exported so callers that
 * need to predict transition eligibility ahead of a compile (e.g. the
 * scrollytelling story layer deciding whether to arm its crossfade
 * fallback) can reuse the exact same rule the post-compile gate enforces,
 * rather than re-deriving it and risking drift.
 *
 * This is gate checks 3-4 of `canTransition` in isolation; it does NOT
 * check layout-derived conditions (dimensions, mark count, geometry delta,
 * sparkline display) since those require a compiled `ChartLayout`.
 */
export function canTransitionSpecShape(prevSpec: unknown, nextSpec: unknown): boolean {
  const prev = prevSpec as Record<string, unknown>;
  const next = nextSpec as Record<string, unknown>;
  if (!prev || !next || !('mark' in prev) || !('mark' in next)) return false;
  const prevMark =
    typeof prev.mark === 'string' ? prev.mark : (prev.mark as Record<string, unknown>)?.type;
  const nextMark =
    typeof next.mark === 'string' ? next.mark : (next.mark as Record<string, unknown>)?.type;
  if (prevMark !== nextMark) return false;
  if (!TRANSITIONABLE_MARKS.has(prevMark as string)) return false;

  const prevEnc = (prev as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  const nextEnc = (next as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  if (!prevEnc || !nextEnc) return false;
  return !(
    prevEnc.x?.field !== nextEnc.x?.field ||
    prevEnc.x?.type !== nextEnc.x?.type ||
    prevEnc.y?.field !== nextEnc.y?.field ||
    prevEnc.y?.type !== nextEnc.y?.type ||
    prevEnc.color?.field !== nextEnc.color?.field
  );
}

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

  // 3-4. Mark type + encoding identity unchanged (spec-shape half of the gate)
  if (!canTransitionSpecShape(prevSpec, nextSpec)) return false;

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

  // 8. Mark count within the update cap. Per-frame SVG attribute writes on
  //    thousands of elements drop frames on low-end devices, so past the cap
  //    the caller falls through to an instant swap.
  //
  //    The cap comes from the DESTINATION mode, and so do exit ghosts -- they
  //    are rendered into the next layout's surface. That makes the count that
  //    matters `max(prev, next)`, not `next` alone: a 4,341-point canvas chart
  //    updating down to 400 SVG points looks cheap by `next`, but the update
  //    would mint ~3,941 SVG ghost circles, which is precisely the jank this
  //    cap exists to prevent. (svg -> canvas needs no such guard: the canvas
  //    cap applies and the exits paint on canvas.)
  const cap =
    nextLayout.animation.update.maxMarks ??
    (nextLayout.markRenderMode === 'canvas'
      ? CANVAS_DEFAULT_UPDATE_MAX_MARKS
      : DEFAULT_UPDATE_MAX_MARKS);
  if (Math.max(prevLayout.marks.length, nextLayout.marks.length) > cap) return false;

  // 9. Something visible actually changed (zero-delta check)
  if (!hasVisibleChange(prevLayout, nextLayout)) return false;

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

/**
 * Check whether anything the transition can animate differs between layouts.
 *
 * Gate check 9. This is broader than geometry on purpose: a step that only
 * recolors (an `encoding.color.highlight` mute) or only adds an annotation
 * moves no mark by a single pixel. Testing geometry alone reported "nothing
 * changed" for those, vetoing the transition and leaving `render()`'s instant
 * swap as the only thing that happened -- so the highlight snapped and the
 * annotation popped in, even though the machinery to fade both already existed
 * further down this file.
 */
function hasVisibleChange(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  return (
    hasGeometryChanged(prevLayout, nextLayout) ||
    hasColorChanged(prevLayout, nextLayout) ||
    hasAnnotationChanged(prevLayout, nextLayout)
  );
}

/** Check if any mark's fill or stroke differs (e.g. a highlight mute). */
function hasColorChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prevMarks = prevLayout.marks;
  const nextMarks = nextLayout.marks;
  if (prevMarks.length !== nextMarks.length) return true;

  for (let i = 0; i < prevMarks.length; i++) {
    const p = prevMarks[i] as { fill?: string; stroke?: string };
    const n = nextMarks[i] as { fill?: string; stroke?: string };
    if (p.fill !== n.fill || p.stroke !== n.stroke) return true;
  }
  return false;
}

/** Check if annotations were added, removed, reordered, or moved. */
function hasAnnotationChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prev = prevLayout.annotations ?? [];
  const next = nextLayout.annotations ?? [];
  if (prev.length !== next.length) return true;

  const prevKeys = keyAnnotations(prev);
  const nextKeys = keyAnnotations(next);

  for (let i = 0; i < prev.length; i++) {
    if (prevKeys[i] !== nextKeys[i]) return true;
    const p = prev[i];
    const n = next[i];
    if (p.label?.x !== n.label?.x || p.label?.y !== n.label?.y) return true;
    if (p.opacity !== n.opacity) return true;
  }
  return false;
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
      if (p.cx !== n.cx || p.cy !== n.cy || p.r !== n.r) return true;
    } else if (p.type === 'rule' && n.type === 'rule') {
      if (p.x1 !== n.x1 || p.y1 !== n.y1 || p.x2 !== n.x2 || p.y2 !== n.y2) return true;
    } else if (p.type === 'tick' && n.type === 'tick') {
      if (p.x !== n.x || p.y !== n.y) return true;
    } else if (p.type === 'textMark' && n.type === 'textMark') {
      if (p.x !== n.x || p.y !== n.y) return true;
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
  fromR?: number;
  toR?: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
  /** Whether this point has a renderer-set opacity (e.g. suppressed under endpoint marker). */
  suppressedOpacity?: string;
}

interface RuleTween {
  tweenType: 'rule';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromX1: number;
  fromY1: number;
  fromX2: number;
  fromY2: number;
  toX1: number;
  toY1: number;
  toX2: number;
  toY2: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface TickTween {
  tweenType: 'tick';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromX1: number;
  fromY1: number;
  fromX2: number;
  fromY2: number;
  toX1: number;
  toY1: number;
  toX2: number;
  toY2: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface TextMarkTween {
  tweenType: 'textMark';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface AxisTickTween {
  tweenType: 'axisTick';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  /** Position attribute name: 'x' for x-axis ticks, 'y' for y-axis ticks. */
  posAttr: string;
  fromPos: number;
  toPos: number;
  /** Whether to crossfade instead of slide (for rotated labels). */
  crossfade: boolean;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

interface GridlineTween {
  tweenType: 'gridline';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  /** Which attrs to tween: 'y' for horizontal gridlines, 'x' for vertical. */
  orientation: 'x' | 'y';
  fromPos: number;
  toPos: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

/**
 * Fill/stroke interpolation, kept separate from the geometry tweens rather
 * than bolted onto each of them.
 *
 * Color is orthogonal to geometry: a highlight mute recolors marks that do not
 * move, and a normal data update moves marks that do not recolor. Threading
 * from/to colors through all nine geometry variants would touch every builder
 * to express something none of them need. A parallel tween on the same rAF
 * loop composes instead -- a mark that both moves and recolors simply gets two
 * tweens, each doing one job.
 *
 * Targets the shape element (rect/path/circle/line) rather than the mark <g>,
 * since that is where the renderer writes fill and stroke.
 */
interface ColorTween {
  tweenType: 'color';
  kind: 'update';
  el: SVGElement;
  attr: 'fill' | 'stroke';
  from: string;
  to: string;
  /** Never set; present so the shared opacity step can read the union. */
  fromOpacity?: number;
  toOpacity?: number;
}

/**
 * Annotation enter/update/exit. Entering annotations fade in, surviving ones
 * tween to their new position, exiting ones fade out.
 */
interface AnnotationTween {
  tweenType: 'annotation';
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  /** Pixel delta applied as a transform; annotations position via many child attrs. */
  fromDx: number;
  fromDy: number;
  ghost?: SVGElement;
  fromOpacity?: number;
  toOpacity?: number;
}

/**
 * The slice of `ScatterCanvasLayer` a transition needs.
 *
 * Declared structurally here rather than imported from `./scatter-canvas/layer`
 * so the dependency runs one way: the layer knows nothing about transitions,
 * and transitions know nothing about how the layer is built.
 */
export interface CanvasLayerLike {
  state: {
    marks: {
      n: number;
      x: Float32Array;
      y: Float32Array;
      r: Float32Array;
      keys: (string | undefined)[];
    };
    gridlines: { orient: 'x' | 'y'; position: number; alpha: number }[];
    enterAlpha: Float32Array | null;
    exiting: {
      x: Float32Array;
      y: Float32Array;
      r: Float32Array;
      fill: string[];
      alpha: number;
    } | null;
  };
  repaint(): void;
  rebuildIndex(): void;
  setInteractionSuspended(suspended: boolean): void;
}

/**
 * Gridline enter/update/exit for a canvas mark layer.
 *
 * Same value-keyed matching as the SVG path (`computeGridlineDeltas`), writing
 * interpolated position and alpha into `layer.state.gridlines` instead of onto
 * `<line>` elements. Tick LABELS keep their SVG tween and share this clock, so
 * a label and its gridline never separate.
 */
interface CanvasGridlinesTween {
  tweenType: 'canvasGridlines';
  kind: 'update';
  layer: CanvasLayerLike;
  /** Index into `layer.state.gridlines`, one entry per gridline it drives. */
  index: Uint32Array;
  fromPos: Float32Array;
  toPos: Float32Array;
  fromAlpha: Float32Array;
  toAlpha: Float32Array;
  /** Never set; present so the shared opacity step can read the union. */
  fromOpacity?: number;
  toOpacity?: number;
}

/**
 * Point enter/update/exit for a canvas mark layer.
 *
 * One tween record covers EVERY point, not one per point: at 4k+ marks the
 * per-tween array walk and the per-point closure allocation are the frame
 * budget. Geometry is packed into parallel typed arrays and lerped inline, and
 * the results are written straight into the layer's SoA -- no DOM, no objects,
 * no allocation per frame.
 */
interface CanvasPointsTween {
  tweenType: 'canvasPoints';
  /**
   * Always `'update'`: enters and exits are folded into this single record and
   * timed internally against their own phase clocks. `kind` still has to be a
   * union member so the shared `applyTweenState` prologue can read it.
   */
  kind: 'update';
  layer: CanvasLayerLike;
  /** Index into the layer's SoA per SURVIVING point. */
  soaIndex: Uint32Array;
  fromCx: Float32Array;
  fromCy: Float32Array;
  fromR: Float32Array;
  toCx: Float32Array;
  toCy: Float32Array;
  toR: Float32Array;
  /** Key per surviving point, parallel to `soaIndex`, for `snapshot()`. */
  soaKeys: string[];
  /** Index into the layer's SoA per ENTERING point (fades in, does not move). */
  enterSoaIndex: Uint32Array;
  /**
   * Exit ghost state, painted from the PREV layout under the live points.
   * Preallocated once; only `.alpha` is mutated per frame (the geometry arrays
   * never change, and allocating a fresh record at 60fps is exactly the cost
   * the typed-array design avoids). Null when nothing exits.
   */
  exitState: {
    x: Float32Array;
    y: Float32Array;
    r: Float32Array;
    fill: string[];
    alpha: number;
  } | null;
  /** Never set; present so the shared opacity step can read the union. */
  fromOpacity?: number;
  toOpacity?: number;
}

type Tween =
  | RectTween
  | LineTween
  | AreaTween
  | PointTween
  | RuleTween
  | TickTween
  | TextMarkTween
  | AxisTickTween
  | GridlineTween
  | ColorTween
  | AnnotationTween
  | CanvasPointsTween
  | CanvasGridlinesTween;

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
function mergeKeyOrder(prevKeys: string[], nextKeys: string[]): string[] {
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
function findInsertionPosition(
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
function findRemovalPosition(
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
// Mark DOM index
// ---------------------------------------------------------------------------

/**
 * One-pass index of `[data-key]` mark elements, built once per transition and
 * shared by every tween builder plus `snapToFinal`. Replaces per-key
 * `querySelector` calls, which were O(marks x DOM nodes) and threw a
 * SyntaxError when a data value contained `"` or `\` (keys are raw String(v)
 * from the engine, never escaped).
 *
 * The same key can legitimately appear on different mark types (a rule and its
 * text label both keyed on the category), so class-qualified buckets mirror the
 * class-qualified selectors they replace. Exit ghosts strip `data-key` before
 * they are appended, so the index never sees them.
 */
interface MarkDomIndex {
  /** First element in document order with this key (querySelector parity). */
  any(key: string): SVGElement | null;
  point(key: string): SVGElement | null; // circle.oc-mark-point
  rule(key: string): SVGElement | null; // .oc-mark-rule
  tick(key: string): SVGElement | null; // .oc-mark-tick
  text(key: string): SVGElement | null; // .oc-mark-text
}

function buildMarkDomIndex(marksContainer: SVGElement): MarkDomIndex {
  const anyM = new Map<string, SVGElement>();
  const pointM = new Map<string, SVGElement>();
  const ruleM = new Map<string, SVGElement>();
  const tickM = new Map<string, SVGElement>();
  const textM = new Map<string, SVGElement>();
  for (const node of marksContainer.querySelectorAll('[data-key]')) {
    const el = node as SVGElement;
    const key = el.getAttribute('data-key');
    if (!key) continue;
    if (!anyM.has(key)) anyM.set(key, el);
    const cl = el.classList;
    if (el.tagName === 'circle' && cl.contains('oc-mark-point')) {
      if (!pointM.has(key)) pointM.set(key, el);
    } else if (cl.contains('oc-mark-rule')) {
      if (!ruleM.has(key)) ruleM.set(key, el);
    } else if (cl.contains('oc-mark-tick')) {
      if (!tickM.has(key)) tickM.set(key, el);
    } else if (cl.contains('oc-mark-text')) {
      if (!textM.has(key)) textM.set(key, el);
    }
  }
  const g = (m: Map<string, SVGElement>) => (key: string) => m.get(key) ?? null;
  return { any: g(anyM), point: g(pointM), rule: g(ruleM), tick: g(tickM), text: g(textM) };
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
  /** Snapshot from a cancelled in-flight transition for retargeting. */
  fromSnapshot?: GeometrySnapshot;
  /**
   * Suppress the internal rAF loop; the caller drives the transition via
   * `handle.step(elapsedMs)`. Used by headless frame capture. `onComplete` is
   * NOT called automatically in manual mode — the caller finalizes by stepping
   * to `totalMs` (which snaps to final) or calling `cancel()`.
   */
  manual?: boolean;
  /**
   * The canvas mark layer, when the NEXT layout renders points on canvas. Point
   * geometry is then tweened into `canvas.state` instead of onto SVG circles,
   * and this one rAF loop paints it — the layer's own scheduler stays idle for
   * the duration (entrance blocks transitions; hover is suspended).
   */
  canvas?: CanvasLayerLike;
}): TransitionHandle {
  const { svg, prevLayout, nextLayout, animation, onComplete, fromSnapshot, manual, canvas } = args;
  const update = animation.update!;
  const exit = animation.exit ?? { ...EXIT_DEFAULTS };

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
      snapshot() {
        return new Map();
      },
      step() {
        return false;
      },
      totalMs: 0,
    };
  }

  // One DOM pass for every keyed mark element; valid for the whole transition
  // (the transition owns the DOM until onComplete, and ghosts carry no data-key).
  const dom = buildMarkDomIndex(marksContainer);

  // Build all tweens
  const tweens: Tween[] = [];
  const ghosts: SVGElement[] = [];

  // Fix gradient ghosts: ensure exiting marks with gradient fills have valid
  // gradient defs in the new SVG. Build any missing gradients into <defs>.
  const defs = svg.querySelector('defs') as SVGElement | null;
  let ghostGradientMap = new Map<string, string>();
  if (defs) {
    // Collect gradient fills from exiting marks (marks in prev but not next)
    const nextKeySet = new Set(nextLayout.marks.filter((m) => m.key).map((m) => m.key));
    const exitingMarks = prevLayout.marks.filter(
      (m) => m.key && !nextKeySet.has(m.key) && 'fill' in m,
    );
    const gradientMarks = exitingMarks.filter(
      (m) => 'fill' in m && isGradientDef((m as { fill: unknown }).fill),
    );
    if (gradientMarks.length > 0) {
      ghostGradientMap = buildGradientDefs(gradientMarks as Array<{ fill?: unknown }>, defs);
    }
  }

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
  const hasRules =
    prevLayout.marks.some((m) => m.type === 'rule') ||
    nextLayout.marks.some((m) => m.type === 'rule');
  const hasTicks =
    prevLayout.marks.some((m) => m.type === 'tick') ||
    nextLayout.marks.some((m) => m.type === 'tick');
  const hasTextMarks =
    prevLayout.marks.some((m) => m.type === 'textMark') ||
    nextLayout.marks.some((m) => m.type === 'textMark');

  if (hasRects) {
    buildRectTweens(
      prevLayout,
      nextLayout,
      marksContainer,
      dom,
      tweens,
      ghosts,
      ghostGradientMap,
      fromSnapshot,
    );
  }
  if (hasLines) {
    buildLineTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasAreas) {
    buildAreaTweens(
      prevLayout,
      nextLayout,
      marksContainer,
      dom,
      tweens,
      ghosts,
      ghostGradientMap,
      fromSnapshot,
    );
  }
  if (hasPoints) {
    // Either/or, never both: in canvas mode the SVG carries no point circles
    // for the DOM builder to find, and every point (including exit ghosts)
    // lives on the layer.
    if (canvas) {
      buildCanvasPointsTween(prevLayout, nextLayout, canvas, tweens, fromSnapshot);
    } else {
      buildPointTweens(
        prevLayout,
        nextLayout,
        marksContainer,
        dom,
        tweens,
        ghosts,
        ghostGradientMap,
        fromSnapshot,
      );
    }
  }
  if (hasRules) {
    buildRuleTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasTicks) {
    buildTickTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasTextMarks) {
    buildTextMarkTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }

  // Axis tick/gridline transitions. In canvas mode the SVG axes carry tick
  // labels but no gridlines (the layer paints those), so both run: the SVG pass
  // finds zero `.oc-gridline` elements and only tweens labels.
  buildAxisTweens(svg, prevLayout, nextLayout, tweens, ghosts);
  if (canvas) {
    buildCanvasGridlinesTween(prevLayout, nextLayout, canvas, tweens);
  }

  // Mark fill/stroke (a highlight mute recolors marks that never move)
  buildColorTweens(prevLayout, nextLayout, dom, tweens);

  // Annotations: keyed diff, so only NEW annotations fade in and surviving
  // ones hold steady instead of blinking.
  buildAnnotationTweens(svg, prevLayout, nextLayout, tweens);

  // Secondary element crossfade: endpoint labels and mark labels still use the
  // blanket fade (annotations were promoted to the keyed path above).
  const secondaryEls = collectSecondaryElements(svg);
  // Store original opacities so we can restore them on completion
  const secondaryOriginalOpacity = secondaryEls.map((el) => el.style.opacity ?? '');

  // Apply all from-states SYNCHRONOUSLY before scheduling the first rAF
  for (const tw of tweens) {
    applyTweenState(tw, 0, update, exit, enterDelay, enterDuration);
  }
  // ...and paint them. The state writes above only rewind the layer's data; the
  // bitmap still shows the final state until something repaints. Relying on
  // rAF-runs-before-paint is an accident of ordering, and manual mode has no
  // paint at all between beginManualUpdate() and the first step().
  canvas?.repaint();
  // Hit-testing is off while marks are in motion: the spatial index still
  // describes the destination layout, and rebuilding it per frame at 4k points
  // is exactly the cost the canvas layer exists to avoid.
  canvas?.setInteractionSuspended(true);
  // Set secondary elements to invisible at start
  for (const el of secondaryEls) {
    el.style.opacity = '0';
  }

  // Animation loop state
  let rafId: number | null = null;
  let running = true;
  let startTime: number | null = null;
  let lastElapsed = 0;

  // Track line/area marks that need final path snapping
  const nextLineMarks = nextLayout.marks.filter((m): m is LineMark => m.type === 'line');
  const nextAreaMarks = nextLayout.marks.filter((m): m is AreaMark => m.type === 'area');

  function tick(now: number): void {
    if (!running) return;
    if (startTime === null) startTime = now;

    const elapsed = now - startTime;
    lastElapsed = elapsed;
    const tGlobal = Math.min(elapsed / totalMs, 1);

    for (const tw of tweens) {
      applyTweenState(tw, elapsed, update, exit, enterDelay, enterDuration);
    }

    // Crossfade secondary elements: delayed 40%, over 60% of update duration
    applySecondaryOpacity(secondaryEls, elapsed, enterDelay, enterDuration);

    // One paint per frame, after every tween has written its state.
    canvas?.repaint();

    if (tGlobal >= 1) {
      finish();
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  /** Settle the canvas layer: repaint the final state, re-index, re-arm hover. */
  function settleCanvas(): void {
    if (!canvas) return;
    canvas.repaint();
    canvas.rebuildIndex();
    canvas.setInteractionSuspended(false);
  }

  function finish(): void {
    if (!running) return;
    running = false;
    rafId = null;

    snapToFinal();
    removeGhosts();
    settleCanvas();
    // Restore secondary element opacities to their rendered values
    for (let i = 0; i < secondaryEls.length; i++) {
      secondaryEls[i].style.opacity = secondaryOriginalOpacity[i];
    }
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
      const el = dom.any(mark.key);
      if (el) applyFinalLinePath(el, mark);
    }
    for (const mark of nextAreaMarks) {
      if (!mark.key) continue;
      const el = dom.any(mark.key);
      if (el) applyFinalAreaPaths(el, mark);
    }
  }

  function removeGhosts(): void {
    for (const ghost of ghosts) {
      ghost.parentNode?.removeChild(ghost);
    }
  }

  /** Capture the current interpolated geometry of all in-flight tweens. */
  function captureSnapshot(): GeometrySnapshot {
    const snap: GeometrySnapshot = new Map();
    const tUpdate = Math.min(lastElapsed / update.duration, 1);
    const easedUpdate = cubicOut(tUpdate);

    for (const tw of tweens) {
      if (tw.kind !== 'update') continue;

      // Canvas points snapshot per-point from the packed arrays. The emitted
      // entries are plain `{type:'point'}` -- identical to what the SVG path
      // emits -- so an interrupted transition retargets correctly even across
      // an svg <-> canvas mode flip.
      if (tw.tweenType === 'canvasPoints') {
        for (let s = 0; s < tw.soaIndex.length; s++) {
          snap.set(tw.soaKeys[s], {
            type: 'point',
            cx: tw.fromCx[s] + (tw.toCx[s] - tw.fromCx[s]) * easedUpdate,
            cy: tw.fromCy[s] + (tw.toCy[s] - tw.fromCy[s]) * easedUpdate,
            r: tw.fromR[s] + (tw.toR[s] - tw.fromR[s]) * easedUpdate,
          });
        }
        continue;
      }

      const key = getKeyForTween(tw);
      if (!key) continue;

      switch (tw.tweenType) {
        case 'rect': {
          const g = lerpGeom(tw.from, tw.to, easedUpdate);
          snap.set(key, { type: 'rect', ...g });
          break;
        }
        case 'point': {
          const cx = tw.fromCx + (tw.toCx - tw.fromCx) * easedUpdate;
          const cy = tw.fromCy + (tw.toCy - tw.fromCy) * easedUpdate;
          const entry: SnapshotGeometry = { type: 'point', cx, cy };
          if (tw.fromR !== undefined && tw.toR !== undefined) {
            entry.r = tw.fromR + (tw.toR - tw.fromR) * easedUpdate;
          }
          snap.set(key, entry);
          break;
        }
        case 'rule':
        case 'tick': {
          snap.set(key, {
            type: tw.tweenType,
            x1: tw.fromX1 + (tw.toX1 - tw.fromX1) * easedUpdate,
            y1: tw.fromY1 + (tw.toY1 - tw.fromY1) * easedUpdate,
            x2: tw.fromX2 + (tw.toX2 - tw.fromX2) * easedUpdate,
            y2: tw.fromY2 + (tw.toY2 - tw.fromY2) * easedUpdate,
          });
          break;
        }
        case 'textMark': {
          snap.set(key, {
            type: 'textMark',
            x: tw.fromX + (tw.toX - tw.fromX) * easedUpdate,
            y: tw.fromY + (tw.toY - tw.fromY) * easedUpdate,
          });
          break;
        }
        case 'line': {
          // Freeze the current interpolated path string
          const pts = interpolatePoints(tw.fromPts, tw.toPts, easedUpdate);
          const d = buildLinePath(pts, tw.interpolate);
          snap.set(key, { type: 'line', d });
          break;
        }
        case 'area': {
          const top = interpolatePoints(tw.fromTop, tw.toTop, easedUpdate);
          const bottom = interpolatePoints(tw.fromBottom, tw.toBottom, easedUpdate);
          const d = buildAreaPath(top, bottom, tw.interpolate);
          let topD: string | undefined;
          if (tw.hasStroke) {
            topD = buildLinePath(top, tw.interpolate);
          }
          snap.set(key, { type: 'area', d, topD });
          break;
        }
      }
    }
    return snap;
  }

  // In manual mode the caller drives the transition via `step()`; skip the rAF
  // clock entirely. Otherwise start the normal real-time animation.
  if (!manual) {
    rafId = requestAnimationFrame(tick);
  }

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
      settleCanvas();
      // Restore secondary element opacities on cancel
      for (let i = 0; i < secondaryEls.length; i++) {
        secondaryEls[i].style.opacity = secondaryOriginalOpacity[i];
      }
    },
    get running() {
      return running;
    },
    snapshot(): GeometrySnapshot {
      return captureSnapshot();
    },
    step(elapsedMs: number): boolean {
      // Apply the same per-tween state the rAF `tick` computes, at an explicit
      // time. No requestAnimationFrame — the caller (headless capture) rasterizes
      // between steps. Mirrors tick()'s body minus the rAF scheduling.
      lastElapsed = elapsedMs;
      for (const tw of tweens) {
        applyTweenState(tw, elapsedMs, update, exit, enterDelay, enterDuration);
      }
      applySecondaryOpacity(secondaryEls, elapsedMs, enterDelay, enterDuration);
      if (elapsedMs >= totalMs) {
        // Snap to exact final geometry (paths, ghosts removed) so the last frame
        // is pixel-correct, but do NOT flip `running` — the caller decides when
        // to finalize the manual run via `cancel()`.
        snapToFinal();
        removeGhosts();
        settleCanvas();
        return false;
      }
      // Manual mode rasterizes between steps with no rAF in between, so the
      // paint has to happen here or the captured frame is a stale bitmap.
      canvas?.repaint();
      return true;
    },
    totalMs,
  };
}

// ---------------------------------------------------------------------------
// Secondary element helpers
// ---------------------------------------------------------------------------

/**
 * Collect endpoint-label and mark-label groups for the blanket crossfade.
 *
 * Annotations used to be in here, which is why an annotation that was already
 * on screen blinked out and back in on every update: the blanket fade drives
 * every element it collects from opacity 0, with no notion of which ones are
 * actually new. They now go through `buildAnnotationTweens` instead, which
 * diffs them by key. Do not re-add them here -- the blanket fade runs after the
 * tweens and would clobber the keyed opacity.
 */
function collectSecondaryElements(svg: SVGSVGElement): SVGElement[] {
  const els: SVGElement[] = [];
  const epLabels = svg.querySelector('.oc-endpoint-labels') as SVGElement | null;
  if (epLabels) els.push(epLabels);
  const markLabels = svg.querySelector('.oc-mark-labels') as SVGElement | null;
  if (markLabels) els.push(markLabels);
  return els;
}

/** Apply delayed fade-in to secondary elements during transition. */
function applySecondaryOpacity(
  els: SVGElement[],
  elapsed: number,
  enterDelay: number,
  enterDuration: number,
): void {
  if (els.length === 0) return;
  let t: number;
  if (elapsed < enterDelay) {
    t = 0;
  } else {
    t = Math.min((elapsed - enterDelay) / enterDuration, 1);
  }
  const opacity = String(cubicOut(t));
  for (const el of els) {
    el.style.opacity = opacity;
  }
}

/** Get the data-key for a tween's element (used for snapshot keying). */
function getKeyForTween(tw: Tween): string | null {
  // Canvas points are keyed per-point inside the record, not per-element.
  if (tw.tweenType === 'canvasPoints' || tw.tweenType === 'canvasGridlines') return null;
  if ('ghost' in tw && tw.ghost) return null; // ghosts don't carry keys
  return tw.el.getAttribute('data-key');
}

// ---------------------------------------------------------------------------
// Tween state application (shared across all tween types)
// ---------------------------------------------------------------------------

function resolveLineElement(el: SVGElement): SVGElement {
  return el.tagName === 'line' ? el : ((el.querySelector('line') as SVGElement) ?? el);
}

function applyTweenState(
  tw: Tween,
  elapsed: number,
  update: { duration: number },
  exit: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  // Canvas points carry all three phases in one record and have no element for
  // the shared geometry/opacity steps below to write to, so they short-circuit.
  if (tw.tweenType === 'canvasPoints') {
    applyCanvasPointsState(tw, elapsed, update, exit, enterDelay, enterDuration);
    return;
  }
  if (tw.tweenType === 'canvasGridlines') {
    applyCanvasGridlinesState(tw, elapsed, update, enterDelay, enterDuration);
    return;
  }

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
      if (tw.fromR !== undefined && tw.toR !== undefined) {
        const r = tw.fromR + (tw.toR - tw.fromR) * eased;
        tw.el.setAttribute('r', String(r));
      }
      break;
    }
    case 'rule':
    case 'tick': {
      const lineEl = resolveLineElement(tw.el);
      lineEl.setAttribute('x1', String(tw.fromX1 + (tw.toX1 - tw.fromX1) * eased));
      lineEl.setAttribute('y1', String(tw.fromY1 + (tw.toY1 - tw.fromY1) * eased));
      lineEl.setAttribute('x2', String(tw.fromX2 + (tw.toX2 - tw.fromX2) * eased));
      lineEl.setAttribute('y2', String(tw.fromY2 + (tw.toY2 - tw.fromY2) * eased));
      break;
    }
    case 'textMark': {
      const x = tw.fromX + (tw.toX - tw.fromX) * eased;
      const y = tw.fromY + (tw.toY - tw.fromY) * eased;
      tw.el.setAttribute('x', String(x));
      tw.el.setAttribute('y', String(y));
      break;
    }
    case 'axisTick': {
      if (tw.crossfade) {
        // Crossfade: only tween opacity, don't move
        break;
      }
      const pos = tw.fromPos + (tw.toPos - tw.fromPos) * eased;
      if (tw.posAttr === 'x') {
        tw.el.setAttribute('x', String(pos));
      } else {
        tw.el.setAttribute('y', String(pos));
      }
      break;
    }
    case 'gridline': {
      const pos = tw.fromPos + (tw.toPos - tw.fromPos) * eased;
      if (tw.orientation === 'y') {
        // Horizontal gridline: y1 and y2 share the same position
        tw.el.setAttribute('y1', String(pos));
        tw.el.setAttribute('y2', String(pos));
      } else {
        // Vertical gridline: x1 and x2 share the same position
        tw.el.setAttribute('x1', String(pos));
        tw.el.setAttribute('x2', String(pos));
      }
      break;
    }
    case 'color': {
      tw.el.setAttribute(tw.attr, interpolateRgb(tw.from, tw.to)(eased));
      break;
    }
    case 'annotation': {
      // Ease the offset back to zero: the group is already rendered at its
      // final position, so (0,0) is the destination. SVG transform attribute,
      // not CSS -- CSS transform would replace any SVG transform attribute
      // (see .claude/rules/svg-animation.md), and this composes cleanly since
      // the annotations renderer sets none.
      const dx = tw.fromDx * (1 - eased);
      const dy = tw.fromDy * (1 - eased);
      if (dx !== 0 || dy !== 0) {
        tw.el.setAttribute('transform', `translate(${dx} ${dy})`);
      }
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
  // No element; the shared opacity/suppressed-point steps below would throw.
  if (tw.tweenType === 'canvasPoints') {
    snapCanvasPointsToFinal(tw);
    return;
  }
  if (tw.tweenType === 'canvasGridlines') {
    snapCanvasGridlinesToFinal(tw);
    return;
  }

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
      if (tw.toR !== undefined) {
        tw.el.setAttribute('r', String(tw.toR));
      }
      break;
    case 'rule':
    case 'tick': {
      const lineEl = resolveLineElement(tw.el);
      lineEl.setAttribute('x1', String(tw.toX1));
      lineEl.setAttribute('y1', String(tw.toY1));
      lineEl.setAttribute('x2', String(tw.toX2));
      lineEl.setAttribute('y2', String(tw.toY2));
      break;
    }
    case 'textMark':
      tw.el.setAttribute('x', String(tw.toX));
      tw.el.setAttribute('y', String(tw.toY));
      break;
    case 'axisTick':
      if (!tw.crossfade) {
        if (tw.posAttr === 'x') {
          tw.el.setAttribute('x', String(tw.toPos));
        } else {
          tw.el.setAttribute('y', String(tw.toPos));
        }
      }
      break;
    case 'gridline':
      if (tw.orientation === 'y') {
        tw.el.setAttribute('y1', String(tw.toPos));
        tw.el.setAttribute('y2', String(tw.toPos));
      } else {
        tw.el.setAttribute('x1', String(tw.toPos));
        tw.el.setAttribute('x2', String(tw.toPos));
      }
      break;
    case 'color':
      tw.el.setAttribute(tw.attr, tw.to);
      break;
    case 'annotation':
      // The group is rendered at its final position; drop the offset entirely
      // rather than writing translate(0 0), so the DOM returns to the exact
      // shape render() produced.
      tw.el.removeAttribute('transform');
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
// Gradient ghost helper
// ---------------------------------------------------------------------------

/**
 * For marks with gradient fills, resolve the gradient to a url(#id) reference
 * using the ghost gradient map. This ensures ghosts reference valid gradient
 * IDs in the new SVG's <defs>.
 */
function resolveGhostGradientFill<T extends { fill?: string | GradientDef }>(
  mark: T,
  ghostGradientMap: Map<string, string>,
): T {
  if (!mark.fill || typeof mark.fill === 'string' || ghostGradientMap.size === 0) return mark;
  const resolved = resolveMarkFill(mark.fill, ghostGradientMap);
  return { ...mark, fill: resolved };
}

// ---------------------------------------------------------------------------
// Rect tween building (extracted from original runTransition)
// ---------------------------------------------------------------------------

function buildRectTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
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
    const el = dom.any(key);
    if (!el) continue;

    // Retarget: use snapshot geometry if available (interrupted transition)
    let fromGeom = geomFromMark(prev);
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'rect') {
      fromGeom = { x: snap.x, y: snap.y, width: snap.width, height: snap.height };
    }

    tweens.push({
      tweenType: 'rect',
      kind: 'update',
      el,
      from: fromGeom,
      to: geomFromMark(next),
      mark: next,
    });
  }

  // Entered
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.any(key);
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
    // Resolve gradient fill for ghost if needed
    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
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
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
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
    const el = dom.any(key);
    if (!el) continue;

    // If interrupted mid-morph, freeze the current path and crossfade
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'line') {
      // Create ghost carrying the frozen mid-morph path
      const ghost = el.cloneNode(true) as SVGElement;
      ghost.classList.add('oc-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('pointer-events', 'none');
      ghost.removeAttribute('data-key');
      const ghostPath = ghost.querySelector('path');
      if (ghostPath) ghostPath.setAttribute('d', snap.d);
      marksContainer.appendChild(ghost);
      ghosts.push(ghost);

      tweens.push({
        tweenType: 'line',
        kind: 'exit',
        el: ghost,
        fromPts: next.points, // placeholder, not used for path
        toPts: next.points,
        finalPoints: next.points,
        interpolate: next.interpolate,
        ghost,
        fromOpacity: 1,
        toOpacity: 0,
      });

      // Fade in the new final path
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
      continue;
    }

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
    const el = dom.any(key);
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
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
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
    const el = dom.any(key);
    if (!el) continue;

    // If interrupted mid-morph, freeze and crossfade
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'area') {
      const ghost = el.cloneNode(true) as SVGElement;
      ghost.classList.add('oc-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('pointer-events', 'none');
      ghost.removeAttribute('data-key');
      const ghostPaths = ghost.querySelectorAll('path');
      if (ghostPaths[0]) ghostPaths[0].setAttribute('d', snap.d);
      if (ghostPaths[1] && snap.topD) ghostPaths[1].setAttribute('d', snap.topD);
      marksContainer.appendChild(ghost);
      ghosts.push(ghost);

      tweens.push({
        tweenType: 'area',
        kind: 'exit',
        el: ghost,
        fromTop: next.topPoints,
        toTop: next.topPoints,
        fromBottom: next.bottomPoints,
        toBottom: next.bottomPoints,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
        ghost,
        fromOpacity: 1,
        toOpacity: 0,
      });

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
      continue;
    }

    const prevPKs = prev.pointKeys ?? prev.topPoints.map((_, i) => `${i}`);
    const nextPKs = next.pointKeys ?? next.topPoints.map((_, i) => `${i}`);

    const prevKeySet = new Set(prevPKs);
    const hasSurvivors = nextPKs.some((k) => prevKeySet.has(k));

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

  // Entering series
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.any(key);
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

    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
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
// Point tween building (scatter/dot/line overlay circle marks)
// ---------------------------------------------------------------------------

function buildPointTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
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

  // Updated points: tween cx/cy/r
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.point(key);
    if (!el) continue;

    // Read the element's current opacity attribute (NOT style.opacity)
    // to detect suppressed points (opacity="0" set by renderer for endpoint markers)
    const renderedOpacity = el.getAttribute('opacity');
    const isSuppressed = renderedOpacity === '0';

    // Retarget from snapshot if interrupted
    let fromCx = prev.cx;
    let fromCy = prev.cy;
    let fromR = prev.r !== next.r ? prev.r : undefined;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'point') {
      fromCx = snap.cx;
      fromCy = snap.cy;
      if (snap.r !== undefined && snap.r !== next.r) {
        fromR = snap.r;
      }
    }

    tweens.push({
      tweenType: 'point',
      kind: 'update',
      el,
      fromCx,
      fromCy,
      toCx: next.cx,
      toCy: next.cy,
      fromR: fromR,
      toR: fromR !== undefined ? next.r : undefined,
      // Do NOT tween opacity for updated points - preserve renderer state
      suppressedOpacity: isSuppressed ? '0' : undefined,
    });
  }

  // Entering points: fade in
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.point(key);
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

    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
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

// ---------------------------------------------------------------------------
// Canvas point tween building
// ---------------------------------------------------------------------------

/**
 * Canvas counterpart of `buildPointTweens`: the same keyed diff, minus the DOM.
 *
 * Where the SVG builder does a `querySelector` per key and emits one tween per
 * mark, this resolves keys against the layer's SoA (already built from the NEXT
 * layout by `render()`) and emits exactly one packed tween.
 */
function buildCanvasPointsTween(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  layer: CanvasLayerLike,
  tweens: Tween[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevPoints = prevLayout.marks.filter((m): m is PointMark => m.type === 'point');
  const nextPoints = nextLayout.marks.filter((m): m is PointMark => m.type === 'point');

  const prevByKey = new Map<string, PointMark>();
  for (const m of prevPoints) {
    if (m.key) prevByKey.set(m.key, m);
  }

  // The layer's SoA is the authority on where a point lives on the canvas.
  // `nextPoints` is only used to confirm the layer and the layout agree.
  const soa = layer.state.marks;
  const survivors: number[] = [];
  const enters: number[] = [];
  for (let i = 0; i < soa.n; i++) {
    const key = soa.keys[i];
    if (key !== undefined && prevByKey.has(key)) survivors.push(i);
    else enters.push(i);
  }

  const exits: PointMark[] = [];
  const nextKeys = new Set<string>();
  for (const m of nextPoints) {
    if (m.key) nextKeys.add(m.key);
  }
  for (const [key, prev] of prevByKey) {
    if (!nextKeys.has(key)) exits.push(prev);
  }

  const sn = survivors.length;
  const soaIndex = new Uint32Array(sn);
  const fromCx = new Float32Array(sn);
  const fromCy = new Float32Array(sn);
  const fromR = new Float32Array(sn);
  const toCx = new Float32Array(sn);
  const toCy = new Float32Array(sn);
  const toR = new Float32Array(sn);
  const soaKeys: string[] = new Array(sn);

  for (let s = 0; s < sn; s++) {
    const i = survivors[s];
    // `survivors` holds exactly the indices whose key is present in prevByKey,
    // so both lookups are total.
    const key = soa.keys[i] as string;
    const prev = prevByKey.get(key) as PointMark;

    // Retarget from an interrupted transition's frozen geometry when present.
    // The snapshot is mode-agnostic (`{type:'point'}`), so a canvas transition
    // interrupted by an SVG-mode update retargets correctly and vice versa.
    let px = prev.cx;
    let py = prev.cy;
    let pr = prev.r;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'point') {
      px = snap.cx;
      py = snap.cy;
      if (snap.r !== undefined) pr = snap.r;
    }

    soaIndex[s] = i;
    soaKeys[s] = key;
    fromCx[s] = px;
    fromCy[s] = py;
    fromR[s] = pr;
    // The SoA already holds the destination geometry -- render() built it from
    // nextLayout before the transition started.
    toCx[s] = soa.x[i];
    toCy[s] = soa.y[i];
    toR[s] = soa.r[i];
  }

  const enterSoaIndex = Uint32Array.from(enters);
  if (enters.length > 0) {
    // Entering points fade via `enterAlpha`, the whole-mark channel the
    // entrance animation uses, NOT `fillOpacity`: on canvas as in SVG,
    // fill-opacity must not drag the stroke down with it. Seed the array at
    // full alpha so every surviving point stays opaque; the tween only ever
    // writes the entering indices.
    const alpha = new Float32Array(soa.n).fill(1);
    for (const i of enters) alpha[i] = 0;
    layer.state.enterAlpha = alpha;
  }

  const exitCx = new Float32Array(exits.length);
  const exitCy = new Float32Array(exits.length);
  const exitR = new Float32Array(exits.length);
  const exitFill: string[] = new Array(exits.length);
  for (let x = 0; x < exits.length; x++) {
    const m = exits[x];
    exitCx[x] = m.cx;
    exitCy[x] = m.cy;
    exitR[x] = m.r;
    exitFill[x] = flattenFill(m.fill);
  }
  // alpha: 1 matches the synchronous t=0 applyTweenState pass.
  const exitState =
    exits.length > 0 ? { x: exitCx, y: exitCy, r: exitR, fill: exitFill, alpha: 1 } : null;

  tweens.push({
    tweenType: 'canvasPoints',
    kind: 'update',
    layer,
    soaIndex,
    fromCx,
    fromCy,
    fromR,
    toCx,
    toCy,
    toR,
    soaKeys,
    enterSoaIndex,
    exitState,
  });
}

/**
 * Write one frame of a canvas point tween into the layer's SoA.
 *
 * Enters and exits run on their own clocks here rather than through the shared
 * `kind` prologue, because a single record carries all three phases.
 */
function applyCanvasPointsState(
  tw: CanvasPointsTween,
  elapsed: number,
  update: { duration: number },
  exit: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  const soa = tw.layer.state.marks;
  const easedUpdate = cubicOut(Math.min(elapsed / update.duration, 1));

  for (let s = 0; s < tw.soaIndex.length; s++) {
    const i = tw.soaIndex[s];
    soa.x[i] = tw.fromCx[s] + (tw.toCx[s] - tw.fromCx[s]) * easedUpdate;
    soa.y[i] = tw.fromCy[s] + (tw.toCy[s] - tw.fromCy[s]) * easedUpdate;
    soa.r[i] = tw.fromR[s] + (tw.toR[s] - tw.fromR[s]) * easedUpdate;
  }

  // Enters fade in, delayed 40% of the update duration -- same phase math the
  // SVG point path uses, so both modes read as one motion.
  const alpha = tw.layer.state.enterAlpha;
  if (alpha && tw.enterSoaIndex.length > 0) {
    const tEnter = elapsed < enterDelay ? 0 : Math.min((elapsed - enterDelay) / enterDuration, 1);
    const easedEnter = cubicOut(tEnter);
    for (let e = 0; e < tw.enterSoaIndex.length; e++) {
      alpha[tw.enterSoaIndex[e]] = easedEnter;
    }
  }

  // Exit ghosts hold their prev position and fade out on the exit clock.
  // The record is preallocated; only alpha changes frame to frame.
  if (tw.exitState) {
    const easedExit = cubicOut(Math.min(elapsed / exit.duration, 1));
    tw.exitState.alpha = 1 - easedExit;
    tw.layer.state.exiting = tw.exitState;
  }
}

/**
 * The axes that contribute canvas gridlines, in the order `buildScatterCanvasState`
 * walks them. `layer.state.gridlines` is a flat array, so the tween can only index
 * into it by replaying that exact traversal -- keep the two in lockstep.
 */
function canvasGridlineAxes(
  layout: ChartLayout,
): { axis: AxisLayout | undefined; orient: 'x' | 'y' }[] {
  return [
    { axis: layout.axes.y, orient: 'y' as const },
    { axis: layout.axes.y2, orient: 'y' as const },
    { axis: layout.axes.x, orient: 'x' as const },
  ];
}

/** True when this axis renders gridlines at all (mirrors `collectGridlines`). */
function axisEmitsGridlines(axis: AxisLayout | undefined, orient: 'x' | 'y'): axis is AxisLayout {
  if (!axis) return false;
  return !(orient === 'y' && axis.orient === 'right');
}

/**
 * Build the canvas gridline tween.
 *
 * The layer's `gridlines` array is already at the NEXT layout's positions, so
 * this only has to compute where each one came FROM. Survivors rewind to their
 * prev position at full alpha; new gridlines hold position and fade in on the
 * enter clock. Exits are dropped rather than ghosted: the next layout's array
 * has no slot for them, and a gridline fading out under 4k points is not worth
 * a parallel ghost array.
 */
function buildCanvasGridlinesTween(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  layer: CanvasLayerLike,
  tweens: Tween[],
): void {
  const live = layer.state.gridlines;
  const index: number[] = [];
  const fromPos: number[] = [];
  const toPos: number[] = [];
  const fromAlpha: number[] = [];
  const toAlpha: number[] = [];

  const prevAxes = canvasGridlineAxes(prevLayout);
  const nextAxes = canvasGridlineAxes(nextLayout);

  let cursor = 0;
  for (let a = 0; a < nextAxes.length; a++) {
    const nextAxis = nextAxes[a].axis;
    const orient = nextAxes[a].orient;
    if (!axisEmitsGridlines(nextAxis, orient)) continue;

    const prevAxis = prevAxes[a].axis;
    const deltas = axisEmitsGridlines(prevAxis, orient)
      ? computeGridlineDeltas(prevAxis, nextAxis)
      : null;

    // Position -> tick value for THIS axis, so each flat-array slot can be
    // resolved back to the key the deltas are keyed by.
    const valueAtPosition = new Map<number, string>();
    for (const tick of nextAxis.ticks) {
      valueAtPosition.set(tick.position, serializeKeyValue(tick.value));
    }

    for (const gridline of nextAxis.gridlines) {
      const slot = cursor++;
      // Defensive: the layer was built from this same layout, so the arrays
      // must be the same length. Bail rather than write past the end.
      if (slot >= live.length) break;

      const key = valueAtPosition.get(gridline.position);
      const prevPos = key !== undefined ? deltas?.prevGridByValue.get(key) : undefined;

      index.push(slot);
      toPos.push(gridline.position);
      toAlpha.push(live[slot].alpha);
      if (prevPos !== undefined) {
        // Survivor: slide, no fade.
        fromPos.push(prevPos);
        fromAlpha.push(live[slot].alpha);
      } else {
        // Enter: hold position, fade in.
        fromPos.push(gridline.position);
        fromAlpha.push(0);
      }
    }
  }

  if (index.length === 0) return;

  tweens.push({
    tweenType: 'canvasGridlines',
    kind: 'update',
    layer,
    index: Uint32Array.from(index),
    fromPos: Float32Array.from(fromPos),
    toPos: Float32Array.from(toPos),
    fromAlpha: Float32Array.from(fromAlpha),
    toAlpha: Float32Array.from(toAlpha),
  });
}

/** Write one frame of a canvas gridline tween into the layer state. */
function applyCanvasGridlinesState(
  tw: CanvasGridlinesTween,
  elapsed: number,
  update: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  const live = tw.layer.state.gridlines;
  const easedUpdate = cubicOut(Math.min(elapsed / update.duration, 1));
  // Enters share the point tween's delayed-fade clock so the whole update
  // reads as one motion.
  const tEnter = elapsed < enterDelay ? 0 : Math.min((elapsed - enterDelay) / enterDuration, 1);
  const easedEnter = cubicOut(tEnter);

  for (let i = 0; i < tw.index.length; i++) {
    const g = live[tw.index[i]];
    g.position = tw.fromPos[i] + (tw.toPos[i] - tw.fromPos[i]) * easedUpdate;
    const from = tw.fromAlpha[i];
    const to = tw.toAlpha[i];
    g.alpha = from === to ? to : from + (to - from) * easedEnter;
  }
}

/** Snap a canvas gridline tween to its exact destination. */
function snapCanvasGridlinesToFinal(tw: CanvasGridlinesTween): void {
  const live = tw.layer.state.gridlines;
  for (let i = 0; i < tw.index.length; i++) {
    const g = live[tw.index[i]];
    g.position = tw.toPos[i];
    g.alpha = tw.toAlpha[i];
  }
}

/** Snap a canvas point tween to its exact destination and drop the ghosts. */
function snapCanvasPointsToFinal(tw: CanvasPointsTween): void {
  const soa = tw.layer.state.marks;
  for (let s = 0; s < tw.soaIndex.length; s++) {
    const i = tw.soaIndex[s];
    soa.x[i] = tw.toCx[s];
    soa.y[i] = tw.toCy[s];
    soa.r[i] = tw.toR[s];
  }
  tw.layer.state.exiting = null;
  // Null rather than fill(1): the renderer skips the alpha multiply entirely
  // when this is null, and every point is at full alpha once the fade lands.
  // Safe to clobber unconditionally -- gate 6 bars a transition while an
  // entrance is in flight, so nothing else owns this array.
  tw.layer.state.enterAlpha = null;
}

// ---------------------------------------------------------------------------
// Rule tween building
// ---------------------------------------------------------------------------

function buildRuleTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevRules = prevLayout.marks.filter((m): m is RuleMarkLayout => m.type === 'rule');
  const nextRules = nextLayout.marks.filter((m): m is RuleMarkLayout => m.type === 'rule');

  const prevByKey = new Map<string, RuleMarkLayout>();
  for (const m of prevRules) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, RuleMarkLayout>();
  for (const m of nextRules) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.rule(key);
    if (!el) continue;

    let fromX1 = prev.x1;
    let fromY1 = prev.y1;
    let fromX2 = prev.x2;
    let fromY2 = prev.y2;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'rule') {
      fromX1 = snap.x1;
      fromY1 = snap.y1;
      fromX2 = snap.x2;
      fromY2 = snap.y2;
    }

    tweens.push({
      tweenType: 'rule',
      kind: 'update',
      el,
      fromX1,
      fromY1,
      fromX2,
      fromY2,
      toX1: next.x1,
      toY1: next.y1,
      toX2: next.x2,
      toY2: next.y2,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.rule(key);
    if (!el) continue;
    tweens.push({
      tweenType: 'rule',
      kind: 'enter',
      el,
      fromX1: next.x1,
      fromY1: next.y1,
      fromX2: next.x2,
      fromY2: next.y2,
      toX1: next.x1,
      toY1: next.y1,
      toX2: next.x2,
      toY2: next.y2,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
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
      tweenType: 'rule',
      kind: 'exit',
      el: ghost,
      fromX1: prev.x1,
      fromY1: prev.y1,
      fromX2: prev.x2,
      fromY2: prev.y2,
      toX1: prev.x1,
      toY1: prev.y1,
      toX2: prev.x2,
      toY2: prev.y2,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Tick tween building
// ---------------------------------------------------------------------------

function buildTickTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevTicks = prevLayout.marks.filter((m): m is TickMarkLayout => m.type === 'tick');
  const nextTicks = nextLayout.marks.filter((m): m is TickMarkLayout => m.type === 'tick');

  const prevByKey = new Map<string, TickMarkLayout>();
  for (const m of prevTicks) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, TickMarkLayout>();
  for (const m of nextTicks) {
    if (m.key) nextByKey.set(m.key, m);
  }

  function tickEndpoints(t: TickMarkLayout) {
    const half = t.length / 2;
    if (t.orient === 'vertical') {
      return { x1: t.x, y1: t.y - half, x2: t.x, y2: t.y + half };
    }
    return { x1: t.x - half, y1: t.y, x2: t.x + half, y2: t.y };
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.tick(key);
    if (!el) continue;
    let pEnd = tickEndpoints(prev);
    const nEnd = tickEndpoints(next);
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'tick') {
      pEnd = { x1: snap.x1, y1: snap.y1, x2: snap.x2, y2: snap.y2 };
    }
    tweens.push({
      tweenType: 'tick',
      kind: 'update',
      el,
      fromX1: pEnd.x1,
      fromY1: pEnd.y1,
      fromX2: pEnd.x2,
      fromY2: pEnd.y2,
      toX1: nEnd.x1,
      toY1: nEnd.y1,
      toX2: nEnd.x2,
      toY2: nEnd.y2,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.tick(key);
    if (!el) continue;
    const nEnd = tickEndpoints(next);
    tweens.push({
      tweenType: 'tick',
      kind: 'enter',
      el,
      fromX1: nEnd.x1,
      fromY1: nEnd.y1,
      fromX2: nEnd.x2,
      fromY2: nEnd.y2,
      toX1: nEnd.x1,
      toY1: nEnd.y1,
      toX2: nEnd.x2,
      toY2: nEnd.y2,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
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
    const pEnd = tickEndpoints(prev);
    tweens.push({
      tweenType: 'tick',
      kind: 'exit',
      el: ghost,
      fromX1: pEnd.x1,
      fromY1: pEnd.y1,
      fromX2: pEnd.x2,
      fromY2: pEnd.y2,
      toX1: pEnd.x1,
      toY1: pEnd.y1,
      toX2: pEnd.x2,
      toY2: pEnd.y2,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Text mark tween building
// ---------------------------------------------------------------------------

function buildTextMarkTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevTexts = prevLayout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');
  const nextTexts = nextLayout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

  const prevByKey = new Map<string, TextMarkLayout>();
  for (const m of prevTexts) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, TextMarkLayout>();
  for (const m of nextTexts) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.text(key);
    if (!el) continue;

    let fromX = prev.x;
    let fromY = prev.y;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'textMark') {
      fromX = snap.x;
      fromY = snap.y;
    }

    tweens.push({
      tweenType: 'textMark',
      kind: 'update',
      el,
      fromX,
      fromY,
      toX: next.x,
      toY: next.y,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.text(key);
    if (!el) continue;
    tweens.push({
      tweenType: 'textMark',
      kind: 'enter',
      el,
      fromX: next.x,
      fromY: next.y,
      toX: next.x,
      toY: next.y,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
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
      tweenType: 'textMark',
      kind: 'exit',
      el: ghost,
      fromX: prev.x,
      fromY: prev.y,
      toX: prev.x,
      toY: prev.y,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Color tween building
// ---------------------------------------------------------------------------

/**
 * The child element a mark's `fill` or `stroke` is actually written to.
 *
 * Resolved per attribute, not once per mark: an area is two stacked paths, and
 * they do not carry the same channels. `renderAreaMark` appends the closed fill
 * shape first (`stroke: 'none'`) and the `.oc-area-top` line second -- that
 * second path is the only thing carrying the stroke, and it traces the data
 * points alone rather than the baseline. A blanket `querySelector` returns the
 * *first* match, so writing a stroke through it would paint an outline around
 * the whole closed area (baseline included) and `snapTweenToFinal` would leave
 * it there for good.
 */
function markShapeElement(el: SVGElement, attr: 'fill' | 'stroke'): SVGElement {
  if (el.tagName === 'circle' || el.tagName === 'rect' || el.tagName === 'path') return el;
  if (attr === 'stroke') {
    const areaTop = el.querySelector('.oc-area-top') as SVGElement | null;
    if (areaTop) return areaTop;
  }
  return (el.querySelector('rect, path, circle, line') as SVGElement | null) ?? el;
}

/** Gradient fills are `url(#id)` refs and cannot be interpolated numerically. */
function isInterpolableColor(v: unknown): v is string {
  return typeof v === 'string' && v !== '' && v !== 'none' && !v.startsWith('url(');
}

/**
 * Build fill/stroke tweens for marks present in both layouts whose color moved.
 *
 * Mark-type agnostic on purpose: every mark carries `fill`/`stroke` resolved by
 * the compiler, so matching on `key` and diffing the two strings covers rects,
 * lines, areas and points in one pass. Marks whose color did not change emit no
 * tween, so the common data-update case costs nothing.
 */
function buildColorTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  dom: MarkDomIndex,
  tweens: Tween[],
): void {
  type Colored = { key?: string; fill?: unknown; stroke?: unknown };
  const prevByKey = new Map<string, Colored>();
  for (const m of prevLayout.marks as Colored[]) {
    if (m.key) prevByKey.set(m.key, m);
  }

  for (const next of nextLayout.marks as Colored[]) {
    if (!next.key) continue;
    const prev = prevByKey.get(next.key);
    if (!prev) continue;

    const group = dom.any(next.key);
    if (!group) continue;

    for (const attr of ['fill', 'stroke'] as const) {
      const from = prev[attr];
      const to = next[attr];
      if (from === to) continue;
      if (!isInterpolableColor(from) || !isInterpolableColor(to)) continue;
      tweens.push({
        tweenType: 'color',
        kind: 'update',
        el: markShapeElement(group, attr),
        attr,
        from,
        to,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Annotation tween building
// ---------------------------------------------------------------------------

/**
 * Build keyed enter/update/exit tweens for annotations.
 *
 * Follows the `buildAxisTweens` pattern rather than the mark builders': the
 * annotation group is a SIBLING of the clipped marks group, so it must be
 * queried from the `svg` root. A `marksContainer.querySelector` would never
 * find it.
 *
 * Surviving annotations tween from their old position to their new one via a
 * transform offset (the alternative -- re-resolving label x/y, connector path,
 * dot, subtitle and background rect individually -- is a lot of surface for no
 * extra fidelity). Entering ones fade in. See the note at the bottom for why
 * exiting ones do not fade out.
 */
function buildAnnotationTweens(
  svg: SVGSVGElement,
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  tweens: Tween[],
): void {
  const prev = prevLayout.annotations ?? [];
  const next = nextLayout.annotations ?? [];
  if (prev.length === 0 && next.length === 0) return;

  const container = svg.querySelector('.oc-annotations');
  if (!container) return;

  const prevByKey = new Map(keyAnnotations(prev).map((k, i) => [k, prev[i]]));
  const nextKeys = keyAnnotations(next);

  // The rendered DOM matches nextLayout, so index i is nextKeys[i].
  const els = container.querySelectorAll('.oc-annotation');

  for (let i = 0; i < next.length; i++) {
    const el = els[i] as SVGElement | undefined;
    if (!el) continue;
    const before = prevByKey.get(nextKeys[i]);

    if (!before) {
      // Entering: fade in on the annotation cadence.
      tweens.push({
        tweenType: 'annotation',
        kind: 'enter',
        el,
        fromDx: 0,
        fromDy: 0,
        fromOpacity: 0,
        toOpacity: 1,
      });
      continue;
    }

    // Surviving: hold at full opacity, slide from the old position if it moved.
    const dx = (before.label?.x ?? 0) - (next[i].label?.x ?? 0);
    const dy = (before.label?.y ?? 0) - (next[i].label?.y ?? 0);
    if (dx === 0 && dy === 0) continue;
    tweens.push({
      tweenType: 'annotation',
      kind: 'update',
      el,
      fromDx: dx,
      fromDy: dy,
    });
  }

  // Exiting annotations are NOT ghosted. render() has already torn down the old
  // SVG, so the removed node is gone and there is nothing left to clone -- the
  // elements still in the DOM belong to nextLayout, and cloning one by the old
  // index would ghost an annotation that actually survived. Building a faithful
  // ghost would mean re-rendering the annotation from prevLayout (the marks
  // path can do this via `renderSingleMark`; annotations have no such entry
  // point that takes a single ResolvedAnnotation).
  //
  // So a removed annotation disappears immediately. That matches the behavior
  // before this change and is not what the blink bug was about; adding a real
  // exit fade means exposing a single-annotation renderer first.
}

// ---------------------------------------------------------------------------
// Axis tick and gridline tween building
// ---------------------------------------------------------------------------

/**
 * Build tweens for axis tick labels and gridlines across both x and y axes.
 * Matches ticks by `data-tick-key` (stamped at render time).
 */
function buildAxisTweens(
  svg: SVGSVGElement,
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  // Process each axis orientation
  buildSingleAxisTweens(svg, prevLayout.axes.x, nextLayout.axes.x, 'x', nextLayout, tweens, ghosts);
  buildSingleAxisTweens(svg, prevLayout.axes.y, nextLayout.axes.y, 'y', nextLayout, tweens, ghosts);
}

/**
 * Match an axis's gridlines between two layouts, keyed by TICK VALUE.
 *
 * Gridlines carry no key of their own, so identity is borrowed from the tick
 * that shares their position -- a value-keyed match, which is why a rescale
 * that keeps no tick values (900 -> 20) reads as a full fade-out/fade-in rather
 * than a slide, and why one that keeps them all slides even when every position
 * moved.
 *
 * The `g.position === tick.position` join is an exact float compare, which is
 * only safe because both arrays come out of the same scale call in the same
 * layout pass. Anything that recomputes gridline positions independently --
 * even via an algebraically identical expression -- would silently match
 * nothing and degrade every gridline to a fade.
 *
 * Pure so the canvas path can consume the same deltas without a DOM.
 */
function computeGridlineDeltas(
  prevAxis: AxisLayout,
  nextAxis: AxisLayout,
): { prevGridByValue: Map<string, number>; nextGridByValue: Map<string, number> } {
  const byValue = (axis: AxisLayout): Map<string, number> => {
    const map = new Map<string, number>();
    for (const tick of axis.ticks) {
      const matching = axis.gridlines.find((g) => g.position === tick.position);
      if (matching) map.set(serializeKeyValue(tick.value), matching.position);
    }
    return map;
  };
  return { prevGridByValue: byValue(prevAxis), nextGridByValue: byValue(nextAxis) };
}

function buildSingleAxisTweens(
  svg: SVGSVGElement,
  prevAxis: AxisLayout | undefined,
  nextAxis: AxisLayout | undefined,
  orientation: 'x' | 'y',
  layout: ChartLayout,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  if (!prevAxis || !nextAxis) return;

  const axisClass = `oc-axis-${orientation}`;
  const axisGroup = svg.querySelector(`.${axisClass}`) as SVGElement | null;
  if (!axisGroup) return;

  const isRotated = !!(nextAxis.tickAngle && Math.abs(nextAxis.tickAngle) > 10);

  // Build tick value -> position maps from layouts (NOT from DOM)
  const prevTickMap = new Map<string, number>();
  for (const tick of prevAxis.ticks) {
    prevTickMap.set(serializeKeyValue(tick.value), tick.position);
  }
  const nextTickMap = new Map<string, number>();
  for (const tick of nextAxis.ticks) {
    nextTickMap.set(serializeKeyValue(tick.value), tick.position);
  }

  // Position attribute: 'x' for x-axis tick labels, 'y' for y-axis tick labels
  const posAttr = orientation === 'x' ? 'x' : 'y';

  // Tick labels
  const tickLabels = axisGroup.querySelectorAll('.oc-axis-tick[data-tick-key]');
  const matchedNextKeys = new Set<string>();

  for (const labelEl of tickLabels) {
    const key = labelEl.getAttribute('data-tick-key');
    if (!key) continue;

    const nextPos = nextTickMap.get(key);
    const prevPos = prevTickMap.get(key);

    if (prevPos !== undefined && nextPos !== undefined) {
      // Updated tick: slide to new position
      matchedNextKeys.add(key);
      tweens.push({
        tweenType: 'axisTick',
        kind: 'update',
        el: labelEl as SVGElement,
        posAttr,
        fromPos: prevPos,
        toPos: nextPos,
        crossfade: isRotated,
      });
    } else if (prevPos === undefined && nextPos !== undefined) {
      // Entering tick: fade in
      matchedNextKeys.add(key);
      tweens.push({
        tweenType: 'axisTick',
        kind: 'enter',
        el: labelEl as SVGElement,
        posAttr,
        fromPos: nextPos,
        toPos: nextPos,
        crossfade: false,
        fromOpacity: 0,
        toOpacity: 1,
      });
    }
    // Exiting ticks are handled below (they won't be in the new SVG's DOM,
    // so we clone from the prev state)
  }

  // Exiting tick labels: create ghost elements
  for (const [key, prevPos] of prevTickMap) {
    if (nextTickMap.has(key)) continue;
    // Find the tick label in the rendered SVG by data-tick-key
    // It won't be there since the SVG was already re-rendered from nextLayout,
    // so we need to create a ghost text element
    const prevTick = prevAxis.ticks.find((t) => serializeKeyValue(t.value) === key);
    if (!prevTick) continue;

    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ghost.setAttribute('class', 'oc-axis-tick oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.textContent = prevTick.label;
    // Copy positioning from prevAxis ticks
    const area = layout.area;
    if (orientation === 'x') {
      ghost.setAttribute('x', String(prevPos));
      const xLabelPad = nextAxis.labelPadding ?? layout.theme.spacing.xAxisLabelPadding;
      const fontSize = nextAxis.tickLabelStyle.fontSize;
      ghost.setAttribute('y', String(area.y + area.height + xLabelPad + fontSize * 0.8));
      ghost.setAttribute('text-anchor', 'middle');
    } else {
      const TICK_LABEL_OFFSET = 8;
      ghost.setAttribute('x', String(area.x - TICK_LABEL_OFFSET));
      ghost.setAttribute('y', String(prevPos));
      ghost.setAttribute('text-anchor', 'end');
      ghost.setAttribute('dominant-baseline', 'central');
    }
    axisGroup.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'axisTick',
      kind: 'exit',
      el: ghost,
      posAttr,
      fromPos: prevPos,
      toPos: prevPos,
      crossfade: false,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }

  // Gridlines
  const { prevGridByValue, nextGridByValue } = computeGridlineDeltas(prevAxis, nextAxis);

  const gridlines = axisGroup.querySelectorAll('.oc-gridline[data-tick-key]');

  for (const glEl of gridlines) {
    const key = glEl.getAttribute('data-tick-key');
    if (!key) continue;

    const nextPos = nextGridByValue.get(key);
    const prevPos = prevGridByValue.get(key);

    if (prevPos !== undefined && nextPos !== undefined) {
      tweens.push({
        tweenType: 'gridline',
        kind: 'update',
        el: glEl as SVGElement,
        orientation,
        fromPos: prevPos,
        toPos: nextPos,
      });
    } else if (prevPos === undefined && nextPos !== undefined) {
      tweens.push({
        tweenType: 'gridline',
        kind: 'enter',
        el: glEl as SVGElement,
        orientation,
        fromPos: nextPos,
        toPos: nextPos,
        fromOpacity: 0,
        toOpacity: 1,
      });
    }
  }

  // Exiting gridlines
  for (const [key, prevPos] of prevGridByValue) {
    if (nextGridByValue.has(key)) continue;

    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ghost.setAttribute('class', 'oc-gridline oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    if (orientation === 'y') {
      // Horizontal gridline at y=prevPos
      const area = layout.area;
      ghost.setAttribute('x1', String(area.x));
      ghost.setAttribute('y1', String(prevPos));
      ghost.setAttribute('x2', String(area.x + area.width));
      ghost.setAttribute('y2', String(prevPos));
    } else {
      // Vertical gridline at x=prevPos
      const area = layout.area;
      ghost.setAttribute('x1', String(prevPos));
      ghost.setAttribute('y1', String(area.y));
      ghost.setAttribute('x2', String(prevPos));
      ghost.setAttribute('y2', String(area.y + area.height));
    }
    axisGroup.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'gridline',
      kind: 'exit',
      el: ghost,
      orientation,
      fromPos: prevPos,
      toPos: prevPos,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}
