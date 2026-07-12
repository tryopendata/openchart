/**
 * Geometry utilities for annotation text bounds, connector origins, and offsets.
 */

import type {
  AnnotationAnchor,
  AnnotationOffset,
  Rect,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import {
  ANCHOR_OFFSET,
  CONNECTOR_STANDOFF,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_LINE_HEIGHT,
  MIN_CONNECTOR_LENGTH,
} from './constants';
import { BOLD_SPAN_FONT_WEIGHT, parseAnnotationSpans } from './rich-text';

export type AnnotationMeasureTextFn = (
  text: string,
  font: { fontSize: number; fontWeight: number; fontFamily?: string },
) => number;

export const heuristicMeasure: AnnotationMeasureTextFn = (text, { fontSize, fontWeight }) =>
  estimateTextWidth(text, fontSize, fontWeight);

/**
 * Width of one line of annotation text, `**bold**` spans included: each span is
 * measured at its own weight and the widths are summed. Measuring the raw string
 * would count the `**` markers and use one weight for the whole line, so bounds,
 * collisions, placement, and connector exits would all be wrong for rich text.
 */
export function measureRichLine(
  line: string,
  style: { fontSize: number; fontWeight: number; fontFamily?: string },
  measure: AnnotationMeasureTextFn,
): number {
  const spans = parseAnnotationSpans(line);
  let width = 0;
  for (const span of spans) {
    width += measure(span.text, {
      fontSize: style.fontSize,
      fontWeight: span.bold ? BOLD_SPAN_FONT_WEIGHT : style.fontWeight,
      fontFamily: style.fontFamily,
    });
  }
  return width;
}

/**
 * Compute the bounding box of a text block, aware of textAnchor and multi-line layout.
 * labelY is the first-line baseline.
 */
export function computeTextBlockBounds(
  labelX: number,
  labelY: number,
  text: string,
  style: {
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    textAnchor?: 'start' | 'middle' | 'end';
    fontFamily?: string;
  },
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): Rect {
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map((line) => measureRichLine(line, style, measure)));
  const height =
    style.fontSize + (lines.length - 1) * style.fontSize * style.lineHeight + style.fontSize * 0.3;

  let x: number;
  if (style.textAnchor === 'middle') {
    x = labelX - maxWidth / 2;
  } else if (style.textAnchor === 'end') {
    x = labelX - maxWidth;
  } else {
    x = labelX;
  }

  return {
    x,
    y: labelY - style.fontSize,
    width: maxWidth,
    height,
  };
}

