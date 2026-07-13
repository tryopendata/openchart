/**
 * Column chart label computation.
 *
 * Produces value labels positioned above each column (for positive values)
 * or below (for negative values).
 *
 * Respects the spec's label density setting:
 * - 'all': consider every column's label (no density pre-filter), but still
 *   run collision resolution so colliding losers are hidden rather than drawn
 *   on top of each other
 * - 'auto': existing behavior (density pre-filter + collision detection)
 * - 'endpoints': first and last columns only
 * - 'none': return empty array
 */

import type {
  LabelCandidate,
  LabelDensity,
  NumberFormatter,
  RectMark,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import {
  estimateTextWidth,
  getRepresentativeColor,
  resolveCollisions,
  textAscent,
} from '@opendata-ai/openchart-core';
import { filterByDensity } from '../_shared/density-filter';
import { formatLabelValue } from '../_shared/format-label-value';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_OFFSET_Y = 8;

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
  labelFormatter?: NumberFormatter | null,
  labelPrefix?: string,
  valueField?: string,
  labelColor?: string,
  fontSize?: number,
  labelSuffix?: string,
): ResolvedLabel[] {
  const FONT_SIZE = fontSize ?? LABEL_FONT_SIZE;
  const targetMarks = filterByDensity(marks, density);

  const formatter = labelFormatter ?? null;

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
      if (!ariaLabel) continue;
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
    const numericValue = parseFloat(valuePart);
    const isNegative = Number.isFinite(numericValue) && numericValue < 0;

    if (labelPrefix) valuePart = labelPrefix + valuePart;
    if (labelSuffix) valuePart = valuePart + labelSuffix;

    const textWidth = estimateTextWidth(valuePart, FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = FONT_SIZE * 1.2;

    // anchorY is the TOP of the label bounding box so the collision system's
    // AABB check (rect = { y: anchorY, height: textHeight }) is geometrically
    // correct. Collision math stays in top-coordinate space; the ascent shift
    // to the alphabetic baseline is applied only at emission (see below).
    //   Positive bar: top = barTop - LABEL_OFFSET_Y - textHeight, text floats above
    //   Negative bar: top = barBottom + LABEL_OFFSET_Y, text hangs below
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
        fontSize: FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill: labelColor ?? getRepresentativeColor(mark.fill),
        lineHeight: 1.2,
        textAnchor: 'middle',
        fontVariant: 'tabular-nums',
      },
    });
  }

  if (candidates.length === 0) return [];

  // Collision resolution keeps y in top-edge coordinates; renderers position
  // text on the alphabetic baseline, so shift every emitted y down by the
  // ascent instead of relying on dominant-baseline:hanging (WebKit computes
  // hanging from different font metrics than Blink, clipping labels on iOS).
  const ascent = textAscent(FONT_SIZE);

  // Every density that reaches here ('all' and 'auto') runs collision
  // resolution. 'all' just skips the density pre-filter above so every mark is
  // a candidate; colliding losers are still hidden by resolveCollisions rather
  // than stacked on top of each other.
  return resolveCollisions(candidates).map((label) => ({
    ...label,
    y: label.y + ascent,
    // The connector originates at the label; shift its start to the baseline
    // too so the leader stays glued to the shifted text.
    connector: label.connector
      ? {
          ...label.connector,
          from: { ...label.connector.from, y: label.connector.from.y + ascent },
        }
      : undefined,
  }));
}
