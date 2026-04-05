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
  DARK_TEXT_FILL,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_LINE_HEIGHT,
  LIGHT_TEXT_FILL,
} from './constants';
import { applyOffset, computeAnchorOffset, computeConnectorOrigin } from './geometry';
import { resolvePosition } from './position';

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
    id: annotation.id,
    label,
    stroke: annotation.stroke,
    fill: annotation.fill,
    opacity: annotation.opacity,
    zIndex: annotation.zIndex,
  };
}
