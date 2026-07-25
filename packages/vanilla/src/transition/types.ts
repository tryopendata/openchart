import type { Point, RectMark } from '@opendata-ai/openchart-core';

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
// Internal types for tweens
// ---------------------------------------------------------------------------

export interface RectGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectTween {
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

export interface LineTween {
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

export interface AreaTween {
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

export interface PointTween {
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

export interface RuleTween {
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

export interface TickTween {
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

export interface TextMarkTween {
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

export interface AxisTickTween {
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

export interface GridlineTween {
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
export interface ColorTween {
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
export interface AnnotationTween {
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
export interface CanvasGridlinesTween {
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
export interface CanvasPointsTween {
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

export type Tween =
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
