/**
 * Annotation computation: converts spec-level annotations to pixel-positioned
 * ResolvedAnnotation objects using the resolved scales.
 *
 * Handles three annotation types:
 * - text: positioned at a data coordinate with an optional callout
 * - range: a highlighted rectangle between two data values
 * - refline: a horizontal or vertical reference line at a data value
 *
 * Supports fine-grained positioning via offset, anchor, connector, and zIndex.
 * At compact breakpoints, annotations are simplified or hidden.
 */

import type {
  AnnotationAnchor,
  AnnotationOffset,
  LayoutStrategy,
  Point,
  RangeAnnotation,
  Rect,
  RefLineAnnotation,
  ResolvedAnnotation,
  ResolvedLabel,
  TextAnnotation,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear, ScaleTime } from 'd3-scale';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_ANNOTATION_FONT_SIZE = 12;
const DEFAULT_ANNOTATION_FONT_WEIGHT = 400;
const DEFAULT_LINE_HEIGHT = 1.3;
const DEFAULT_RANGE_FILL = '#f0c040';
const DEFAULT_RANGE_OPACITY = 0.15;
const DEFAULT_REFLINE_DASH = '4 3';

// Theme-aware defaults for text and stroke colors
const LIGHT_TEXT_FILL = '#333333';
const DARK_TEXT_FILL = '#d1d5db';
const LIGHT_REFLINE_STROKE = '#888888';
const DARK_REFLINE_STROKE = '#9ca3af';

/** Default label offset when using anchor directions. */
const ANCHOR_OFFSET = 8;

/** Resolve a data value to a pixel position on a given axis. */
function resolvePosition(
  value: string | number,
  scale: ResolvedScales['x'] | ResolvedScales['y'],
): number | null {
  if (!scale) return null;

  const s = scale.scale;
  const type = scale.type;

  if (type === 'time') {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return (s as ScaleTime<number, number>)(date);
  }

  if (type === 'linear' || type === 'log') {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    return (s as ScaleLinear<number, number>)(num);
  }

  if (type === 'band') {
    const bandScale = s as ScaleBand<string>;
    const pos = bandScale(String(value));
    if (pos === undefined) return null;
    return pos + (bandScale.bandwidth?.() ?? 0) / 2;
  }

  // point or ordinal: try calling it directly
  try {
    return (s as (v: string) => number)(String(value));
  } catch {
    return null;
  }
}

function makeAnnotationLabelStyle(
  fontSize?: number,
  fontWeight?: number,
  fill?: string,
  isDark?: boolean,
): TextStyle {
  const defaultFill = isDark ? DARK_TEXT_FILL : LIGHT_TEXT_FILL;
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE,
    fontWeight: fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT,
    fill: fill ?? defaultFill,
    lineHeight: DEFAULT_LINE_HEIGHT,
    textAnchor: 'start',
  };
}

/**
 * Compute the bounding box of annotation text at a given label position.
 * Multi-line text is centered at labelX; single-line starts at labelX.
 */
function computeTextBounds(
  labelX: number,
  labelY: number,
  text: string,
  fontSize: number,
  fontWeight: number,
): Rect {
  const lines = text.split('\n');
  const isMultiLine = lines.length > 1;
  const maxWidth = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize, fontWeight)));
  const totalHeight = lines.length * fontSize * DEFAULT_LINE_HEIGHT;
  const x = isMultiLine ? labelX - maxWidth / 2 : labelX;

  return {
    x,
    y: labelY - fontSize,
    width: maxWidth,
    height: totalHeight,
  };
}

/**
 * Apply anchor direction to compute label offset from data point.
 * Returns { dx, dy } pixel offsets.
 */