export function unionRects(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Apply anchor direction to compute label offset from data point.
 * Returns { dx, dy } pixel offsets.
 */
export function computeAnchorOffset(
  anchor: AnnotationAnchor | undefined,
  _px: number,
  py: number,
  chartArea: Rect,
): { dx: number; dy: number } {
  if (!anchor || anchor === 'auto') {
    // Auto: place above if in the lower half, below if upper half
    const isUpperHalf = py < chartArea.y + chartArea.height / 2;
    return isUpperHalf
      ? { dx: ANCHOR_OFFSET, dy: ANCHOR_OFFSET } // below-right
      : { dx: ANCHOR_OFFSET, dy: -ANCHOR_OFFSET }; // above-right
  }

  switch (anchor) {
    case 'top':
      return { dx: 0, dy: -ANCHOR_OFFSET };
    case 'bottom':
      return { dx: 0, dy: ANCHOR_OFFSET };
    case 'left':
      return { dx: -ANCHOR_OFFSET, dy: 0 };
    case 'right':
      return { dx: ANCHOR_OFFSET, dy: 0 };
  }
}

/** Apply user offset on top of computed anchor offset. */
export function applyOffset(
  base: { dx: number; dy: number },
  offset: AnnotationOffset | undefined,
): { dx: number; dy: number } {
  if (!offset) return base;
  return {
    dx: base.dx + (offset.dx ?? 0),
    dy: base.dy + (offset.dy ?? 0),
  };
}

/** Inflation applied to the label box before intersecting the connector ray. */
const BOX_INFLATE = 2;

/**
 * Compute where a connector leaves the annotation's text block on its way to the
 * target. Casts a ray from the box center toward the target, intersects the
 * (slightly inflated) box, then advances `standoff` px along the ray so the line
 * never touches the glyphs.
 *
 * Returns `null` when the target sits inside the inflated box (a connector would
 * cross its own text) or when the standoff would overshoot the target.
 */
export function connectorExit(
  bounds: Rect,
  targetX: number,
  targetY: number,
  standoff = CONNECTOR_STANDOFF,
): { x: number; y: number; exit: 'horizontal' | 'vertical' } | null {
  const box = {
    x: bounds.x - BOX_INFLATE,
    y: bounds.y - BOX_INFLATE,
    width: bounds.width + BOX_INFLATE * 2,
    height: bounds.height + BOX_INFLATE * 2,
  };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const halfW = box.width / 2;
  const halfH = box.height / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;

  // Target inside the inflated box: any connector would cross the text.
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return null;
  if (dx === 0 && dy === 0) return null;

  // Parametric ray: center + t * (dx, dy). Find the smallest t that lands on an
  // edge of the box, and which axis that edge belongs to.
  const tx = halfW > 0 && dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = halfH > 0 && dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  if (!Number.isFinite(t)) return null;

  const exit: 'horizontal' | 'vertical' = tx <= ty ? 'horizontal' : 'vertical';

  const edgeX = cx + dx * t;
  const edgeY = cy + dy * t;

  // Advance along the ray by the standoff distance.
  const rayLen = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / rayLen;
  const uy = dy / rayLen;

  // Overshoot guard: the standoff must not push the origin past the target.
  // Measure edge-to-target in pixels rather than scaling the ray by (1 - t):
  // t is a ratio of box extents, so that form understates the clearance when the
  // ray leaves through the long side of a wide label, and killed connectors that
  // had ample room. Whether the line is long enough to be worth drawing is
  // decided downstream against MIN_CONNECTOR_LENGTH, once the marker pullback is
  // known — this guard only rejects a standoff that would overshoot the target.
  const edgeToTarget = Math.hypot(targetX - edgeX, targetY - edgeY);
  if (standoff >= edgeToTarget) return null;

  const x = edgeX + ux * standoff;
  const y = edgeY + uy * standoff;

  return { x, y, exit };
}

/** Estimate the bounding box of an annotation label using its resolved style. */
export function estimateLabelBounds(
  label: ResolvedLabel,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): Rect {
  const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = label.style.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  return computeTextBlockBounds(
    label.x,
    label.y,
    label.text,
    {
      fontSize,
      fontWeight,
      lineHeight: label.style.lineHeight ?? DEFAULT_LINE_HEIGHT,
      textAnchor: label.style.textAnchor ?? 'start',
      fontFamily: label.style.fontFamily,
    },
    measure,
  );
}

/** Arrowhead triangle points: tip + two base corners. */
export interface ArrowheadPoints {
  tip: { x: number; y: number };
  baseLeft: { x: number; y: number };
  baseRight: { x: number; y: number };
}

/**
 * Compute arrowhead triangle geometry at a connector endpoint.
 * Returns the tip (at the endpoint) and two base corners perpendicular to the
 * tangent direction.
 *
 * @param tipX - X coordinate of the arrowhead tip
 * @param tipY - Y coordinate of the arrowhead tip
 * @param tangentX - X component of the tangent direction (toward the tip)
 * @param tangentY - Y component of the tangent direction (toward the tip)
 * @param length - Arrow length along the tangent (default 7)
 * @param halfWidth - Arrow half-width perpendicular to tangent (default 3.5)
 */
export function computeArrowheadPoints(
  tipX: number,
  tipY: number,
  tangentX: number,
  tangentY: number,
  length = 7,
  halfWidth = 3.5,
): ArrowheadPoints {
  const tLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
  const ux = tangentX / tLen;
  const uy = tangentY / tLen;

  const baseX = tipX - ux * length;
  const baseY = tipY - uy * length;

  const px = -uy;
  const py = ux;

  return {
    tip: { x: tipX, y: tipY },
    baseLeft: { x: baseX + px * halfWidth, y: baseY + py * halfWidth },
    baseRight: { x: baseX - px * halfWidth, y: baseY - py * halfWidth },
  };
}

/**
 * Distance the connector's data-point end is pulled back so the line stops short
 * of the endpoint marker instead of piercing it.
 */
export function connectorPullbackGap(markerRadius: number, arrow: boolean): number {
  return arrow ? Math.max(markerRadius + 2, 2) : Math.max(markerRadius + 3, 4);
}

/**
 * Rebuild a connector's geometry against a (possibly moved) annotation bounds.
 *
 * `from` comes from the ray-box exit; `to` is recomputed by pulling back from
 * `connector.endpoint` — never from the already-pulled-back `to`, which would
 * shrink the line a little more on every pass.
 *
 * Returns `undefined` when the connector should be suppressed: the target sits
 * inside the text block, or the resulting line is shorter than
 * `MIN_CONNECTOR_LENGTH`.
 */
export function refreshConnector(
  connector: NonNullable<ResolvedLabel['connector']>,
  bounds: Rect,
  markerRadius: number,
): ResolvedLabel['connector'] {
  const endpoint = connector.endpoint ?? connector.to;

  const exit = connectorExit(bounds, endpoint.x, endpoint.y);
  if (!exit) return undefined;

  const from = { x: exit.x, y: exit.y };

  const gap = connectorPullbackGap(markerRadius, connector.arrow);
  const cdx = endpoint.x - from.x;
  const cdy = endpoint.y - from.y;
  const dist = Math.sqrt(cdx * cdx + cdy * cdy);
  const to =
    dist > 0
      ? { x: endpoint.x - (cdx / dist) * gap, y: endpoint.y - (cdy / dist) * gap }
      : { ...endpoint };

  // Min-length check runs AFTER the pullback: a near-degenerate line can flip
  // direction once its end is pulled back, and checking first would miss it.
  const lx = to.x - from.x;
  const ly = to.y - from.y;
  if (Math.sqrt(lx * lx + ly * ly) < MIN_CONNECTOR_LENGTH) return undefined;

  return { ...connector, from, to, exit: exit.exit };
}
