/**
 * Column chart label computation.
 *
 * Produces value labels positioned above each column (for positive values)
 * or below (for negative values). Stacked segments are the exception: the
 * space above a segment's top edge belongs to the next segment up, not to the
 * background, so a stacked label is centered *inside* its own segment and
 * takes a contrasting fill (mirrors computeBarLabels).
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
  pickLabelColor,
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
/** Vertical padding inside a stacked segment, above and below the label. */
const LABEL_PADDING_Y = 2;

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
  darkMode = false,
  fontSize?: number,
  labelSuffix?: string,
): ResolvedLabel[] {
  const FONT_SIZE = fontSize ?? LABEL_FONT_SIZE;
  const targetMarks = filterByDensity(marks, density);

  const formatter = labelFormatter ?? null;

  const candidates: LabelCandidate[] = [];
  // Per-candidate knockout-halo flag; false for labels drawn inside a segment.
  const haloFlags: boolean[] = [];
  // Track whether each candidate fits inside its stacked segment. Non-stacked
  // columns label into open space above the bar, so they always fit.
  const fitsInSegment: boolean[] = [];

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

    // A stacked segment has another segment sitting directly on top of it, so
    // the "float above the top edge" placement used for plain columns would
    // drop the label into its neighbour — and tint it with this segment's
    // color, guaranteeing colored-text-on-colored-fill. Center it inside its
    // own segment instead and pick a fill that contrasts with that segment.
    const isStacked = mark.stackGroup !== undefined;

    // anchorY is the TOP of the label bounding box so the collision system's
    // AABB check (rect = { y: anchorY, height: textHeight }) is geometrically
    // correct. Collision math stays in top-coordinate space; the ascent shift
    // to the alphabetic baseline is applied only at emission (see below).
    //   Stacked:      top = segment center - textHeight / 2, text sits within
    //   Positive bar: top = barTop - LABEL_OFFSET_Y - textHeight, text floats above
    //   Negative bar: top = barBottom + LABEL_OFFSET_Y, text hangs below
    const anchorX = mark.x + mark.width / 2;
    let anchorY: number;
    let fill: string;

    if (isStacked) {
      anchorY = mark.y + mark.height / 2 - textHeight / 2;
      fill = labelColor ?? pickLabelColor(getRepresentativeColor(mark.fill), darkMode);
    } else {
      anchorY = isNegative
        ? mark.y + mark.height + LABEL_OFFSET_Y
        : mark.y - LABEL_OFFSET_Y - textHeight;
      fill = labelColor ?? getRepresentativeColor(mark.fill);
    }

    // A label only belongs inside a stacked segment if the segment is tall
    // enough to hold it; short segments (Nuclear at ~4%) would otherwise
    // overflow into their neighbours.
    fitsInSegment.push(!(isStacked && textHeight > mark.height - 2 * LABEL_PADDING_Y));

    // A stacked label sits ON its own segment fill, contrast-picked against it.
    // A surface-colored knockout stroke would ring every glyph, so only the
    // labels floating outside the bar get the halo.
    haloFlags.push(!isStacked);

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

  // Every density that reaches here ('all' and 'auto') pre-hides candidates
  // whose stacked segment is too short to hold them, then runs collision
  // resolution. 'all' just skips the density pre-filter above so every mark is
  // a candidate; colliding losers are still hidden by resolveCollisions rather
  // than stacked on top of each other.
  const fittingCandidates: LabelCandidate[] = [];
  const unfittingIndices = new Set<number>();
  for (let i = 0; i < candidates.length; i++) {
    if (fitsInSegment[i] === false) {
      unfittingIndices.add(i);
    } else {
      // Carry the original candidate index so we can zip the resolved output
      // back to it regardless of any reordering resolveCollisions performs.
      fittingCandidates.push({ ...candidates[i], index: i });
    }
  }

  // resolveCollisions may reorder its output (it sorts by priority), so key the
  // result by the source index we carried rather than by position.
  const resolvedByOrig = new Map<number, ResolvedLabel>();
  for (const r of resolveCollisions(fittingCandidates)) {
    if (r.index !== undefined) resolvedByOrig.set(r.index, r);
  }

  // Re-emit hidden labels rather than dropping them: the renderer zips
  // marks[i].label = labels[i], so the output must stay index-aligned.
  const results: ResolvedLabel[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (unfittingIndices.has(i)) {
      results.push({
        text: candidates[i].text,
        x: candidates[i].anchorX,
        y: candidates[i].anchorY + ascent,
        style: candidates[i].style,
        visible: false,
        ...(haloFlags[i] ? {} : { halo: false }),
      });
      continue;
    }

    const r = resolvedByOrig.get(i);
    if (!r) continue;
    // Drop the internal zip index so it doesn't leak into the label output.
    const { index: _index, ...rest } = r;
    results.push({
      ...rest,
      ...(haloFlags[i] ? {} : { halo: false }),
      y: r.y + ascent,
      // The connector originates at the label; shift its start to the baseline
      // too so the leader stays glued to the shifted text.
      connector: r.connector
        ? {
            ...r.connector,
            from: { ...r.connector.from, y: r.connector.from.y + ascent },
          }
        : undefined,
    });
  }

  return results;
}
