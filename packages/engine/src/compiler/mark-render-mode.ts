/**
 * Resolve which backend paints a chart's point marks: SVG (one `<circle>` per
 * datum) or a canvas mark layer (batched paint calls).
 *
 * High-cardinality scatter plots are the only case where the trade is worth
 * it, so canvas is refused for every other mark type and for the layout shapes
 * the canvas layer cannot express (facets, layers, sparklines). Refusals are
 * advisory: they warn only when the author explicitly asked for canvas, never
 * for `'auto'`.
 */

import type { Display, MarkDef } from '@opendata-ai/openchart-core';

/** Point count above which `'auto'` prefers canvas over SVG. */
export const AUTO_CANVAS_THRESHOLD = 1000;

/**
 * Kill switch for the `'auto'` path.
 *
 * Held off while the canvas layer was still growing entrance animations,
 * update transitions and exports, so each of those could land and be verified
 * without silently changing how every existing high-cardinality scatter
 * renders. All three now ship, so auto promotion is live.
 */
const AUTO_ENABLED = true;

/** Inputs to mark render mode resolution. */
export interface MarkRenderModeArgs {
  /** The chart's resolved mark def, or undefined for a bare string mark. */
  markDef: MarkDef | undefined;
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
 *    SVG, pushing one warning onto `warnings` only when the author explicitly
 *    asked for canvas.
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
  const { markDef, markType, pointCount, display, faceted, layered } = args;
  const requested = markDef?.render ?? 'auto';

  if (requested === 'svg') return 'svg';

  const refusal = describeRefusal(markType, display, faceted, layered);
  if (refusal) {
    if (requested === 'canvas') {
      warnings.push(
        `Chart warning: mark.render "canvas" is not supported ${refusal}; rendering marks as SVG instead.`,
      );
    }
    return 'svg';
  }

  if (requested === 'canvas') return 'canvas';

  // Rule 4 -- the auto path. See AUTO_ENABLED.
  if (!AUTO_ENABLED) return 'svg';
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
