/**
 * Text annotation resolver: positions a label at data coordinates with an
 * optional callout connector to the data point.
 */

import type {
  Rect,
  ResolvedAnnotation,
  ResolvedLabel,
  TextAnnotation,
  TextStyle,
} from '@opendata-ai/openchart-core';
import type { ResolvedScales } from '../layout/scales';
import {
  DARK_DOT_FILL,
  DARK_MUTED_TEXT_FILL,
  DARK_TEXT_FILL,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_DOT_RADIUS,
  DEFAULT_DOT_STROKE_WIDTH,
  DEFAULT_LINE_HEIGHT,
  LIGHT_DOT_FILL,
  LIGHT_MUTED_TEXT_FILL,
  LIGHT_TEXT_FILL,
  SUBTITLE_FONT_SIZE_RATIO,
  SUBTITLE_GAP,
} from './constants';
import {
  type AnnotationMeasureTextFn,
  applyOffset,
  computeAnchorOffset,
  computeConnectorOrigin,
  computeTextBlockBounds,
  heuristicMeasure,
  unionRects,
} from './geometry';
import { resolvePosition } from './position';

/** Horizontal gap between the drop-line and the label text. */
const DROP_LINE_LABEL_GAP = 8;
/** Vertical gap between the top of the drop-line and the top of the label box. */
const DROP_LINE_TOP_GAP = 4;
/** Vertical gap between the bottom of the drop-line and the data point. */
const DROP_LINE_BOTTOM_GAP = 4;

export function makeAnnotationLabelStyle(
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

export function resolveTextAnnotation(
  annotation: TextAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
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

  // Drop-line connector: vertical line through the data point's x with the
  // label sitting flush beside it. Auto-flips to the opposite side if the
  // chosen side would overflow the chart area.
  if (annotation.connector === 'drop-line') {
    return resolveDropLineAnnotation(
      annotation,
      px,
      py,
      chartArea,
      labelStyle,
      defaultTextFill,
      measure,
    );
  }

  // Multi-line non-drop-line: engine sets textAnchor to 'middle' so bounds
  // and rendering derive from the same anchor (previously the renderer
  // forced this override, causing bounds to lie).
  const isMultiLine = annotation.text.includes('\n');
  if (isMultiLine) {
    labelStyle.textAnchor = 'middle';
  }

  // Compute position from anchor direction + user offset
  const anchorDelta = computeAnchorOffset(annotation.anchor, px, py, chartArea);
  const finalDelta = applyOffset(anchorDelta, annotation.offset);

  const labelX = px + finalDelta.dx;
  const labelY = py + finalDelta.dy;

  // Connector: draw unless explicitly disabled
  const showConnector = annotation.connector !== false;
  const connectorStyle: 'straight' | 'curve' =
    annotation.connector === 'curve' ? 'curve' : 'straight';

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

  const labelBounds = computeTextBlockBounds(labelX, labelY, annotation.text, labelStyle, measure);

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
          endpoint: { x: px, y: py },
          stroke: annotation.stroke ?? '#999999',
          style: connectorStyle,
        }
      : undefined,
    background: annotation.background,
    halo: annotation.halo,
    bounds: labelBounds,
  };

  // Resolve dot marker. Uses the connector's "to" endpoint coordinates
  // (post user-supplied connectorOffset.to) so it sits exactly where the
  // connector terminates at the data point.
  let dot: ResolvedAnnotation['dot'] | undefined;
  if (annotation.dot) {
    const dotConfig = typeof annotation.dot === 'object' ? annotation.dot : {};
    const defaultDotFill = isDark ? DARK_DOT_FILL : LIGHT_DOT_FILL;
    const defaultDotStroke = isDark ? DARK_TEXT_FILL : LIGHT_TEXT_FILL;
    dot = {
      x: adjustedTo.x,
      y: adjustedTo.y,
      radius: dotConfig.radius ?? DEFAULT_DOT_RADIUS,
      fill: dotConfig.fill ?? defaultDotFill,
      stroke: dotConfig.stroke ?? defaultDotStroke,
      strokeWidth: dotConfig.strokeWidth ?? DEFAULT_DOT_STROKE_WIDTH,
    };
  }

  // Resolve subtitle. Positioned below the primary text block by
  // (lineHeight * primaryLineCount * fontSize) + gap.
  let subtitle: ResolvedAnnotation['subtitle'] | undefined;
  let annotationBounds: Rect = labelBounds;
  if (annotation.subtitle) {
    const primaryLineCount = annotation.text.split('\n').length;
    const subtitleFontSize = Math.round(fontSize * SUBTITLE_FONT_SIZE_RATIO);
    const mutedFill = isDark ? DARK_MUTED_TEXT_FILL : LIGHT_MUTED_TEXT_FILL;
    const subtitleStyle: TextStyle = {
      ...labelStyle,
      fontSize: subtitleFontSize,
      fontWeight: DEFAULT_ANNOTATION_FONT_WEIGHT,
      fill: mutedFill,
    };
    const subtitleY = labelY + fontSize * DEFAULT_LINE_HEIGHT * primaryLineCount + SUBTITLE_GAP;
    subtitle = {
      text: annotation.subtitle,
      x: labelX,
      y: subtitleY,
      style: subtitleStyle,
    };
    const subtitleBounds = computeTextBlockBounds(
      labelX,
      subtitleY,
      annotation.subtitle,
      subtitleStyle,
      measure,
    );
    annotationBounds = unionRects(labelBounds, subtitleBounds);
  }

  return {
    type: 'text',
    id: annotation.id,
    label,
    stroke: annotation.stroke,
    fill: annotation.fill,
    opacity: annotation.opacity,
    zIndex: annotation.zIndex,
    dot,
    subtitle,
    bounds: annotationBounds,
  };
}

