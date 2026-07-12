/**
 * Text annotation resolver: positions a label at data coordinates with an
 * optional callout connector to the data point.
 */

import type {
  ConnectorConfig,
  ConnectorType,
  Rect,
  ResolvedAnnotation,
  ResolvedLabel,
  TextAnnotation,
  TextStyle,
} from '@opendata-ai/openchart-core';
import type { ResolvedScales } from '../layout/scales';
import {
  DARK_CONNECTOR_STROKE,
  DARK_DOT_FILL,
  DARK_LABEL_BACKGROUND,
  DARK_MUTED_TEXT_FILL,
  DARK_TEXT_FILL,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_DOT_RADIUS,
  DEFAULT_DOT_STROKE_WIDTH,
  DEFAULT_LINE_HEIGHT,
  FALLBACK_FONT_FAMILY,
  LEDE_FONT_WEIGHT,
  LIGHT_CONNECTOR_STROKE,
  LIGHT_DOT_FILL,
  LIGHT_LABEL_BACKGROUND,
  LIGHT_MUTED_TEXT_FILL,
  LIGHT_TEXT_FILL,
  MIN_CONNECTOR_LENGTH,
  SUBTITLE_FONT_SIZE_RATIO,
  SUBTITLE_FONT_WEIGHT,
  SUBTITLE_GAP,
} from './constants';
import {
  type AnnotationMeasureTextFn,
  applyOffset,
  computeAnchorOffset,
  computeTextBlockBounds,
  connectorExit,
  connectorPullbackGap,
  heuristicMeasure,
  measureRichLine,
  unionRects,
} from './geometry';
import { resolvePosition } from './position';

/** The resolved endpoint marker on a text annotation. */
type ResolvedDot = NonNullable<ResolvedAnnotation['dot']>;

/**
 * Two connector voices. An arrowed callout is the emphasis gesture, so it takes
 * the label's text ink and reads as one stroke with the words. Everything else
 * (plain leaders, drop-lines) is quiet infrastructure: a gray hairline.
 *
 * The marker inherits the same color, so leader and dot read as one system.
 */
function defaultConnectorStroke(hasArrow: boolean, isDark: boolean, textInk: string): string {
  if (hasArrow) return textInk;
  return isDark ? DARK_CONNECTOR_STROKE : LIGHT_CONNECTOR_STROKE;
}

/**
 * Resolve the endpoint marker at the data point.
 *
 * A default marker (equivalent to `dot: true`) appears whenever a connector is
 * enabled with no arrowhead: the leader stops short and the marker terminates
 * it. An arrowhead is already a terminator, so it gets no marker unless the
 * author asks for one. `dot: false` always means bare.
 */
function resolveDot(
  dotSpec: TextAnnotation['dot'],
  hasConnector: boolean,
  hasArrow: boolean,
  x: number,
  y: number,
  isDark: boolean,
  connectorStroke: string,
): ResolvedDot | undefined {
  const useDefault = dotSpec === undefined && hasConnector && !hasArrow;
  if (!dotSpec && !useDefault) return undefined;

  const dotConfig = typeof dotSpec === 'object' ? dotSpec : {};
  return {
    x,
    y,
    radius: dotConfig.radius ?? DEFAULT_DOT_RADIUS,
    fill: dotConfig.fill ?? (isDark ? DARK_DOT_FILL : LIGHT_DOT_FILL),
    stroke: dotConfig.stroke ?? connectorStroke,
    strokeWidth: dotConfig.strokeWidth ?? DEFAULT_DOT_STROKE_WIDTH,
  };
}

/** Radius the connector must clear at the data point, marker stroke included. */
export function markerClearance(dot: ResolvedDot | undefined): number {
  return dot ? dot.radius + dot.strokeWidth / 2 : 0;
}

/**
 * Resolve the connector spec shorthand into a normalized { type, arrow } object.
 * Returns null when the connector is disabled.
 */
function resolveConnectorConfig(
  connector: TextAnnotation['connector'],
): { type: ConnectorType; arrow: boolean } | null {
  if (connector === false) return null;

  if (typeof connector === 'object' && connector !== null && 'type' in connector) {
    const cfg = connector as ConnectorConfig;
    const arrow = cfg.type === 'drop-line' ? false : (cfg.arrow ?? cfg.type === 'curve');
    return { type: cfg.type, arrow };
  }

  if (connector === 'curve') return { type: 'curve', arrow: true };
  if (connector === 'drop-line') return { type: 'drop-line', arrow: false };

  // true, 'straight', or undefined all map to straight with no arrow
  return { type: 'straight', arrow: false };
}

