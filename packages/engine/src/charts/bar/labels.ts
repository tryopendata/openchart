/**
 * Bar chart label computation.
 *
 * Produces value labels for horizontal bars, positioned inside the bar
 * if the bar is wide enough, or outside (to the right) otherwise.
 *
 * Respects the spec's label density setting:
 * - 'all': show every label, skip collision detection
 * - 'auto': existing behavior (collision detection)
 * - 'endpoints': first and last bars only
 * - 'none': return empty array
 */

import type { LabelCandidate, LabelDensity, RectMark, ResolvedLabel } from '@openchart/core';
import { estimateTextWidth, resolveCollisions } from '@openchart/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 11;
const LABEL_FONT_WEIGHT = 600;
const LABEL_PADDING = 6;
const MIN_WIDTH_FOR_INSIDE_LABEL = 40;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute value labels for bar marks.
 *
 * For each bar, the value from the data is formatted and placed either
 * inside the bar (right-aligned) if the bar is wide enough, or just
 * outside the bar's right edge.
 */
export function computeBarLabels(
  marks: RectMark[],
  _chartArea: { x: number; y: number; width: number; height: number },
  density: LabelDensity = 'auto',
): ResolvedLabel[] {
  // 'none': no labels at all
  if (density === 'none') return [];

  // Filter marks for 'endpoints' density
  const targetMarks =
    density === 'endpoints' && marks.length > 1 ? [marks[0], marks[marks.length - 1]] : marks;

  const candidates: LabelCandidate[] = [];

  for (const mark of targetMarks) {
    // Extract the display value from the aria label.
    // Format is "category: value" or "category, group: value".
    // Use the last colon to split, which handles colons in category names.
    const ariaLabel = mark.aria.label;
    const lastColon = ariaLabel.lastIndexOf(':');
    const valuePart = lastColon >= 0 ? ariaLabel.slice(lastColon + 1).trim() : '';
    if (!valuePart) continue;

    const textWidth = estimateTextWidth(valuePart, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    // Detect stacked bars: cornerRadius 0 indicates stacked segment
    const isStacked = mark.cornerRadius === 0;

    // Determine if label goes inside or outside the bar
    const isInside = mark.width >= MIN_WIDTH_FOR_INSIDE_LABEL;

    let anchorX: number;
    let fill: string;
    let textAnchor: 'start' | 'end' | 'middle';

    if (isStacked && isInside) {
      // Stacked: centered within segment
      anchorX = mark.x + mark.width / 2;
      fill = '#ffffff';
      textAnchor = 'middle';
    } else if (isInside) {
      // Simple: right-aligned within bar
      anchorX = mark.x + mark.width - LABEL_PADDING;
      fill = '#ffffff';
      textAnchor = 'end';
    } else {
      // Outside: just past the bar's right edge
      anchorX = mark.x + mark.width + LABEL_PADDING;
      fill = mark.fill;
      textAnchor = 'start';
    }

    // anchorY = bar vertical center. With dominant-baseline: central,
    // SVG places the text center at this y coordinate.
    const anchorY = mark.y + mark.height / 2;

    candidates.push({
      text: valuePart,
      anchorX,
      anchorY,
      width: textWidth,
      height: textHeight,
      priority: 'data',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill,
        lineHeight: 1.2,
        textAnchor,
        dominantBaseline: 'central',
      },
    });
  }

  if (candidates.length === 0) return [];

  // 'all': skip collision detection, mark everything visible
  if (density === 'all') {
    return candidates.map((c) => ({
      text: c.text,
      x: c.anchorX,
      y: c.anchorY,
      style: c.style,
      visible: true,
    }));
  }

  return resolveCollisions(candidates);
}