/**
 * Resolve a drop-line text annotation. The connector is a vertical line through
 * the data point's x. The label sits beside the line, anchored toward the chosen
 * side (left or right), and auto-flips if the chosen side would overflow.
 */
function resolveDropLineAnnotation(
  annotation: TextAnnotation,
  px: number,
  py: number,
  chartArea: Rect,
  labelStyle: TextStyle,
  defaultTextFill: string,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): ResolvedAnnotation {
  const fontSize = annotation.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = annotation.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  const lines = annotation.text.split('\n');
  const estimatedWidth = Math.max(
    0,
    ...lines.map((line) => measure(line, { fontSize, fontWeight })),
  );

  // Pick initial side from anchor; default to 'left' (label sits to the left
  // of the drop-line) when not specified.
  let side: 'left' | 'right' = annotation.anchor === 'right' ? 'right' : 'left';

  // Auto-flip: if the chosen side would push the label past the chart-area edge,
  // flip to the other side. Compare the estimated label width against the
  // available space on each side. When neither side fits cleanly, fall back to
  // whichever side has more room — graceful degradation beats silent overflow.
  const spaceLeft = px - chartArea.x - DROP_LINE_LABEL_GAP;
  const spaceRight = chartArea.x + chartArea.width - px - DROP_LINE_LABEL_GAP;
  const fitsLeft = estimatedWidth <= spaceLeft;
  const fitsRight = estimatedWidth <= spaceRight;
  if (side === 'left' && !fitsLeft) {
    side = fitsRight || spaceRight > spaceLeft ? 'right' : 'left';
  } else if (side === 'right' && !fitsRight) {
    side = fitsLeft || spaceLeft > spaceRight ? 'left' : 'right';
  }

  const labelX = side === 'left' ? px - DROP_LINE_LABEL_GAP : px + DROP_LINE_LABEL_GAP;
  const textAnchor: 'start' | 'end' = side === 'left' ? 'end' : 'start';

  // Drop the label box top a bit above the data point so the label and line
  // share a baseline that reads as "callout above the point".
  const lineHeight = fontSize * DEFAULT_LINE_HEIGHT;
  const totalHeight = lineHeight * lines.length;
  // Position the first line so the bottom of the label sits ~12px above py.
  // Clamp to the chart-area top so multi-line labels near peaks don't escape
  // upward into chrome / metric-bar territory.
  const desiredLabelTopY = py - totalHeight - 12;
  const minLabelTopY = chartArea.y + 4;
  const labelTopY = Math.max(desiredLabelTopY, minLabelTopY);
  const labelBaselineY = labelTopY + fontSize;

  const resolvedStyle: TextStyle = { ...labelStyle, textAnchor };

  const from = { x: px, y: labelTopY - DROP_LINE_TOP_GAP };
  const to = { x: px, y: py - DROP_LINE_BOTTOM_GAP };

  const labelBounds = computeTextBlockBounds(
    labelX,
    labelBaselineY,
    annotation.text,
    resolvedStyle,
    measure,
  );

  const label: ResolvedLabel = {
    text: annotation.text,
    x: labelX,
    y: labelBaselineY,
    style: resolvedStyle,
    visible: true,
    connector: {
      from,
      to,
      endpoint: { x: px, y: py },
      stroke: annotation.stroke ?? defaultTextFill,
      style: 'drop-line',
    },
    background: annotation.background,
    halo: annotation.halo,
    bounds: labelBounds,
  };

  return {
    type: 'text',
    id: annotation.id,
    label,
    stroke: annotation.stroke,
    fill: annotation.fill,
    opacity: annotation.opacity,
    zIndex: annotation.zIndex,
    bounds: labelBounds,
  };
}
