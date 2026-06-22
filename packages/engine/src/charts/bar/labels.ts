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
  pickLabelColor,
  resolveCollisions,
} from '@opendata-ai/openchart-core';
import { filterByDensity } from '../_shared/density-filter';
import { formatLabelValue } from '../_shared/format-label-value';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Suffix multipliers mirroring core's abbreviateNumber output (K/M/B/T). */
const SUFFIX_MULTIPLIERS: Record<string, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
  T: 1_000_000_000_000,
};

/**
 * Parse a numeric string that may include comma separators and/or a
 * K/M/B/T abbreviation suffix (as produced by `abbreviateNumber`).
 * Returns NaN when the string cannot be parsed.
 */
function parseDisplayNumber(raw: string): number {
  // Normalize Unicode minus (U+2212, produced by d3-format) to ASCII hyphen-minus
  const trimmed = raw.trim().replace(/\u2212/g, '-');
  if (!trimmed) return NaN;

  // Check for trailing abbreviation suffix (case-insensitive)
  const last = trimmed[trimmed.length - 1].toUpperCase();
  const multiplier = SUFFIX_MULTIPLIERS[last];
  if (multiplier) {
    const numPart = trimmed.slice(0, -1).replace(/,/g, '');
    const n = Number(numPart);
    return Number.isNaN(n) ? NaN : n * multiplier;
  }

  // Strip literal % suffix (e.g., from "+.0f%" d3-format strings)
  if (last === '%') {
    return Number(trimmed.slice(0, -1).replace(/,/g, ''));
  }

  // No suffix — strip commas and parse
  return Number(trimmed.replace(/,/g, ''));
}

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
  labelFormat?: string,
  labelPrefix?: string,
  valueField?: string,
  labelColor?: string,
  darkMode = false,
  fontSize?: number,
): ResolvedLabel[] {
  const FONT_SIZE = fontSize ?? LABEL_FONT_SIZE;
  const targetMarks = filterByDensity(marks, density);

  const candidates: LabelCandidate[] = [];
  // Track whether each candidate fits within its stacked segment.
  // Non-stacked bars are always considered fitting (undefined = fits).
  const fitsInSegment: boolean[] = [];

  const formatter = buildD3Formatter(labelFormat);

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
        const num = parseDisplayNumber(rawValue);
        valuePart = !Number.isNaN(num) ? formatter(num) : rawValue;
      } else {
        valuePart = rawValue;
      }
    }
    if (labelPrefix) valuePart = labelPrefix + valuePart;

    const textWidth = estimateTextWidth(valuePart, FONT_SIZE, LABEL_FONT_WEIGHT);
    const textHeight = FONT_SIZE * 1.2;

    // Detect stacked bars: cornerRadius 0 indicates stacked segment
    const isStacked = mark.stackGroup !== undefined;

    // Determine if label goes inside or outside the bar
    const isInside = mark.width >= MIN_WIDTH_FOR_INSIDE_LABEL;
    const isNegative = Number.isFinite(rawNum) ? rawNum < 0 : false;
    const bgColor = getRepresentativeColor(mark.fill);

    let anchorX: number;
    let fill: string;
    let textAnchor: 'start' | 'end' | 'middle';

    if (isStacked && isInside) {
      // Stacked: centered within segment
      anchorX = mark.x + mark.width / 2;
      fill = pickLabelColor(bgColor, darkMode);
      textAnchor = 'middle';
    } else if (isInside) {
      if (isNegative) {
        // Negative bar: left-aligned within bar (bar extends leftward)
        anchorX = mark.x + LABEL_PADDING;
        fill = pickLabelColor(bgColor, darkMode);
        textAnchor = 'start';
      } else {
        // Positive bar: right-aligned within bar
        anchorX = mark.x + mark.width - LABEL_PADDING;
        fill = pickLabelColor(bgColor, darkMode);
        textAnchor = 'end';
      }
    } else {
      if (isNegative) {
        // Outside negative bar: just past the bar's left edge
        anchorX = mark.x - LABEL_PADDING;
        fill = labelColor ?? getRepresentativeColor(mark.fill);
        textAnchor = 'end';
      } else {
        // Outside positive bar: just past the bar's right edge
        anchorX = mark.x + mark.width + LABEL_PADDING;
        fill = labelColor ?? getRepresentativeColor(mark.fill);
        textAnchor = 'start';
      }
    }

    // anchorY = bar vertical center. With dominant-baseline: central,
    // SVG places the text center at this y coordinate.
    const anchorY = mark.y + mark.height / 2;

    // Check if label text fits within the stacked segment
    const fits = !(isStacked && textWidth > mark.width - 2 * LABEL_PADDING);

    fitsInSegment.push(fits);
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
        fill,
        lineHeight: 1.2,
        textAnchor,
        dominantBaseline: 'central',
      },
    });
  }

  if (candidates.length === 0) return [];

  // 'all': skip collision detection, mark everything visible
  // (but hide labels that don't fit in their stacked segment)
  if (density === 'all') {
    return candidates.map((c, i) => ({
      text: c.text,
      x: c.anchorX,
      y: c.anchorY,
      style: c.style,
      visible: fitsInSegment[i] !== false,
    }));
  }

  // For 'auto' and 'endpoints': pre-mark candidates that don't fit their
  // stacked segment as hidden before running collision detection.
  const fittingCandidates: LabelCandidate[] = [];
  const unfittingIndices = new Set<number>();
  for (let i = 0; i < candidates.length; i++) {
    if (fitsInSegment[i] === false) {
      unfittingIndices.add(i);
    } else {
      fittingCandidates.push(candidates[i]);
    }
  }

  const resolved = resolveCollisions(fittingCandidates);

  // Re-insert hidden labels for candidates that didn't fit, preserving order
  const results: ResolvedLabel[] = [];
  let resolvedIdx = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (unfittingIndices.has(i)) {
      results.push({
        text: candidates[i].text,
        x: candidates[i].anchorX,
        y: candidates[i].anchorY,
        style: candidates[i].style,
        visible: false,
      });
    } else {
      results.push(resolved[resolvedIdx++]);
    }
  }

  return results;
}
