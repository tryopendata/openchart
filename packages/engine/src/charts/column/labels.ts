/**
 * Column chart label computation.
 *
 * Produces value labels positioned above each column (for positive values)
 * or below (for negative values).
 *
 * Respects the spec's label density setting:
 * - 'all': show every label, skip collision detection
 * - 'auto': existing behavior (collision detection)
 * - 'endpoints': first and last columns only
 * - 'none': return empty array
 */

import type {
  LabelCandidate,
  LabelDensity,
  RectMark,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, resolveCollisions } from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_OFFSET_Y = 6;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute value labels for column marks.
 *
 * For each column, the value is placed centered above the column top.
 */
export function computeColumnLabels(
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

    const numericValue = parseFloat(valuePart);
    const isNegative = Number.isFinite(numericValue) && numericValue < 0;

    const textWidth = estimateTextWidth(valuePart, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    // For positive values, place label above the column top.
    // For negative values, place label below the column bottom.
    const anchorX = mark.x + mark.width / 2 - textWidth / 2;
    const anchorY = isNegative
      ? mark.y + mark.height + LABEL_OFFSET_Y
      : mark.y - LABEL_OFFSET_Y - textHeight;

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
        fill: mark.fill,
        lineHeight: 1.2,
        textAnchor: 'middle',
        dominantBaseline: isNegative ? 'hanging' : 'auto',
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
