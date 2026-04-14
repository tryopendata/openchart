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
import {
  buildD3Formatter,
  estimateTextWidth,
  getRepresentativeColor,
  resolveCollisions,
} from '@opendata-ai/openchart-core';
import { filterByDensity } from '../_shared/density-filter';
import { formatLabelValue } from '../_shared/format-label-value';

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
  labelFormat?: string,
  labelPrefix?: string,
  valueField?: string,
): ResolvedLabel[] {
  const targetMarks = filterByDensity(marks, density);

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
      valuePart = formatLabelValue(rawNum);
    } else {
      // Fallback: extract from aria label
      const ariaLabel = mark.aria.label;
      const lastColon = ariaLabel.lastIndexOf(':');
      const rawValue = lastColon >= 0 ? ariaLabel.slice(lastColon + 1).trim() : '';
      if (!rawValue) continue;
      if (formatter) {
        const num = Number(rawValue.replace(/[^0-9.-]/g, ''));
        valuePart = !Number.isNaN(num) ? formatter(num) : rawValue;
      } else {
        valuePart = rawValue;
      }
    }
    if (labelPrefix) valuePart = labelPrefix + valuePart;

    const numericValue = parseFloat(valuePart);
    const isNegative = Number.isFinite(numericValue) && numericValue < 0;

    const textWidth = estimateTextWidth(valuePart, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = LABEL_FONT_SIZE * 1.2;

    // For positive values, place label above the column top.
    // For negative values, place label below the column bottom.
    const anchorX = mark.x + mark.width / 2;
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
        fill: getRepresentativeColor(mark.fill),
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
