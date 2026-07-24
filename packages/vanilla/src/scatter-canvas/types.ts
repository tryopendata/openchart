/**
 * State types for the scatter canvas mark layer.
 *
 * Point marks are held struct-of-arrays (SoA) rather than as objects: the layer
 * exists for the 1k-50k point regime where per-frame allocation and pointer
 * chasing dominate. Typed arrays keep the update tween (Stage 5) allocation-free
 * and let the renderer batch without touching the compiled `Mark` objects.
 */

/** An axis-aligned rectangle in layout (CSS pixel) coordinates. */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point marks packed as parallel arrays. Every array is length `n` and indexed
 * by the point's position among point marks (NOT its position in `layout.marks`).
 */
export interface ScatterPointsSoA {
  /** Number of points. */
  n: number;
  /** Center x per point. */
  x: Float32Array;
  /** Center y per point. */
  y: Float32Array;
  /** Radius per point. */
  r: Float32Array;
  /**
   * Resolved SOLID fill per point. Gradient fills are flattened to their first
   * stop at build time — see `flattenFill` in `./state`.
   */
  fill: string[];
  /** Fill opacity per point (defaults to 1 when the mark omits it). */
  fillOpacity: Float32Array;
  /** Stroke color per point (empty string when there is no stroke). */
  stroke: string[];
  /** Stroke width per point (0 when there is no stroke). */
  strokeWidth: Float32Array;
  /** Stable identity key per point, when the spec supplies `encoding.key`. */
  keys: (string | undefined)[];
  /**
   * `data-mark-id` per point, built from the point's index in the ORIGINAL
   * `layout.marks` array (`point-${originalIndex}`). Tooltip descriptors are
   * keyed by that index, and a trendline mark is `unshift`ed onto `layout.marks`,
   * so the index among points alone would misattribute every tooltip.
   */
  markIds: string[];
  /** Stagger-ordering index per point (0 when the mark omits it). */
  animationIndex: Uint32Array;
  /** Original data row per point. */
  data: unknown[];
}

/** A gridline resolved to canvas coordinates. */
export interface CanvasGridline {
  /** Which axis produced it: `'y'` spans horizontally, `'x'` spans vertically. */
  orient: 'x' | 'y';
  /** Pixel position along the axis (y for `'y'`, x for `'x'`). */
  position: number;
  /** Stroke alpha. Matches the SVG renderer's `stroke-opacity` of 0.6. */
  alpha: number;
}

/** Exit ghosts: marks removed by a data update, painted under the live points. */
export interface ScatterExitingPoints {
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  fill: string[];
  /** Global fade alpha applied to every ghost. */
  alpha: number;
}

/** Everything the canvas renderer needs to paint one frame. */
export interface ScatterCanvasState {
  /** Full figure width in CSS pixels (canvas coords == layout coords). */
  width: number;
  /** Full figure height in CSS pixels. */
  height: number;
  /** Clip rect, identical to the SVG renderer's mark clip path. */
  clipRect: CanvasRect;
  /** Theme background, painted full-bleed under everything. */
  background: string;
  /** Live point marks. */
  marks: ScatterPointsSoA;
  /** Gridlines in paint order (y-axis then x-axis). */
  gridlines: CanvasGridline[];
  /** Gridline stroke color from the theme. */
  gridlineStroke: string;
  /** Gridline stroke width. */
  gridlineWidth: number;
  /** The plot area rect (`layout.area`). */
  plotRect: CanvasRect;
  /** Hover ring color (theme accent). */
  accent: string;
  /**
   * Per-point entrance alpha, multiplied into fill opacity. `null` once the
   * entrance settles (the common case) so the batching key collapses.
   */
  enterAlpha: Float32Array | null;
  /** Exit ghosts, or `null` when no update transition is running. */
  exiting: ScatterExitingPoints | null;
  /** Index into `marks` of the hovered point, or -1 for none. */
  hoverIndex: number;
}