/**
 * Resolve `background` to a concrete color. `true` picks the theme surface so
 * the plate follows light/dark; a string passes through as an explicit override.
 */
function resolveLabelBackground(
  background: string | true | undefined,
  isDark: boolean,
): string | undefined {
  if (background === undefined) return undefined;
  if (background === true) return isDark ? DARK_LABEL_BACKGROUND : LIGHT_LABEL_BACKGROUND;
  return background;
}

/** Horizontal gap between the drop-line and the label text. */
const DROP_LINE_LABEL_GAP = 8;
/** Vertical gap between the top of the drop-line and the top of the label box. */
const DROP_LINE_TOP_GAP = 4;

export function makeAnnotationLabelStyle(
  fontSize?: number,
  fontWeight?: number,
  fill?: string,
  isDark?: boolean,
  fontFamily?: string,
): TextStyle {
  const defaultFill = isDark ? DARK_TEXT_FILL : LIGHT_TEXT_FILL;
  return {
    fontFamily: fontFamily ?? FALLBACK_FONT_FAMILY,
    fontSize: fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE,
    fontWeight: fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT,
    fill: fill ?? defaultFill,
    lineHeight: DEFAULT_LINE_HEIGHT,
    textAnchor: 'start',
  };
}

/**
 * The primary text's resolved weight. A subtitle turns the primary line into a
 * lede, so it goes bold unless the author asked for a specific weight.
 */
export function resolveLedeFontWeight(annotation: TextAnnotation): number | undefined {
  if (annotation.fontWeight !== undefined) return annotation.fontWeight;
  return annotation.subtitle ? LEDE_FONT_WEIGHT : undefined;
}

