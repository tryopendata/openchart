/**
 * Dot chart label computation.
 *
 * Produces value labels positioned to the right of each dot.
 *
 * Respects the spec's label density setting:
 * - 'all': show every label, skip collision detection
 * - 'auto': existing behavior (collision detection)
 * - 'endpoints': first and last dots only
 * - 'none': return empty array
 */

import type {
  LabelCandidate,
  LabelDensity,
  PointMark,
  Rect,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import {
  estimateTextWidth,
  getRepresentativeColor,
  resolveCollisions,
} from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 11;
const LABEL_FONT_WEIGHT = 600;
const LABEL_OFFSET_X = 10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute value labels for dot marks.
 *
 * Places labels to the right of each dot point.
 */
export function computeDotLabels(
  marks: PointMark[],
  _chartArea: Rect,
  density: LabelDensity = 'auto',
  labelPrefix?: string,
): ResolvedLabel[] {
  // 'none': no labels at all
  if (density === 'none') return [];

  // Filter marks for 'endpoints' density
  const targetMarks =
    density === 'endpoints' && marks.length > 1 ? [marks[0], marks[marks.length - 1]] : marks;

  const candidates: LabelCandidate[] = [];

  for (const mark of targetMarks) {
    // Extract the display value from the aria label.
    // Format is "category: value". Use the last colon to handle colons in category names.
    const ariaLabel = mark.aria.label;
    const lastColon = ariaLabel.lastIndexOf(':');
    let valuePart = lastColon >= 0 ? ariaLabel.slice(lastColon + 1).trim() : '';
    if (!valuePart) continue;
    if (labelPrefix) valuePart = labelPrefix + valuePart;

    const textWidth = estimateTextWidth(valuePart, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    candidates.push({
      text: valuePart,
      anchorX: mark.cx + mark.r + LABEL_OFFSET_X,
      anchorY: mark.cy - textHeight / 2,
      width: textWidth,
      height: textHeight,
      priority: 'data',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill: getRepresentativeColor(mark.fill),
        lineHeight: 1.2,
        textAnchor: 'start',
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