function computeAnchorOffset(
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
function applyOffset(
  base: { dx: number; dy: number },
  offset: AnnotationOffset | undefined,
): { dx: number; dy: number } {
  if (!offset) return base;
  return {
    dx: base.dx + (offset.dx ?? 0),
    dy: base.dy + (offset.dy ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Connector origin: pick the edge midpoint closest to the data point
// ---------------------------------------------------------------------------

/**
 * Compute the connector origin point on the text bounding box.
 * For straight connectors, finds the edge midpoint (top, bottom, left, right)
 * closest to the data point. For curve connectors, always uses the right edge.
 */
function computeConnectorOrigin(
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

// ---------------------------------------------------------------------------
// Text annotation
// ---------------------------------------------------------------------------

function resolveTextAnnotation(
  annotation: TextAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
): ResolvedAnnotation | null {
  const px = resolvePosition(annotation.x, scales.x);
  const py = resolvePosition(annotation.y, scales.y);

  if (px === null || py === null) return null;

  const defaultTextFill = isDark ? DARK_TEXT_FILL : LIGHT_TEXT_FILL;
  const labelStyle = makeAnnotationLabelStyle(
    annotation.fontSize,
    annotation.fontWeight,
    annotation.fill ?? defaultTextFill,
    isDark,
  );

  // Compute position from anchor direction + user offset
  const anchorDelta = computeAnchorOffset(annotation.anchor, px, py, chartArea);
  const finalDelta = applyOffset(anchorDelta, annotation.offset);

  const labelX = px + finalDelta.dx;
  const labelY = py + finalDelta.dy;

  // Connector: draw unless explicitly disabled
  const showConnector = annotation.connector !== false;
  const connectorStyle = annotation.connector === 'curve' ? 'curve' : 'straight';

  // Compute connector origin: pick the edge midpoint closest to the data point
  const fontSize = annotation.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = annotation.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  const { x: connectorFromX, y: connectorFromY } = computeConnectorOrigin(
    labelX,
    labelY,
    annotation.text,
    fontSize,
    fontWeight,
    px,
    py,
    connectorStyle,
  );

  // Apply user-provided connector endpoint offsets
  const baseFrom = { x: connectorFromX, y: connectorFromY };
  const baseTo = { x: px, y: py };
  const adjustedFrom = {
    x: baseFrom.x + (annotation.connectorOffset?.from?.dx ?? 0),
    y: baseFrom.y + (annotation.connectorOffset?.from?.dy ?? 0),
  };
  const adjustedToRaw = {
    x: baseTo.x + (annotation.connectorOffset?.to?.dx ?? 0),
    y: baseTo.y + (annotation.connectorOffset?.to?.dy ?? 0),
  };

  // Pull the "to" endpoint back along the connector direction so the
  // line doesn't touch the data point directly (leaves a small gap).
  const GAP = 4;
  const cdx = adjustedToRaw.x - adjustedFrom.x;
  const cdy = adjustedToRaw.y - adjustedFrom.y;
  const dist = Math.sqrt(cdx * cdx + cdy * cdy);
  const adjustedTo =
    dist > GAP * 2
      ? { x: adjustedToRaw.x - (cdx / dist) * GAP, y: adjustedToRaw.y - (cdy / dist) * GAP }
      : adjustedToRaw;

  const label: ResolvedLabel = {
    text: annotation.text,
    x: labelX,
    y: labelY,
    style: labelStyle,
    visible: true,
    connector: showConnector
      ? {
          from: adjustedFrom,
          to: adjustedTo,
          stroke: annotation.stroke ?? '#999999',
          style: connectorStyle,
        }
      : undefined,
    background: annotation.background,
  };

  return {
    type: 'text',
    label,
    stroke: annotation.stroke,
    fill: annotation.fill,
    opacity: annotation.opacity,
    zIndex: annotation.zIndex,
  };
}

// ---------------------------------------------------------------------------
// Range annotation
// ---------------------------------------------------------------------------

function resolveRangeAnnotation(
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
    const x1px = resolvePosition(annotation.x1, scales.x);
    const x2px = resolvePosition(annotation.x2, scales.x);
    if (x1px === null || x2px === null) return null;

    x = Math.min(x1px, x2px);
    width = Math.abs(x2px - x1px);
  }

  // Y-range (horizontal band)
  if (annotation.y1 !== undefined && annotation.y2 !== undefined) {
    const y1px = resolvePosition(annotation.y1, scales.y);
    const y2px = resolvePosition(annotation.y2, scales.y);
    if (y1px === null || y2px === null) return null;

    y = Math.min(y1px, y2px);
    height = Math.abs(y2px - y1px);
  }

  const rect: Rect = { x, y, width, height };

  // Label at the top-left of the range, with optional offset
  let label: ResolvedLabel | undefined;
  if (annotation.label) {
    const baseDx = 4;
    const baseDy = 14;
    const labelDelta = applyOffset({ dx: baseDx, dy: baseDy }, annotation.labelOffset);

    label = {
      text: annotation.label,
      x: x + labelDelta.dx,
      y: y + labelDelta.dy,
      style: makeAnnotationLabelStyle(11, 500, undefined, isDark),
      visible: true,
    };
  }

  // In dark mode, boost range opacity slightly for better visibility
  const defaultOpacity = isDark ? 0.2 : DEFAULT_RANGE_OPACITY;

  return {
    type: 'range',
    rect,
    label,
    fill: annotation.fill ?? DEFAULT_RANGE_FILL,
    opacity: annotation.opacity ?? defaultOpacity,
    stroke: annotation.stroke,
    zIndex: annotation.zIndex,
  };
}

// ---------------------------------------------------------------------------
// Reference line annotation
// ---------------------------------------------------------------------------

function resolveRefLineAnnotation(
  annotation: RefLineAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
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

  // Determine dash pattern from style
  let strokeDasharray: string | undefined;
  if (annotation.style === 'dashed' || annotation.style === undefined) {
    strokeDasharray = DEFAULT_REFLINE_DASH;
  } else if (annotation.style === 'dotted') {
    strokeDasharray = '2 2';
  }
  // 'solid' gets no dasharray

  // Label at the right end for horizontal, top end for vertical, with optional offset.
  // Horizontal refline labels use text-anchor 'end' so text stays inside the chart.
  let label: ResolvedLabel | undefined;
  if (annotation.label) {
    const isHorizontal = annotation.y !== undefined;
    const baseDx = isHorizontal ? -4 : 4;
    const baseDy = -4;
    const labelDelta = applyOffset({ dx: baseDx, dy: baseDy }, annotation.labelOffset);

    const defaultStroke = isDark ? DARK_REFLINE_STROKE : LIGHT_REFLINE_STROKE;
    const style = makeAnnotationLabelStyle(11, 400, annotation.stroke ?? defaultStroke, isDark);
    if (isHorizontal) {
      style.textAnchor = 'end';
    }

    label = {
      text: annotation.label,
      x: (isHorizontal ? end.x : start.x) + labelDelta.dx,
      y: (isHorizontal ? end.y : start.y) + labelDelta.dy,
      style,
      visible: true,
    };
  }

  const defaultStroke = isDark ? DARK_REFLINE_STROKE : LIGHT_REFLINE_STROKE;

  return {
    type: 'refline',
    line: { start, end },
    label,
    stroke: annotation.stroke ?? defaultStroke,
    strokeDasharray,
    strokeWidth: annotation.strokeWidth ?? 1,
    zIndex: annotation.zIndex,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Collision avoidance
// ---------------------------------------------------------------------------

/** Estimate the bounding box of an annotation label. */
function estimateLabelBounds(label: ResolvedLabel): Rect {
  const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = label.style.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  return computeTextBounds(label.x, label.y, label.text, fontSize, fontWeight);
}

/** Check if two rects overlap. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Padding between annotation and obstacle when nudging. */
const NUDGE_PADDING = 6;

/**
 * Try to reposition a text annotation to avoid overlapping with obstacle rects
 * (legend bounds, etc.). First tries standard anchor alternatives, then
 * calculates specific offsets needed to clear obstacles. Returns true if moved.
 */
function nudgeAnnotationFromObstacles(
  annotation: ResolvedAnnotation,
  originalAnnotation: TextAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  obstacles: Rect[],
): boolean {
  if (annotation.type !== 'text' || !annotation.label) return false;

  const labelBounds = estimateLabelBounds(annotation.label);
  const collidingObs = obstacles.filter(
    (obs) => obs.width > 0 && obs.height > 0 && rectsOverlap(labelBounds, obs),
  );

  if (collidingObs.length === 0) return false;

  // Resolve the data point pixel position for offset calculations
  const px = resolvePosition(originalAnnotation.x, scales.x);
  const py = resolvePosition(originalAnnotation.y, scales.y);
  if (px === null || py === null) return false;

  // Generate candidate positions: calculated offsets to clear each obstacle
  const candidates: { dx: number; dy: number; distance: number }[] = [];
  const fontSize = labelBounds.height / Math.max(1, annotation.label.text.split('\n').length);

  for (const obs of collidingObs) {
    // Below obstacle: shift label so its top edge clears the obstacle bottom
    const currentLabelTop = labelBounds.y;
    const targetLabelTop = obs.y + obs.height + NUDGE_PADDING;
    const belowDy = targetLabelTop - currentLabelTop;
    candidates.push({ dx: 0, dy: belowDy, distance: Math.abs(belowDy) });

    // Above obstacle: shift label so its bottom edge clears the obstacle top
    const currentLabelBottom = labelBounds.y + labelBounds.height;
    const targetLabelBottom = obs.y - NUDGE_PADDING;
    const aboveDy = targetLabelBottom - currentLabelBottom;
    candidates.push({ dx: 0, dy: aboveDy, distance: Math.abs(aboveDy) });

    // Left of obstacle: shift label so its right edge clears the obstacle left
    const currentLabelRight = labelBounds.x + labelBounds.width;
    const targetLabelRight = obs.x - NUDGE_PADDING;
    const leftDx = targetLabelRight - currentLabelRight;
    candidates.push({ dx: leftDx, dy: 0, distance: Math.abs(leftDx) });

    // Right of obstacle: shift label so its left edge clears the obstacle right
    const currentLabelLeft = labelBounds.x;
    const targetLabelLeft = obs.x + obs.width + NUDGE_PADDING;
    const rightDx = targetLabelLeft - currentLabelLeft;
    candidates.push({ dx: rightDx, dy: 0, distance: Math.abs(rightDx) });
  }

  // Sort candidates by distance (prefer smallest movement)
  candidates.sort((a, b) => a.distance - b.distance);

  for (const { dx, dy } of candidates) {
    const newLabelX = annotation.label.x + dx;
    const newLabelY = annotation.label.y + dy;

    // Recompute connector origin for the new label position so the connector
    // exits from the edge closest to the data point after nudging.
    let newConnector = annotation.label.connector;
    if (newConnector) {
      const annFontSize = annotation.label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
      const annFontWeight = annotation.label.style.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
      const connStyle = newConnector.style === 'curve' ? ('curve' as const) : ('straight' as const);
      const newFrom = computeConnectorOrigin(
        newLabelX,
        newLabelY,
        annotation.label.text,
        annFontSize,
        annFontWeight,
        px,
        py,
        connStyle,
      );
      newConnector = { ...newConnector, from: newFrom };
    }

    const candidateLabel: ResolvedLabel = {
      ...annotation.label,
      x: newLabelX,
      y: newLabelY,
      connector: newConnector,
    };

    const candidateBounds = estimateLabelBounds(candidateLabel);

    // Check no collisions with any obstacle
    const stillCollides = obstacles.some(
      (obs) => obs.width > 0 && obs.height > 0 && rectsOverlap(candidateBounds, obs),
    );
    if (stillCollides) continue;

    // Annotations render outside the clip path, so they can extend into margins.
    // Only check that the label center is reasonably within the chart and that
    // the text doesn't go completely off-screen.
    const labelCenterX = candidateBounds.x + candidateBounds.width / 2;
    const labelCenterY = candidateBounds.y + candidateBounds.height / 2;
    const inBounds =
      labelCenterX >= chartArea.x &&
      labelCenterX <= chartArea.x + chartArea.width + 100 &&
      labelCenterY >= chartArea.y - fontSize &&
      labelCenterY <= chartArea.y + chartArea.height + fontSize;

    if (inBounds) {
      // When nudged vertically (directly above/below the data), use a caret
      // instead of a connector line for a cleaner editorial look.
      if (candidateLabel.connector && dx === 0 && dy !== 0) {
        candidateLabel.connector = {
          ...candidateLabel.connector,
          style: 'caret',
        };
      }
      annotation.label = candidateLabel;
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute resolved annotations from spec annotations using the resolved scales.
 *
 * Converts data-coordinate annotations to pixel-positioned ResolvedAnnotation
 * objects. Supports offset, anchor, connector, and zIndex. At compact
 * breakpoints, annotations are hidden (strategy says "tooltip-only").
 *
 * When obstacle rects are provided (e.g. legend bounds), text annotations
 * that overlap with them are automatically repositioned using alternate
 * anchor directions.
 */
export function computeAnnotations(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  isDark = false,
  obstacles: Rect[] = [],
): ResolvedAnnotation[] {
  // At compact breakpoints, skip all annotations
  if (strategy.annotationPosition === 'tooltip-only') {
    return [];
  }

  const annotations: ResolvedAnnotation[] = [];

  for (const annotation of spec.annotations) {
    let resolved: ResolvedAnnotation | null = null;

    switch (annotation.type) {
      case 'text':
        resolved = resolveTextAnnotation(annotation, scales, chartArea, isDark);
        break;
      case 'range':
        resolved = resolveRangeAnnotation(annotation, scales, chartArea, isDark);
        break;
      case 'refline':
        resolved = resolveRefLineAnnotation(annotation, scales, chartArea, isDark);
        break;
    }

    if (resolved) {
      // For text annotations, check for collisions with obstacles and nudge if needed
      if (annotation.type === 'text' && obstacles.length > 0) {
        nudgeAnnotationFromObstacles(resolved, annotation, scales, chartArea, obstacles);
      }
      annotations.push(resolved);
    }
  }

  // Sort by zIndex (lower first, undefined treated as 0)
  annotations.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return annotations;
}