export function resolveTextAnnotation(
  annotation: TextAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  isDark: boolean,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
  fontFamily?: string,
): ResolvedAnnotation | null {
  const px = resolvePosition(annotation.x, scales.x);
  const py = resolvePosition(annotation.y, scales.y);

  if (px === null || py === null) return null;

  const defaultTextFill = isDark ? DARK_TEXT_FILL : LIGHT_TEXT_FILL;
  const labelBackground = resolveLabelBackground(annotation.background, isDark);

  const labelStyle = makeAnnotationLabelStyle(
    annotation.fontSize,
    resolveLedeFontWeight(annotation),
    annotation.fill ?? defaultTextFill,
    isDark,
    fontFamily,
  );

  // Parse connector spec into { type, arrow } or null (disabled).
  const connectorConfig = resolveConnectorConfig(annotation.connector);

  // Drop-line connector: vertical line through the data point's x with the
  // label sitting flush beside it. Auto-flips to the opposite side if the
  // chosen side would overflow the chart area.
  if (connectorConfig?.type === 'drop-line') {
    return resolveDropLineAnnotation(
      annotation,
      px,
      py,
      chartArea,
      labelStyle,
      labelBackground,
      isDark,
      measure,
    );
  }

  // Text blocks are never center-aligned: the reference annotations align on the
  // edge that faces the data point, so the block reads as a flag on the leader.
  // A left anchor puts the block to the left of the point, so its right edge
  // faces it (`end`); everything else faces left (`start`).
  labelStyle.textAnchor = annotation.anchor === 'left' ? 'end' : 'start';

  // Compute position from anchor direction + user offset
  const anchorDelta = computeAnchorOffset(annotation.anchor, px, py, chartArea);
  const finalDelta = applyOffset(anchorDelta, annotation.offset);

  const labelX = px + finalDelta.dx;
  const labelY = py + finalDelta.dy;

  const showConnector = connectorConfig !== null;
  const connectorStyle: 'straight' | 'curve' =
    connectorConfig?.type === 'curve' ? 'curve' : 'straight';
  const connectorArrow = connectorConfig?.arrow ?? false;

  const fontSize = annotation.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;

  const labelBounds = computeTextBlockBounds(labelX, labelY, annotation.text, labelStyle, measure);

  // Resolve subtitle first: its bounds are part of the block the connector must
  // clear, and the subtitle is often the wider of the two lines.
  let subtitle: ResolvedAnnotation['subtitle'] | undefined;
  let annotationBounds: Rect = labelBounds;
  if (annotation.subtitle) {
    const primaryLineCount = annotation.text.split('\n').length;
    const subtitleFontSize = Math.round(fontSize * SUBTITLE_FONT_SIZE_RATIO);
    const mutedFill = isDark ? DARK_MUTED_TEXT_FILL : LIGHT_MUTED_TEXT_FILL;
    const subtitleStyle: TextStyle = {
      ...labelStyle,
      fontSize: subtitleFontSize,
      fontWeight: SUBTITLE_FONT_WEIGHT,
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

  // The endpoint marker sits on the data point itself (plus any user offset on
  // the connector's data-side end), never on the pulled-back connector tip.
  const endpoint = {
    x: px + (annotation.connectorOffset?.to?.dx ?? 0),
    y: py + (annotation.connectorOffset?.to?.dy ?? 0),
  };
  // Emphasis (arrowed) connectors take the label ink; quiet leaders take gray.
  // The marker shares the color so it reads as part of the same gesture.
  const connectorStroke =
    annotation.stroke ??
    defaultConnectorStroke(connectorArrow, isDark, labelStyle.fill ?? defaultTextFill);
  const dot = resolveDot(
    annotation.dot,
    showConnector,
    connectorArrow,
    endpoint.x,
    endpoint.y,
    isDark,
    connectorStroke,
  );

  // Connector origin: ray from the block center (label ∪ subtitle) to the data
  // point, exiting the box with a standoff gap.
  let connector: ResolvedLabel['connector'];
  if (showConnector) {
    const exit = connectorExit(annotationBounds, endpoint.x, endpoint.y);
    if (exit) {
      const from = {
        x: exit.x + (annotation.connectorOffset?.from?.dx ?? 0),
        y: exit.y + (annotation.connectorOffset?.from?.dy ?? 0),
      };

      // Pull the data-point end back so the line stops short of the marker.
      const gap = connectorPullbackGap(markerClearance(dot), connectorArrow);
      const cdx = endpoint.x - from.x;
      const cdy = endpoint.y - from.y;
      const dist = Math.sqrt(cdx * cdx + cdy * cdy);
      const to =
        dist > 0
          ? { x: endpoint.x - (cdx / dist) * gap, y: endpoint.y - (cdy / dist) * gap }
          : { ...endpoint };

      // Min-length check runs after the pullback: it can flip a near-degenerate
      // line's direction, and a stub shorter than MIN_CONNECTOR_LENGTH reads as
      // noise — the marker alone says it better.
      const lx = to.x - from.x;
      const ly = to.y - from.y;
      if (Math.sqrt(lx * lx + ly * ly) >= MIN_CONNECTOR_LENGTH) {
        connector = {
          from,
          to,
          endpoint,
          stroke: connectorStroke,
          style: connectorStyle,
          arrow: connectorArrow,
          exit: exit.exit,
        };
      }
    }
  }

  const label: ResolvedLabel = {
    text: annotation.text,
    x: labelX,
    y: labelY,
    style: labelStyle,
    visible: true,
    connector,
    background: labelBackground,
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
  labelBackground: string | undefined,
  isDark: boolean,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): ResolvedAnnotation {
  const fontSize = annotation.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = Number(labelStyle.fontWeight) || DEFAULT_ANNOTATION_FONT_WEIGHT;
  const lines = annotation.text.split('\n');
  const estimatedWidth = Math.max(
    0,
    ...lines.map((line) =>
      measureRichLine(line, { fontSize, fontWeight, fontFamily: labelStyle.fontFamily }, measure),
    ),
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

  // The drop-line is a connector with no arrow, so it gets the default endpoint
  // marker too — and the line stops short of it by the same rule as the other
  // connector styles. Quiet voice: gray hairline, marker in the same gray.
  const connectorStroke =
    annotation.stroke ?? (isDark ? DARK_CONNECTOR_STROKE : LIGHT_CONNECTOR_STROKE);
  const dot = resolveDot(annotation.dot, true, false, px, py, isDark, connectorStroke);
  const bottomGap = connectorPullbackGap(markerClearance(dot), false);

  const from = { x: px, y: labelTopY - DROP_LINE_TOP_GAP };
  const to = { x: px, y: py - bottomGap };

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
      stroke: connectorStroke,
      style: 'drop-line',
      arrow: false,
      exit: 'vertical',
    },
    background: labelBackground,
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
    dot,
    bounds: labelBounds,
  };
}
