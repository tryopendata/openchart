/**
 * Reference line annotation resolver: creates a horizontal or vertical
 * reference line at a data value with optional label.
 */

import type {
  Point,
  Rect,
  RefLineAnnotation,
  ResolvedAnnotation,
  ResolvedLabel,
  ThemeColors,
} from '@opendata-ai/openchart-core';
import type { ResolvedScales } from '../layout/scales';
import { DARK_REFLINE_STROKE, DEFAULT_REFLINE_DASH, LIGHT_REFLINE_STROKE } from './constants';
import { type AnnotationMeasureTextFn, applyOffset, heuristicMeasure } from './geometry';
import { annotationBlockBounds } from './move';
import { resolvePosition } from './position';
import { makeAnnotationLabelStyle } from './resolve-text';

export function resolveRefLineAnnotation(
  annotation: RefLineAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
  fontFamily?: string,
  colors?: ThemeColors,
): ResolvedAnnotation | null {
  let start: Point;
  let end: Point;

  if (annotation.y !== undefined) {
    // Horizontal reference line
    const yPx = resolvePosition(annotation.y, scales.y);
    if (yPx === null) return null;

    start = { x: chartArea.x, y: yPx };
    end = { x: chartArea.x + chartArea.width, y: yPx };
  } else if (annotation.x !== undefined) {
    // Vertical reference line
    const xPx = resolvePosition(annotation.x, scales.x);
    if (xPx === null) return null;

    start = { x: xPx, y: chartArea.y };
    end = { x: xPx, y: chartArea.y + chartArea.height };
  } else {
    return null;
  }

  // Determine dash pattern: strokeDash array wins, then style string
  let strokeDasharray: string | undefined;
  if (annotation.strokeDash && annotation.strokeDash.length > 0) {
    strokeDasharray = annotation.strokeDash.join(' ');
  } else if (annotation.style === 'dashed' || annotation.style === undefined) {
    strokeDasharray = DEFAULT_REFLINE_DASH;
  } else if (annotation.style === 'dotted') {
    strokeDasharray = '2 2';
  }
  // 'solid' gets no dasharray

  // Label placement on reflines. labelAnchor controls position:
  //
  // Horizontal reflines (y set):
  //   "left":   left end of line, above        "right"/"top" (default): right end, above
  //   "bottom": right end of line, below
  //
  // Vertical reflines (x set):
  //   "right": label to the left of the line, near top
  //   "bottom": label to the right of the line, near bottom
  //   "left"/"top" (default): label to the right of the line, near top
  let label: ResolvedLabel | undefined;
  if (annotation.label) {
    const isHorizontal = annotation.y !== undefined;
    const anchor = annotation.labelAnchor ?? (isHorizontal ? 'top' : 'left');

    let baseDx: number;
    let baseDy: number;
    let labelX: number;
    let labelY: number;
    let textAnchor: 'start' | 'middle' | 'end';

    if (isHorizontal) {
      if (anchor === 'left') {
        baseDx = 4;
        baseDy = -4;
        labelX = start.x;
        labelY = start.y;
        textAnchor = 'start';
      } else if (anchor === 'bottom') {
        baseDx = -4;
        baseDy = 14;
        labelX = end.x;
        labelY = end.y;
        textAnchor = 'end';
      } else {
        // 'right', 'top' (default), 'auto'
        baseDx = -4;
        baseDy = -4;
        labelX = end.x;
        labelY = end.y;
        textAnchor = 'end';
      }
    } else {
      // Vertical refline
      if (anchor === 'right') {
        baseDx = -4;
        baseDy = 14;
        labelX = start.x;
        labelY = start.y;
        textAnchor = 'end';
      } else if (anchor === 'bottom') {
        baseDx = 4;
        baseDy = -4;
        labelX = start.x;
        labelY = end.y;
        textAnchor = 'start';
      } else {
        // 'left', 'top' (default), 'auto' — label to the right of the line, near top
        baseDx = 4;
        baseDy = 14;
        labelX = start.x;
        labelY = start.y;
        textAnchor = 'start';
      }
    }

    if (annotation.labelPlacement) {
      const atStart =
        annotation.labelPlacement === 'start' ||
        (!isHorizontal && annotation.labelPlacement !== 'end');
      if (isHorizontal) {
        labelX = atStart ? start.x : end.x;
        labelY = start.y;
        baseDx = atStart ? 4 : -4;
        baseDy = anchor === 'bottom' ? 14 : -4;
        textAnchor = atStart ? 'start' : 'end';
      } else {
        labelX = start.x;
        labelY = atStart ? start.y : end.y;
        baseDx = anchor === 'right' ? -4 : 4;
        baseDy = atStart ? 14 : -4;
        textAnchor = anchor === 'right' ? 'end' : 'start';
      }
    }
    const labelDelta = applyOffset({ dx: baseDx, dy: baseDy }, annotation.labelOffset);

    const defaultStroke =
      colors?.annotationRule ?? (isDark ? DARK_REFLINE_STROKE : LIGHT_REFLINE_STROKE);
    const style = makeAnnotationLabelStyle(
      annotation.fontSize ?? 11,
      annotation.fontWeight ?? 400,
      annotation.stroke ?? defaultStroke,
      isDark,
      fontFamily,
    );
    style.textAnchor = textAnchor;

    label = {
      text: annotation.label,
      x: labelX + labelDelta.dx,
      y: labelY + labelDelta.dy,
      style,
      visible: true,
    };
  }

  const defaultStroke =
    colors?.annotationRule ?? (isDark ? DARK_REFLINE_STROKE : LIGHT_REFLINE_STROKE);

  const resolved: ResolvedAnnotation = {
    type: 'refline',
    id: annotation.id,
    line: { start, end },
    label,
    stroke: annotation.stroke ?? defaultStroke,
    strokeDasharray,
    strokeWidth: annotation.strokeWidth ?? 1,
    zIndex: annotation.zIndex,
  };

  // Measure the label so it is a first-class citizen of the collision passes:
  // without bounds a refline label is invisible to the obstacle nudge, to the
  // greedy text pass, and to the auto-placement search, which is why callouts
  // printed on top of "avg: 168K".
  if (label) {
    resolved.bounds = annotationBlockBounds(resolved, label, measure);
  }

  return resolved;
}
