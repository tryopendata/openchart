/**
 * Range chart label computation (dumbbell style).
 *
 * Produces value labels at both ends of each dumbbell: outside the range span
 * so labels never sit on the connector. Horizontal ranges label left of the
 * lower-value dot and right of the higher-value dot; vertical ranges label
 * below the lower dot and above the upper dot.
 *
 * Respects the spec's label density setting the same way dot labels do:
 * - 'all': show every label, skip collision detection
 * - 'auto': collision detection drops overlapping labels
 * - 'endpoints': first and last rows only
 * - 'none': return empty array
 */

import type {
  LabelCandidate,
  LabelDensity,
  NumberFormatter,
  PointMark,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import {
  estimateTextWidth,
  getRepresentativeColor,
  resolveCollisions,
} from '@opendata-ai/openchart-core';
import { filterByDensity } from '../_shared/density-filter';
import { formatLabelValue } from '../_shared/format-label-value';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_SIZE = 11;
const LABEL_FONT_WEIGHT = 600;
const LABEL_OFFSET = 10;

/** A start/end dot pair for one data row. */
export interface RangeDotPair {
  start: PointMark;
  end: PointMark;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format one endpoint value using the spec's label format/prefix. */
function formatEndpoint(
  value: unknown,
  formatter: ((n: number) => string) | null,
  prefix: string | undefined,
): string | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const text = formatter ? formatter(num) : formatLabelValue(num);
  return prefix ? prefix + text : text;
}

/** Build one label candidate placed outside the range span. */
function buildCandidate(
  mark: PointMark,
  text: string,
  horizontal: boolean,
  outerSide: 'min' | 'max',
  index: number,
): LabelCandidate {
  const textWidth = estimateTextWidth(text, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT);
  const textHeight = LABEL_FONT_SIZE * 1.2;

  let anchorX: number;
  let anchorY: number;
  if (horizontal) {
    // 'min' dot: label to the left; 'max' dot: label to the right.
    anchorX =
      outerSide === 'min'
        ? mark.cx - mark.r - LABEL_OFFSET - textWidth
        : mark.cx + mark.r + LABEL_OFFSET;
    anchorY = mark.cy - textHeight / 2;
  } else {
    // SVG y grows downward: the 'min' value dot sits lower, label below it.
    anchorX = mark.cx - textWidth / 2;
    anchorY =
      outerSide === 'min'
        ? mark.cy + mark.r + LABEL_OFFSET - textHeight / 2
        : mark.cy - mark.r - LABEL_OFFSET - textHeight / 2;
  }

  return {
    text,
    anchorX,
    anchorY,
    width: textWidth,
    height: textHeight,
    priority: 'data',
    index,
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: LABEL_FONT_SIZE,
      fontWeight: LABEL_FONT_WEIGHT,
      fill: getRepresentativeColor(mark.fill),
      lineHeight: 1.2,
      textAnchor: 'start',
      dominantBaseline: 'central',
      fontVariant: 'tabular-nums',
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute both-end value labels for dumbbell range marks.
 *
 * Each returned label carries `index` = pairIndex * 2 (start dot) or
 * pairIndex * 2 + 1 (end dot) so the caller can attach labels back onto the
 * right dot marks after density filtering. Labels dropped by collision
 * resolution come back with `visible: false`.
 */
export function computeRangeLabels(
  pairs: RangeDotPair[],
  horizontal: boolean,
  density: LabelDensity = 'auto',
  labelPrefix?: string,
  labelFormatter?: NumberFormatter | null,
  startField?: string,
  endField?: string,
): ResolvedLabel[] {
  if (density === 'none' || !startField || !endField) return [];

  const indexed = pairs.map((pair, pairIndex) => ({ pair, pairIndex }));
  const targetPairs = filterByDensity(indexed, density);
  const formatter = labelFormatter ?? null;
  const candidates: LabelCandidate[] = [];

  for (const { pair, pairIndex } of targetPairs) {
    const startText = formatEndpoint(pair.start.data[startField], formatter, labelPrefix);
    const endText = formatEndpoint(pair.end.data[endField], formatter, labelPrefix);
    if (startText == null || endText == null) continue;

    // Place each label on the outer side of its dot. For horizontal ranges
    // the lower pixel position is the left dot; vertical is inverted (SVG y
    // grows downward), so the larger cy is the lower-value dot.
    const startIsMin = horizontal ? pair.start.cx <= pair.end.cx : pair.start.cy >= pair.end.cy;
    candidates.push(
      buildCandidate(pair.start, startText, horizontal, startIsMin ? 'min' : 'max', pairIndex * 2),
      buildCandidate(pair.end, endText, horizontal, startIsMin ? 'max' : 'min', pairIndex * 2 + 1),
    );
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
      index: c.index,
    }));
  }

  return resolveCollisions(candidates);
}
