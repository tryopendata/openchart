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

const LABEL_FONT_SIZE = 11;
const LABEL_FONT_WEIGHT = 500;
const LEADER_LINE_OFFSET = 12;

/** Theme-derived options for pie/donut leader-line labels. */
export interface PieLabelOptions {
  /** Font family for the label text. Defaults to the system stack. */
  fontFamily?: string;
  /**
   * Formats the slice's raw value. Supplied only when the author set
   * `labels.format`; otherwise the label shows the slice's percent share.
   */
  formatValue?: (value: number) => string;
}

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
  options: PieLabelOptions = {},
): ResolvedLabel[] {
  const fontFamily = options.fontFamily ?? 'system-ui, -apple-system, sans-serif';
  const formatValue = options.formatValue;
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
    // Extract the slice name and its share from the aria label, whose format
    // is "Category: value (percent%)". Split on the FIRST colon so category
    // names containing colons survive, and take the LAST parenthesised group
    // as the percent. A name alone is a chart the reader has to eyeball, so
    // the label carries the number too: the percent by default, or the
    // formatted raw value when the author set `labels.format`.
    const ariaLabel = mark.aria.label;
    if (!ariaLabel) continue;
    const firstColon = ariaLabel.indexOf(':');
    const sliceName = firstColon >= 0 ? ariaLabel.slice(0, firstColon).trim() : '';
    if (!sliceName) continue;
    const openParen = ariaLabel.lastIndexOf('(');
    const closeParen = ariaLabel.lastIndexOf(')');
    const percentText =
      openParen > firstColon && closeParen > openParen
        ? ariaLabel.slice(openParen + 1, closeParen).trim()
        : '';
    const rawValueText =
      openParen > firstColon ? ariaLabel.slice(firstColon + 1, openParen).trim() : '';
    const rawValue = Number(rawValueText);
    const valueText =
      formatValue && Number.isFinite(rawValue) ? formatValue(rawValue) : percentText;
    const labelText = valueText ? `${sliceName} ${valueText}` : sliceName;

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
      // Index into the ORIGINAL marks array, not `targetMarks`. Density
      // filtering drops slices and resolveCollisions re-sorts by priority, so
      // the returned labels line up with neither. Callers assign by this index
      // instead of zipping positionally.
      index: marks.indexOf(mark),
      style: {
        fontFamily,
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
      ...(c.index !== undefined ? { index: c.index } : {}),
    }));
  } else {
    // Run collision detection
    resolved = resolveCollisions(candidates);
  }

  // Add connector lines from centroid to label. Resolve the mark through the
  // carried index: after collision sorting, resolved[i] is not targetMarks[i],
  // so zipping positionally drew connectors to the wrong slice.
  for (let i = 0; i < resolved.length; i++) {
    const label = resolved[i];
    const mark = label.index !== undefined ? marks[label.index] : undefined;
    if (!mark) continue;

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
