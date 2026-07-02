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
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_LINE_HEIGHT,
} from './constants';

export type AnnotationMeasureTextFn = (
  text: string,
  font: { fontSize: number; fontWeight: number; fontFamily?: string },
) => number;

export const heuristicMeasure: AnnotationMeasureTextFn = (text, { fontSize, fontWeight }) =>
  estimateTextWidth(text, fontSize, fontWeight);

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
  },
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): Rect {
  const lines = text.split('\n');
  const maxWidth = Math.max(
    ...lines.map((line) =>
      measure(line, { fontSize: style.fontSize, fontWeight: style.fontWeight }),
    ),
  );
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
 * @deprecated Use computeTextBlockBounds instead. Kept for backward compatibility
 * during migration.
 */
export function computeTextBounds(
  labelX: number,
  labelY: number,
  text: string,
  fontSize: number,
  fontWeight: number,
): Rect {
  const lines = text.split('\n');
  const isMultiLine = lines.length > 1;
  const anchor: 'start' | 'middle' = isMultiLine ? 'middle' : 'start';
  return computeTextBlockBounds(labelX, labelY, text, {
    fontSize,
    fontWeight,
    lineHeight: DEFAULT_LINE_HEIGHT,
    textAnchor: anchor,
  });
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

/**
 * Compute the connector origin point on the text bounding box.
 * For straight connectors, finds the edge midpoint (top, bottom, left, right)
 * closest to the data point. For curve connectors, always uses the right edge.
 */
export function computeConnectorOrigin(
  labelX: number,
  labelY: number,
  text: string,
  fontSize: number,
  fontWeight: number,
  targetX: number,
  targetY: number,
  connectorStyle: 'straight' | 'curve',
): { x: number; y: number } {
  const box = computeTextBounds(labelX, labelY, text, fontSize, fontWeight);
  const boxCenterX = box.x + box.width / 2;
  const boxCenterY = box.y + box.height / 2;

  // Curve connectors always start from the right edge
  if (connectorStyle === 'curve') {
    return {
      x: box.x + box.width,
      y: boxCenterY,
    };
  }

  // Normalize the vector from box center to target by the box half-dimensions.
  // This accounts for the box aspect ratio: a wide text box should prefer
  // top/bottom exits even when the target is also offset horizontally.
  const halfW = box.width / 2 || 1;
  const halfH = box.height / 2 || 1;
  const ndx = (targetX - boxCenterX) / halfW;
  const ndy = (targetY - boxCenterY) / halfH;

  if (Math.abs(ndy) >= Math.abs(ndx)) {
    // Target is more above/below than left/right → use top or bottom edge
    return ndy < 0
      ? { x: boxCenterX, y: box.y } // top
      : { x: boxCenterX, y: box.y + box.height }; // bottom
  }
  // Target is more left/right → use left or right edge
  return ndx < 0
    ? { x: box.x, y: boxCenterY } // left
    : { x: box.x + box.width, y: boxCenterY }; // right
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
    },
    measure,
  );
}

/**
 * Recompute the connector origin for a label after it has been repositioned.
 * Encapsulates the pattern of recalculating which edge of the text box the
 * connector should exit from based on the target data point.
 */
export function recomputeConnector(
  label: ResolvedLabel,
  targetX: number,
  targetY: number,
): ResolvedLabel['connector'] {
  const connector = label.connector;
  if (!connector) return connector;

  const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = label.style.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  const connStyle = connector.style === 'curve' ? ('curve' as const) : ('straight' as const);
  const newFrom = computeConnectorOrigin(
    label.x,
    label.y,
    label.text,
    fontSize,
    fontWeight,
    targetX,
    targetY,
    connStyle,
  );
  return { ...connector, from: newFrom };
}
