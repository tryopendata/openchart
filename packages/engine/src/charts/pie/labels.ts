/**
 * Pie/donut chart label computation.
 *
 * Produces leader-line labels positioned outside each arc slice.
 * Labels are placed at the midpoint of each arc's angle, extended
 * outward from the centroid. Collision detection resolves overlaps.
 *
 * Respects the spec's label density setting:
 * - 'all': show every label, skip collision detection
 * - 'auto': existing behavior (collision detection)
 * - 'endpoints': first and last slices only
 * - 'none': return empty array
 */

import type {
  ArcMark,
  LabelCandidate,
  LabelDensity,
  Rect,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, resolveCollisions } from '@opendata-ai/openchart-core';
import { filterByDensity } from '../_shared/density-filter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 500;
const LEADER_LINE_OFFSET = 12;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute leader-line labels for pie/donut arc marks.
 *
 * Each label is positioned outward from the arc centroid with a connector
 * line from the centroid to the label. Labels go through collision
 * detection to avoid overlap.
 */
export function computePieLabels(
  marks: ArcMark[],
  _chartArea: Rect,
  density: LabelDensity = 'auto',
  _textFill = '#333333',
): ResolvedLabel[] {
  if (marks.length === 0) return [];

  // Get the pie center from the first mark's center property
  // (read before filtering — 'endpoints' still needs the original center)
  const centerX = marks[0].center.x;
  const centerY = marks[0].center.y;

  const targetMarks = filterByDensity(marks, density);
  if (targetMarks.length === 0) return [];

  const candidates: LabelCandidate[] = [];
  const targetMarkIndices: number[] = [];

  for (let mi = 0; mi < targetMarks.length; mi++) {
    const mark = targetMarks[mi];
    // Extract the label text (category name) from the aria label.
    // Format is "Category: value (percent%)". Split on the first colon
    // to handle category names that might contain colons.
    const ariaLabel = mark.aria.label;
    if (!ariaLabel) continue;
    const firstColon = ariaLabel.indexOf(':');
    const labelText = firstColon >= 0 ? ariaLabel.slice(0, firstColon).trim() : '';
    if (!labelText) continue;

    const textWidth = estimateTextWidth(labelText, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    // Position label outward from centroid
    const midAngle = (mark.startAngle + mark.endAngle) / 2;
    const labelRadius = mark.outerRadius + LEADER_LINE_OFFSET;

    const labelX = centerX + Math.sin(midAngle) * labelRadius;
    const labelY = centerY - Math.cos(midAngle) * labelRadius;

    // Determine text anchor based on which side of the pie the label is on
    const isRight = Math.sin(midAngle) > 0;

    candidates.push({
      text: labelText,
      anchorX: isRight ? labelX : labelX - textWidth,
      anchorY: labelY - textHeight / 2,
      width: textWidth,
      height: textHeight,
      priority: 'data',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill: _textFill,
        lineHeight: 1.2,
        textAnchor: isRight ? 'start' : 'end',
        dominantBaseline: 'central',
        fontVariant: 'tabular-nums',
      },
    });

    targetMarkIndices.push(mi);
  }

  if (candidates.length === 0) return [];

  // 'all': skip collision detection, mark everything visible
  let resolved: ResolvedLabel[];
  if (density === 'all') {
    resolved = candidates.map((c) => ({
      text: c.text,
      x: c.anchorX,
      y: c.anchorY,
      style: c.style,
      visible: true,
    }));
  } else {
    // Run collision detection
    resolved = resolveCollisions(candidates);
  }

  // Add connector lines from centroid to label
  for (let i = 0; i < resolved.length && i < targetMarks.length; i++) {
    const label = resolved[i];
    const mark = targetMarks[i];

    if (label.visible) {
      label.connector = {
        from: { x: label.x, y: label.y },
        to: { x: mark.centroid.x, y: mark.centroid.y },
        stroke: _textFill,
        style: 'straight',
        arrow: false,
      };
    }
  }

  return resolved;
}
