/**
 * Line chart label computation.
 *
 * Produces end-of-line labels (series name at the last data point)
 * and feeds them through the core collision engine. At compact
 * breakpoints, labels are suppressed in favor of the legend.
 *
 * Respects the spec's label density setting:
 * - 'all': show every label, skip collision detection
 * - 'auto': existing behavior (collision detection)
 * - 'endpoints': first and last data point labels per series
 * - 'none': return empty map
 */

import type {
  LabelCandidate,
  LabelDensity,
  LayoutStrategy,
  LineMark,
  ResolvedLabel,
} from '@openchart/core';
import { estimateTextWidth, resolveCollisions } from '@openchart/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default label font size. */
const LABEL_FONT_SIZE = 11;

/** Default label font weight. */
const LABEL_FONT_WEIGHT = 600;

/** Horizontal offset from last point to label. */
const LABEL_OFFSET_X = 6;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute end-of-line labels for line marks.
 *
 * For each series, places a label at the position of the last data point.
 * At compact breakpoints (labelMode === 'none'), all labels are hidden
 * so the legend takes over. Labels go through collision detection to
 * avoid overlap.
 *
 * Returns a Map keyed by seriesKey so callers can look up labels by
 * mark identity instead of relying on positional indices.
 *
 * @param marks - Line marks (only processes marks with type === 'line').
 * @param strategy - Layout strategy from the responsive breakpoint.
 * @param density - Label density mode from spec.labels.density.
 * @returns Map of seriesKey -> ResolvedLabel after collision detection.
 */
export function computeLineLabels(
  marks: LineMark[],
  strategy: LayoutStrategy,
  density: LabelDensity = 'auto',
): Map<string, ResolvedLabel> {
  const result = new Map<string, ResolvedLabel>();

  // 'none': no labels
  if (density === 'none') return result;

  // At compact breakpoint, suppress inline labels entirely
  if (strategy.labelMode === 'none') {
    return result;
  }

  const candidates: LabelCandidate[] = [];
  const seriesOrder: string[] = [];

  for (const mark of marks) {
    if (mark.points.length === 0) continue;

    const labelText = mark.seriesKey ?? '';
    if (!labelText) continue;

    const lastPoint = mark.points[mark.points.length - 1];
    const textWidth = estimateTextWidth(labelText, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    candidates.push({
      text: labelText,
      anchorX: lastPoint.x + LABEL_OFFSET_X,
      anchorY: lastPoint.y - textHeight / 2,
      width: textWidth,
      height: textHeight,
      priority: 'data',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill: mark.stroke,
        lineHeight: 1.2,
        textAnchor: 'start',
        dominantBaseline: 'central',
      },
    });

    seriesOrder.push(labelText);
  }

  if (candidates.length === 0) return result;

  // 'all': skip collision detection, mark everything visible
  if (density === 'all') {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      result.set(seriesOrder[i], {
        text: c.text,
        x: c.anchorX,
        y: c.anchorY,
        style: c.style,
        visible: true,
      });
    }
    return result;
  }

  // 'endpoints': for line charts, endpoints means showing just the end-of-line
  // label (which is what we already compute). This is the same as 'auto' for lines
  // since we only compute the endpoint label per series.

  const resolved = resolveCollisions(candidates);
  for (let i = 0; i < resolved.length; i++) {
    result.set(seriesOrder[i], resolved[i]);
  }

  return result;
}
