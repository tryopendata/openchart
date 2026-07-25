/**
 * Resolve which backend paints a chart's point marks: SVG (one `<circle>` per
 * datum) or a canvas mark layer (batched paint calls).
 *
 * High-cardinality scatter plots are the only case where the trade is worth
 * it, so canvas is refused for every other mark type and for the layout shapes
 * the canvas layer cannot express (facets, layers, sparklines). Refusals are
 * advisory: an explicit `'canvas'` request always warns, and an `'auto'`
 * refusal warns only once the chart is dense enough for the SVG fallback to
 * actually hurt (AUTO_CANVAS_REFUSAL_WARN_THRESHOLD).
 */

import type { Display } from '@opendata-ai/openchart-core';

/** Point count above which `'auto'` prefers canvas over SVG. */
export const AUTO_CANVAS_THRESHOLD = 1000;

/**
 * Point count above which an `'auto'` refusal is worth telling the author about.
 *
 * Set well clear of AUTO_CANVAS_THRESHOLD on purpose. A chart that trips the
 * threshold by a little renders fine as SVG, and warning there would fire on
 * ordinary faceted and layered charts that have nothing wrong with them. This
 * is the "you are painting enough DOM nodes to feel it" line, so the advice is
 * actionable rather than noise.
 */
export const AUTO_CANVAS_REFUSAL_WARN_THRESHOLD = 5000;

/** Inputs to mark render mode resolution. */
export interface MarkRenderModeArgs {
  /** The host's requested backend (`CompileOptions.renderer`), or undefined for `'auto'`. */
  requested: 'auto' | 'svg' | 'canvas' | undefined;
  /** The chart's mark type (`'point'` is the only canvas-capable one). */
  markType: string;
  /** Number of compiled point marks in the layout. */
  pointCount: number;
  /** Resolved display mode; sparklines never go to canvas. */
  display: Display;
  /** Whether this is a faceted (small-multiples) compile. */
  faceted: boolean;
  /** Whether this compile is a leaf or primary spec of a multi-leaf layer. */
  layered: boolean;
}

/**
 * Pick the rendering backend for a chart's point marks.
 *
 * Precedence:
 * 1. Explicit `'svg'` wins outright.
 * 2. Unsupported shape (non-point mark, facet, layer, sparkline) falls back to
 *    SVG, pushing one warning onto `warnings` when the author explicitly asked
 *    for canvas, or when `'auto'` wanted canvas for a chart dense enough that
 *    the SVG fallback is a real cost.
 * 3. Explicit `'canvas'` wins at any point count.
 * 4. `'auto'` (or absent) promotes to canvas above AUTO_CANVAS_THRESHOLD.
 *
 * `warnings` follows the engine's usual collector convention: the caller emits
 * them once per compile through `emitSpecWarnings(warnings, options.onWarn)`.
 */
export function resolveMarkRenderMode(
  args: MarkRenderModeArgs,
  warnings: string[] = [],
): 'svg' | 'canvas' {
  const { markType, pointCount, display, faceted, layered } = args;
  const requested = args.requested ?? 'auto';

  if (requested === 'svg') return 'svg';

  const refusal = describeRefusal(markType, display, faceted, layered);
  if (refusal) {
    if (requested === 'canvas') {
      warnings.push(
        `Chart warning: renderer "canvas" is not supported ${refusal}; rendering marks as SVG instead.`,
      );
    } else if (pointCount > AUTO_CANVAS_REFUSAL_WARN_THRESHOLD) {
      // The author asked for nothing and got the slow path. Without this the
      // only symptom is a chart that feels heavy, with no hint that the shape
      // (not the point count) is what kept it on SVG.
      warnings.push(
        `[openchart] Rendering ${pointCount} point marks as SVG: the canvas mark layer is not supported ${refusal}. Expect slow paint and interaction. Reduce the point count, or restructure so the dense marks compile as a single unlayered, unfaceted point chart.`,
      );
    }
    return 'svg';
  }

  if (requested === 'canvas') return 'canvas';

  // Rule 4 -- the auto path.
  return pointCount > AUTO_CANVAS_THRESHOLD ? 'canvas' : 'svg';
}

/**
 * Name why canvas is unavailable for this chart shape, or undefined when it is
 * available. The phrasing slots into the warning message above.
 */
function describeRefusal(
  markType: string,
  display: Display,
  faceted: boolean,
  layered: boolean,
): string | undefined {
  if (markType !== 'point') return `for ${markType} marks (point marks only)`;
  if (faceted) return 'on faceted charts';
  if (layered) return 'on layered charts';
  if (display === 'sparkline') return 'on sparklines';
  return undefined;
}
