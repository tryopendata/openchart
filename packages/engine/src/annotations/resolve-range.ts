/**
 * Range annotation resolver: creates a highlighted rectangular band
 * between two data values on x or y axis.
 */

import type {
  RangeAnnotation,
  Rect,
  ResolvedAnnotation,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import type { ResolvedScales } from '../layout/scales';
import { DEFAULT_RANGE_FILL, DEFAULT_RANGE_OPACITY } from './constants';
import { applyOffset } from './geometry';
import { resolvePositionEdge } from './position';
import { makeAnnotationLabelStyle } from './resolve-text';

export function resolveRangeAnnotation(
  annotation: RangeAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
): ResolvedAnnotation | null {
  let x = chartArea.x;
  let y = chartArea.y;
  let width = chartArea.width;
  let height = chartArea.height;

  // X-range (vertical band)
  if (annotation.x1 !== undefined && annotation.x2 !== undefined) {
    const x1px = resolvePositionEdge(annotation.x1, scales.x, 'start');
    const x2px = resolvePositionEdge(annotation.x2, scales.x, 'end');
    if (x1px === null || x2px === null) return null;

    x = Math.min(x1px, x2px);
    width = Math.abs(x2px - x1px);
  }

  // Y-range (horizontal band)
  if (annotation.y1 !== undefined && annotation.y2 !== undefined) {
    const y1px = resolvePositionEdge(annotation.y1, scales.y, 'end');
    const y2px = resolvePositionEdge(annotation.y2, scales.y, 'start');
    if (y1px === null || y2px === null) return null;

    y = Math.min(y1px, y2px);
    height = Math.abs(y2px - y1px);
  }

  const rect: Rect = { x, y, width, height };

  // Label positioned within the range, with optional offset.
  // labelAnchor controls horizontal placement:
  //   "top" (default): horizontally centered, text-anchor middle
  //   "left": left edge, text-anchor start
  //   "right": right edge, text-anchor end
  //   "bottom"/"auto": horizontally centered, text-anchor middle
  let label: ResolvedLabel | undefined;
  if (annotation.label) {
    const anchor = annotation.labelAnchor ?? 'top';
    const centered = anchor === 'top' || anchor === 'bottom' || anchor === 'auto';
    const baseDx = centered ? 0 : anchor === 'right' ? -4 : 4;
    const baseDy = 14;
    const labelDelta = applyOffset({ dx: baseDx, dy: baseDy }, annotation.labelOffset);

    const style = makeAnnotationLabelStyle(
      annotation.fontSize ?? 11,
      annotation.fontWeight ?? 500,
      undefined,
      isDark,
    );
    if (centered) {
      style.textAnchor = 'middle';
    } else if (anchor === 'right') {
      style.textAnchor = 'end';
    }

    // Position label horizontally centered within the range band by default.
    // For left/right anchors, position at the respective edge.
    const baseX = centered ? x + width / 2 : anchor === 'right' ? x + width : x;

    label = {
      text: annotation.label,
      x: baseX + labelDelta.dx,
      y: y + labelDelta.dy,
      style,
      visible: true,
    };
  }

  // In dark mode, boost range opacity slightly for better visibility
  const defaultOpacity = isDark ? 0.2 : DEFAULT_RANGE_OPACITY;

  return {
    type: 'range',
    id: annotation.id,
    rect,
    label,
    fill: annotation.fill ?? DEFAULT_RANGE_FILL,
    opacity: annotation.opacity ?? defaultOpacity,
    stroke: annotation.stroke,
    zIndex: annotation.zIndex,
  };
}
