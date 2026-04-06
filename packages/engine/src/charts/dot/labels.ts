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
  abbreviateNumber,
  buildD3Formatter,
  estimateTextWidth,
  formatNumber,
  getRepresentativeColor,
  resolveCollisions,
} from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a dot value for display (abbreviate large numbers). */
function formatDotValue(value: number): string {
  if (Math.abs(value) >= 1000) return abbreviateNumber(value);
  return formatNumber(value);
}

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
  labelFormat?: string,
  valueField?: string,
): ResolvedLabel[] {
  // 'none': no labels at all
  if (density === 'none') return [];

  // Filter marks for 'endpoints' density
  const targetMarks =
    density === 'endpoints' && marks.length > 1 ? [marks[0], marks[marks.length - 1]] : marks;

  const formatter = buildD3Formatter(labelFormat);
  const candidates: LabelCandidate[] = [];

  for (const mark of targetMarks) {
    // Get the original numeric value from the data row when possible,
    // falling back to parsing the aria label (which may lose precision
    // due to abbreviation rounding, e.g. 1955 → "2K" → 2000).
    let valuePart: string;
    const rawNum = valueField != null ? Number(mark.data[valueField]) : NaN;

    if (formatter && Number.isFinite(rawNum)) {
      valuePart = formatter(rawNum);
    } else if (Number.isFinite(rawNum)) {
      valuePart = formatDotValue(rawNum);
    } else {
      // Fallback: extract from aria label
      const ariaLabel = mark.aria.label;
      const lastColon = ariaLabel.lastIndexOf(':');
      valuePart = lastColon >= 0 ? ariaLabel.slice(lastColon + 1).trim() : '';
      if (!valuePart) continue;
      if (formatter) {
        const num = Number(valuePart.replace(/[^0-9.-]/g, ''));
        if (!Number.isNaN(num)) valuePart = formatter(num);
      }
    }
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
