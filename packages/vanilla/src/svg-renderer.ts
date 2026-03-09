/**
 * SVG renderer: converts a ChartLayout into SVG DOM elements.
 *
 * Creates an <svg> element with viewBox matching layout dimensions,
 * renders chrome (title/subtitle/source), axes, marks, annotations,
 * and legend. All styling via inline SVG attributes from layout data.
 *
 * Mark rendering dispatches per mark type with dedicated renderers
 * for line, area, rect, arc, and point marks.
 */

import type {
  ArcMark,
  AreaMark,
  AxisLayout,
  ChartLayout,
  LegendLayout,
  LineMark,
  Mark,
  Point,
  PointMark,
  RectMark,
  ResolvedAnnotation,
  ResolvedChromeElement,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Compute the vertical extent of x-axis labels below the chart area.
 * Accounts for rotated tick labels which need more vertical space.
 */
function computeXAxisExtent(layout: ChartLayout): number {
  const xAxis = layout.axes.x;
  if (!xAxis) return 0;

  if (xAxis.tickAngle && Math.abs(xAxis.tickAngle) > 10) {
    // Rotated labels: estimate height from the longest tick label.
    const fontSize = xAxis.tickLabelStyle.fontSize;
    const fontWeight = xAxis.tickLabelStyle.fontWeight;
    const angleRad = Math.abs(xAxis.tickAngle) * (Math.PI / 180);
    let maxLabelWidth = 40;
    for (const tick of xAxis.ticks) {
      const w = estimateTextWidth(tick.label, fontSize, fontWeight);
      if (w > maxLabelWidth) maxLabelWidth = w;
    }
    const rotatedHeight = Math.min(maxLabelWidth * Math.sin(angleRad) + 6, 120);
    return xAxis.label ? rotatedHeight + 20 : rotatedHeight;
  }

  return xAxis.label ? 48 : 26;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSVGElement(tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag);
}

function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

function applyTextStyle(el: SVGElement, style: TextStyle): void {
  setAttrs(el, {
    'font-family': style.fontFamily,
    'font-size': style.fontSize,
    'font-weight': style.fontWeight,
  });
  // Use inline style for fill so it takes priority over CSS class defaults
  // (e.g. .viz-title { fill: var(--viz-text) } which would override attributes)
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', style.fill);
  if (style.textAnchor) {
    el.setAttribute('text-anchor', style.textAnchor);
  }
  if (style.dominantBaseline) {
    el.setAttribute('dominant-baseline', style.dominantBaseline);
  }
  if (style.fontVariant) {
    el.setAttribute('font-variant', style.fontVariant);
  }
}

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

/**
 * Break text into lines that fit within maxWidth using word wrapping.
 * Uses a character-width heuristic (same as text-measure.ts).
 */
function wrapText(text: string, fontSize: number, fontWeight: number, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];

  // Heuristic character width matching text-measure.ts
  const AVG_CHAR_WIDTH = 0.55;
  const WEIGHT_FACTORS: Record<number, number> = {
    100: 0.9,
    200: 0.92,
    300: 0.95,
    400: 1.0,
    500: 1.02,
    600: 1.05,
    700: 1.08,
    800: 1.1,
    900: 1.12,
  };
  const weightFactor = WEIGHT_FACTORS[fontWeight] ?? 1.0;
  const charWidth = fontSize * AVG_CHAR_WIDTH * weightFactor;
  const maxChars = Math.floor(maxWidth / charWidth);

  if (text.length <= maxChars) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

function renderChromeElement(
  parent: SVGElement,
  element: ResolvedChromeElement,
  className: string,
  chromeKey: string,
): void {
  const text = createSVGElement('text');
  setAttrs(text, { x: element.x, y: element.y });
  applyTextStyle(text, element.style);
  text.setAttribute('class', className);
  text.setAttribute('data-chrome-key', chromeKey);

  const lines = wrapText(
    element.text,
    element.style.fontSize,
    element.style.fontWeight,
    element.maxWidth,
  );

  if (lines.length === 1) {
    text.textContent = element.text;
  } else {
    const lineHeight = element.style.fontSize * (element.style.lineHeight ?? 1.3);
    for (let i = 0; i < lines.length; i++) {
      const tspan = createSVGElement('tspan');
      setAttrs(tspan, { x: element.x, dy: i === 0 ? 0 : lineHeight });
      tspan.textContent = lines[i];
      text.appendChild(tspan);
    }
  }

  parent.appendChild(text);
}

function renderChrome(parent: SVGElement, layout: ChartLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'viz-chrome');

  const { chrome } = layout;

  // Top chrome: render at their stored y positions (already absolute)
  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'viz-title', 'title');
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'viz-subtitle', 'subtitle');
  }

  // Bottom chrome starts below x-axis labels/title, not at chart area bottom.
  // Accounts for rotated tick labels which need more vertical space.
  const xAxisExtent = computeXAxisExtent(layout);
  const bottomOffset = layout.area.y + layout.area.height + xAxisExtent;
  if (chrome.source) {
    renderChromeElement(
      g,
      { ...chrome.source, y: bottomOffset + chrome.source.y },
      'viz-source',
      'source',
    );
  }
  if (chrome.byline) {
    renderChromeElement(
      g,
      { ...chrome.byline, y: bottomOffset + chrome.byline.y },
      'viz-byline',
      'byline',
    );
  }
  if (chrome.footer) {
    renderChromeElement(
      g,
      { ...chrome.footer, y: bottomOffset + chrome.footer.y },
      'viz-footer',
      'footer',
    );
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Axis rendering
// ---------------------------------------------------------------------------

function renderAxis(
  parent: SVGElement,
  axis: AxisLayout,
  orientation: 'x' | 'y',
  layout: ChartLayout,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', `viz-axis viz-axis-${orientation}`);

  const { area } = layout;

  // Only draw axis line for x-axis (bottom baseline).
  // Horizontal gridlines already guide y-values, so the vertical y-axis line is redundant.
  if (orientation === 'x') {
    const line = createSVGElement('line');
    line.setAttribute('class', 'viz-axis-line');
    setAttrs(line, {
      x1: axis.start.x,
      y1: axis.start.y,
      x2: axis.end.x,
      y2: axis.end.y,
      stroke: layout.theme.colors.axis,
      'stroke-width': 1,
    });
    g.appendChild(line);
  }

  // Ticks and labels
  // Tick positions are absolute pixel coordinates from D3 scales whose range
  // was set to [chartArea.x, chartArea.x + chartArea.width] (and similarly for y).
  // Don't add area.x/area.y again or you'll double-offset everything.
  for (const tick of axis.ticks) {
    if (orientation === 'x') {
      // Label (no tick marks -- gridlines provide sufficient reference)
      const label = createSVGElement('text');
      label.setAttribute('class', 'viz-axis-tick');

      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        // Rotated labels: anchor at the rotation pivot point
        const labelX = tick.position;
        const labelY = area.y + area.height + 6;
        setAttrs(label, {
          x: labelX,
          y: labelY,
          'text-anchor': axis.tickAngle < 0 ? 'end' : 'start',
          'dominant-baseline': 'central',
          transform: `rotate(${axis.tickAngle}, ${labelX}, ${labelY})`,
        });
      } else {
        setAttrs(label, {
          x: tick.position,
          y: area.y + area.height + 14,
          'text-anchor': 'middle',
        });
      }

      applyTextStyle(label, axis.tickLabelStyle);
      label.textContent = tick.label;
      g.appendChild(label);
    } else {
      // Label (no tick marks -- gridlines provide sufficient reference)
      const label = createSVGElement('text');
      label.setAttribute('class', 'viz-axis-tick');
      setAttrs(label, {
        x: area.x - 6,
        y: tick.position,
        'text-anchor': 'end',
        'dominant-baseline': 'central',
      });
      applyTextStyle(label, axis.tickLabelStyle);
      label.textContent = tick.label;
      g.appendChild(label);
    }
  }

  // Gridlines (positions are also absolute from the scales)
  for (const gridline of axis.gridlines) {
    const gl = createSVGElement('line');
    gl.setAttribute('class', 'viz-gridline');
    if (orientation === 'y') {
      setAttrs(gl, {
        x1: area.x,
        y1: gridline.position,
        x2: area.x + area.width,
        y2: gridline.position,
        stroke: layout.theme.colors.gridline,
        'stroke-width': 1,
        'stroke-opacity': 0.35,
      });
    } else {
      setAttrs(gl, {
        x1: gridline.position,
        y1: area.y,
        x2: gridline.position,
        y2: area.y + area.height,
        stroke: layout.theme.colors.gridline,
        'stroke-width': 1,
        'stroke-opacity': 0.35,
      });
    }
    g.appendChild(gl);
  }

  // Axis label
  if (axis.label && axis.labelStyle) {
    const axisLabel = createSVGElement('text');
    axisLabel.setAttribute('class', 'viz-axis-title');
    applyTextStyle(axisLabel, axis.labelStyle);
    axisLabel.textContent = axis.label;

    if (orientation === 'x') {
      // Position axis title below tick labels. For rotated labels, compute
      // the vertical extent of the rotated ticks and place the title below.
      let titleY = area.y + area.height + 35;
      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        const angleRad = Math.abs(axis.tickAngle) * (Math.PI / 180);
        let maxLabelWidth = 40;
        for (const tick of axis.ticks) {
          const w = estimateTextWidth(
            tick.label,
            axis.tickLabelStyle.fontSize,
            axis.tickLabelStyle.fontWeight,
          );
          if (w > maxLabelWidth) maxLabelWidth = w;
        }
        const rotatedHeight = Math.min(maxLabelWidth * Math.sin(angleRad) + 6, 120);
        titleY = area.y + area.height + rotatedHeight + 14;
      }
      setAttrs(axisLabel, {
        x: area.x + area.width / 2,
        y: titleY,
        'text-anchor': 'middle',
      });
    } else {
      // Rotated y-axis label
      setAttrs(axisLabel, {
        x: area.x - 45,
        y: area.y + area.height / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90, ${area.x - 45}, ${area.y + area.height / 2})`,
      });
    }
    g.appendChild(axisLabel);
  }

  parent.appendChild(g);
}

function renderAxes(parent: SVGElement, layout: ChartLayout): void {
  if (layout.axes.x) {
    renderAxis(parent, layout.axes.x, 'x', layout);
  }
  if (layout.axes.y) {
    renderAxis(parent, layout.axes.y, 'y', layout);
  }
}

// ---------------------------------------------------------------------------
// Mark rendering (dispatch per mark type)
// ---------------------------------------------------------------------------

type MarkRenderer<T extends Mark> = (mark: T, index: number) => SVGElement;

const markRenderers: Record<string, MarkRenderer<Mark>> = {};

/**
 * Register a mark renderer for a specific mark type.
 * Built-in renderers are registered below for all chart types.
 */
export function registerMarkRenderer<T extends Mark>(
  type: T['type'],
  renderer: MarkRenderer<T>,
): void {
  markRenderers[type] = renderer as MarkRenderer<Mark>;
}

function renderLineMark(mark: LineMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `line-${mark.seriesKey ?? index}`);
  g.setAttribute('class', 'viz-mark viz-mark-line');

  if (mark.points.length > 1) {
    const path = createSVGElement('path');
    // Use the pre-computed D3 curve path when available (smooth monotone),
    // otherwise fall back to straight M/L segments.
    const d =
      mark.path ?? mark.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    setAttrs(path, {
      d,
      fill: 'none',
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
    });
    if (mark.strokeDasharray) {
      path.setAttribute('stroke-dasharray', mark.strokeDasharray);
    }
    if (mark.opacity != null) {
      path.setAttribute('opacity', String(mark.opacity));
    }
    g.appendChild(path);
  }

  // Render end-of-line label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'viz-mark-label');
    if (mark.seriesKey) {
      label.setAttribute('data-series', mark.seriesKey);
    }
    setAttrs(label, { x: mark.label.x, y: mark.label.y });
    applyTextStyle(label, mark.label.style);
    label.textContent = mark.label.text;
    g.appendChild(label);

    // Render connector line if label was offset from anchor
    if (mark.label.connector) {
      const connector = createSVGElement('line');
      connector.setAttribute('class', 'viz-mark-connector');
      setAttrs(connector, {
        x1: mark.label.connector.from.x,
        y1: mark.label.connector.from.y,
        x2: mark.label.connector.to.x,
        y2: mark.label.connector.to.y,
        stroke: mark.label.connector.stroke,
        'stroke-width': 1,
        'stroke-opacity': 0.5,
      });
      g.appendChild(connector);
    }
  }

  return g;
}

function renderAreaMark(mark: AreaMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `area-${mark.seriesKey ?? index}`);
  g.setAttribute('class', 'viz-mark viz-mark-area');

  if (mark.path) {
    // Area fill: the full closed shape (top line + baseline), no stroke
    const fill = createSVGElement('path');
    setAttrs(fill, {
      d: mark.path,
      fill: mark.fill,
      'fill-opacity': mark.fillOpacity,
      stroke: 'none',
    });
    g.appendChild(fill);

    // Top-line stroke: only along the data points, not the baseline
    if (mark.stroke && mark.topPath) {
      const strokePath = createSVGElement('path');
      setAttrs(strokePath, {
        d: mark.topPath,
        fill: 'none',
        stroke: mark.stroke,
        'stroke-width': mark.strokeWidth ?? 1,
      });
      g.appendChild(strokePath);
    }
  }

  return g;
}

function renderRectMark(mark: RectMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `rect-${index}`);
  g.setAttribute('class', 'viz-mark viz-mark-rect');

  const rect = createSVGElement('rect');
  setAttrs(rect, {
    x: mark.x,
    y: mark.y,
    width: mark.width,
    height: mark.height,
    fill: mark.fill,
  });
  if (mark.stroke) {
    rect.setAttribute('stroke', mark.stroke);
  }
  if (mark.strokeWidth) {
    rect.setAttribute('stroke-width', String(mark.strokeWidth));
  }
  if (mark.cornerRadius) {
    setAttrs(rect, { rx: mark.cornerRadius, ry: mark.cornerRadius });
  }
  g.appendChild(rect);

  // Render value label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'viz-mark-label');
    setAttrs(label, { x: mark.label.x, y: mark.label.y });
    applyTextStyle(label, mark.label.style);
    label.textContent = mark.label.text;
    g.appendChild(label);
  }

  return g;
}

function renderArcMark(mark: ArcMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `arc-${index}`);
  g.setAttribute('class', 'viz-mark viz-mark-arc');
  g.setAttribute('transform', `translate(${mark.center.x},${mark.center.y})`);

  const path = createSVGElement('path');
  setAttrs(path, {
    d: mark.path,
    fill: mark.fill,
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  g.appendChild(path);

  // Render label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'viz-mark-label');
    // Label position is in absolute coords, but we're in a translated group,
    // so subtract the center offset
    setAttrs(label, {
      x: mark.label.x - mark.center.x,
      y: mark.label.y - mark.center.y,
    });
    applyTextStyle(label, mark.label.style);
    label.textContent = mark.label.text;
    g.appendChild(label);
  }

  return g;
}

function renderPointMark(mark: PointMark, index: number): SVGElement {
  const circle = createSVGElement('circle');
  circle.setAttribute('data-mark-id', `point-${index}`);
  circle.setAttribute('class', 'viz-mark viz-mark-point');
  setAttrs(circle, {
    cx: mark.cx,
    cy: mark.cy,
    r: mark.r,
    fill: mark.fill,
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  if (mark.fillOpacity !== undefined) {
    circle.setAttribute('fill-opacity', String(mark.fillOpacity));
  }
  return circle;
}

// Register built-in renderers
registerMarkRenderer('line', renderLineMark as MarkRenderer<Mark>);
registerMarkRenderer('area', renderAreaMark as MarkRenderer<Mark>);
registerMarkRenderer('rect', renderRectMark as MarkRenderer<Mark>);
registerMarkRenderer('arc', renderArcMark as MarkRenderer<Mark>);
registerMarkRenderer('point', renderPointMark as MarkRenderer<Mark>);

/** Extract series name from a mark for legend toggle matching. */
function getMarkSeries(mark: Mark): string | undefined {
  // Line and area marks have an explicit seriesKey
  if (mark.type === 'line' || mark.type === 'area') {
    return mark.seriesKey;
  }
  // For arc marks, the category name is the first part of the aria label (before ':')
  if (mark.type === 'arc') {
    return mark.aria.label.split(':')[0]?.trim();
  }
  // For rect/point, the aria label may be "category: value" or "category, group: value".
  // The series name is the category part (before the colon).
  if (mark.aria?.label) {
    const beforeColon = mark.aria.label.split(':')[0]?.trim();
    if (beforeColon) return beforeColon;
  }
  return undefined;
}

function renderMarks(parent: SVGElement, layout: ChartLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'viz-marks');

  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    const renderer = markRenderers[mark.type];
    if (renderer) {
      const el = renderer(mark, i);
      // Add ARIA label if present
      if (mark.aria?.label) {
        el.setAttribute('aria-label', mark.aria.label);
      }
      // Add data-series attribute for legend toggle matching
      const series = getMarkSeries(mark);
      if (series) {
        el.setAttribute('data-series', series);
      }
      g.appendChild(el);
    }
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Annotation rendering
// ---------------------------------------------------------------------------

function renderAnnotations(parent: SVGElement, layout: ChartLayout): void {
  if (layout.annotations.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'viz-annotations');

  // Annotations are already sorted by zIndex from the engine, so render in order
  for (let i = 0; i < layout.annotations.length; i++) {
    renderAnnotation(g, layout.annotations[i], i);
  }

  parent.appendChild(g);
}

/**
 * Render a curved arrow connector from a label to a data point.
 * Uses a cubic bezier that sweeps outward then curves toward the
 * target, with a triangular arrowhead at the tip.
 */
function renderCurvedArrow(parent: SVGElement, from: Point, to: Point, stroke: string): void {
  // Pad above the target so the arrow doesn't sit right on the element.
  const pad = 6;
  const tipY = to.y - pad;

  const dy = tipY - from.y;
  const dist = Math.sqrt((to.x - from.x) ** 2 + dy ** 2) || 1;

  // Arrowhead geometry
  const arrowLen = 8;
  const arrowWidth = 4;

  // cp2 directly above target so arrow arrives pointing straight down.
  const bulge = Math.max(dist * 0.4, 35);
  const cp1x = from.x + bulge;
  const cp1y = from.y + dy * 0.35;
  const cp2x = to.x;
  const cp2y = tipY - Math.abs(dy) * 0.25;

  // Tangent at the tip (from cp2 → tip), used for arrowhead direction.
  const tx = to.x - cp2x;
  const ty = tipY - cp2y;
  const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
  const ux = tx / tLen;
  const uy = ty / tLen;

  // End the curve path at the arrowhead BASE so the stroke doesn't
  // poke through the filled triangle.
  const baseX = to.x - ux * arrowLen;
  const baseY = tipY - uy * arrowLen;

  const path = createSVGElement('path');
  path.setAttribute('class', 'viz-annotation-connector');
  setAttrs(path, {
    d: `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${baseX} ${baseY}`,
    fill: 'none',
    stroke,
    'stroke-width': 1.5,
  });
  parent.appendChild(path);

  // Arrowhead triangle: perpendicular to tangent direction.
  const px = -uy;
  const py = ux;

  const arrow = createSVGElement('polygon');
  arrow.setAttribute('class', 'viz-annotation-connector');
  setAttrs(arrow, {
    points: [
      `${to.x},${tipY}`,
      `${baseX + px * arrowWidth},${baseY + py * arrowWidth}`,
      `${baseX - px * arrowWidth},${baseY - py * arrowWidth}`,
    ].join(' '),
    fill: stroke,
  });
  parent.appendChild(arrow);
}

function renderAnnotation(parent: SVGElement, annotation: ResolvedAnnotation, index: number): void {
  const g = createSVGElement('g');
  g.setAttribute('class', `viz-annotation viz-annotation-${annotation.type}`);
  g.setAttribute('data-annotation-index', String(index));

  // Range rect
  if (annotation.rect) {
    const rect = createSVGElement('rect');
    rect.setAttribute('class', 'viz-annotation-range');
    setAttrs(rect, {
      x: annotation.rect.x,
      y: annotation.rect.y,
      width: annotation.rect.width,
      height: annotation.rect.height,
    });
    if (annotation.fill) rect.setAttribute('fill', annotation.fill);
    if (annotation.opacity !== undefined) {
      rect.setAttribute('fill-opacity', String(annotation.opacity));
    }
    g.appendChild(rect);
  }

  // Reference line
  if (annotation.line) {
    const line = createSVGElement('line');
    line.setAttribute('class', 'viz-annotation-line');
    setAttrs(line, {
      x1: annotation.line.start.x,
      y1: annotation.line.start.y,
      x2: annotation.line.end.x,
      y2: annotation.line.end.y,
      'stroke-width': annotation.strokeWidth ?? 1,
    });
    if (annotation.stroke) line.setAttribute('stroke', annotation.stroke);
    if (annotation.strokeDasharray) {
      line.setAttribute('stroke-dasharray', annotation.strokeDasharray);
    }
    g.appendChild(line);
  }

  // Label with optional connector line
  if (annotation.label?.visible) {
    // Render connector first (behind the label text)
    if (annotation.label.connector) {
      const c = annotation.label.connector;
      if (c.style === 'caret') {
        // Small directional chevron centered in the gap between the label
        // text and the data mark, pointing toward the data.
        const pointsDown = c.to.y > c.from.y;
        const caretSize = 4;
        // c.from.y is near the text baseline, not the visual bottom.
        // Estimate the text bottom from the label's line count and font size.
        const labelLines = annotation.label.text.split('\n');
        const labelFontSize = annotation.label.style.fontSize ?? 12;
        const labelLineHeight = labelFontSize * (annotation.label.style.lineHeight ?? 1.3);
        const textBottom =
          annotation.label.y + (labelLines.length - 1) * labelLineHeight + labelFontSize * 0.25;
        const textTop = annotation.label.y - labelFontSize;
        // Center caret in the gap between text edge and data point
        const gapEdge = pointsDown ? textBottom : textTop;
        const midY = (gapEdge + c.to.y) / 2;
        const tipX = c.to.x;
        const tipY = pointsDown ? midY + caretSize / 2 : midY - caretSize / 2;
        const baseY = pointsDown ? tipY - caretSize : tipY + caretSize;
        const path = createSVGElement('path');
        path.setAttribute('class', 'viz-annotation-connector');
        setAttrs(path, {
          d: `M${tipX - caretSize},${baseY} L${tipX},${tipY} L${tipX + caretSize},${baseY}`,
          fill: 'none',
          stroke: c.stroke,
          'stroke-width': 1.5,
          'stroke-opacity': 0.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        });
        g.appendChild(path);
      } else if (c.style === 'curve') {
        renderCurvedArrow(g, c.from, c.to, c.stroke);
      } else {
        const connector = createSVGElement('line');
        connector.setAttribute('class', 'viz-annotation-connector');
        setAttrs(connector, {
          x1: c.from.x,
          y1: c.from.y,
          x2: c.to.x,
          y2: c.to.y,
          stroke: c.stroke,
          'stroke-width': 1,
          'stroke-opacity': 0.5,
        });
        g.appendChild(connector);
      }
    }

    const text = createSVGElement('text');
    text.setAttribute('class', 'viz-annotation-label');
    setAttrs(text, { x: annotation.label.x, y: annotation.label.y });
    applyTextStyle(text, annotation.label.style);

    const lines = annotation.label.text.split('\n');
    const fontSize = annotation.label.style.fontSize ?? 12;
    const lineHeight = fontSize * (annotation.label.style.lineHeight ?? 1.3);
    const isMultiLine = lines.length > 1;

    // Multi-line text uses center alignment for a cleaner look
    if (isMultiLine) {
      text.setAttribute('text-anchor', 'middle');
      for (let i = 0; i < lines.length; i++) {
        const tspan = createSVGElement('tspan');
        setAttrs(tspan, { x: annotation.label.x, dy: i === 0 ? 0 : lineHeight });
        tspan.textContent = lines[i];
        text.appendChild(tspan);
      }
    } else {
      text.textContent = annotation.label.text;
    }

    // Render background rect behind text if specified
    if (annotation.label.background) {
      const charWidth = fontSize * 0.55;
      const maxLineWidth = Math.max(...lines.map((l) => l.length)) * charWidth;
      const totalHeight = lines.length * lineHeight;
      const pad = 3;
      const bgX = isMultiLine
        ? annotation.label.x - maxLineWidth / 2 - pad
        : annotation.label.x - pad;
      const bgRect = createSVGElement('rect');
      bgRect.setAttribute('class', 'viz-annotation-bg');
      setAttrs(bgRect, {
        x: bgX,
        y: annotation.label.y - fontSize + (lineHeight - fontSize) / 2 - pad,
        width: maxLineWidth + pad * 2,
        height: totalHeight + pad * 2,
        fill: annotation.label.background,
        rx: 2,
      });
      g.appendChild(bgRect);
    }

    g.appendChild(text);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Legend rendering
// ---------------------------------------------------------------------------

function renderLegend(parent: SVGElement, legend: LegendLayout): void {
  if (legend.entries.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'viz-legend');
  g.setAttribute('role', 'list');
  g.setAttribute('aria-label', 'Chart legend');

  const isHorizontal = legend.position === 'top' || legend.position === 'bottom';
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];
    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'viz-legend-entry');
    entryG.setAttribute('role', 'listitem');
    entryG.setAttribute('data-legend-index', String(i));
    entryG.setAttribute('data-legend-label', entry.label);
    entryG.setAttribute(
      'aria-label',
      `${entry.label}: ${entry.active !== false ? 'visible' : 'hidden'}`,
    );
    entryG.setAttribute('style', 'cursor: pointer');

    // Apply dimming for inactive entries
    if (entry.active === false) {
      entryG.setAttribute('opacity', '0.3');
    }

    // Swatch
    if (entry.shape === 'circle') {
      const circle = createSVGElement('circle');
      setAttrs(circle, {
        cx: offsetX + legend.swatchSize / 2,
        cy: offsetY + legend.swatchSize / 2,
        r: legend.swatchSize / 2,
        fill: entry.color,
      });
      entryG.appendChild(circle);
    } else if (entry.shape === 'line') {
      // Line swatch: a short line segment with a dot in the middle
      const line = createSVGElement('line');
      setAttrs(line, {
        x1: offsetX,
        y1: offsetY + legend.swatchSize / 2,
        x2: offsetX + legend.swatchSize,
        y2: offsetY + legend.swatchSize / 2,
        stroke: entry.color,
        'stroke-width': 2,
      });
      entryG.appendChild(line);
      // Small dot at center
      const dot = createSVGElement('circle');
      setAttrs(dot, {
        cx: offsetX + legend.swatchSize / 2,
        cy: offsetY + legend.swatchSize / 2,
        r: 2.5,
        fill: entry.color,
      });
      entryG.appendChild(dot);
    } else {
      const rect = createSVGElement('rect');
      setAttrs(rect, {
        x: offsetX,
        y: offsetY,
        width: legend.swatchSize,
        height: legend.swatchSize,
        fill: entry.color,
        rx: 2,
      });
      entryG.appendChild(rect);
    }

    // Label
    const label = createSVGElement('text');
    setAttrs(label, {
      x: offsetX + legend.swatchSize + legend.swatchGap,
      y: offsetY + legend.swatchSize / 2,
      'dominant-baseline': 'central',
    });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = entry.label;
    entryG.appendChild(label);

    g.appendChild(entryG);

    // Advance position for next entry
    if (isHorizontal) {
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      offsetX += entryWidth;
      // Wrap to next line if exceeding bounds
      if (offsetX > legend.bounds.x + legend.bounds.width && i < legend.entries.length - 1) {
        offsetX = legend.bounds.x;
        offsetY += legend.swatchSize + 6;
      }
    } else {
      offsetY += legend.swatchSize + legend.entryGap;
    }
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Brand rendering
// ---------------------------------------------------------------------------

const BRAND_FONT_SIZE = 20;
const BRAND_MIN_WIDTH = 120;
const BRAND_URL = 'https://tryopendata.ai';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Render the "OpenData" brand as a footer-row element, right-aligned on the
 * same baseline as the first bottom chrome text (source/byline/footer).
 * Uses the same font size as chrome source text so it blends in as a subtle
 * footer item rather than occupying independent visual space.
 */
function renderBrand(parent: SVGElement, layout: ChartLayout): void {
  if (layout.dimensions.width < BRAND_MIN_WIDTH) return;

  const { width } = layout.dimensions;
  const padding = layout.theme.spacing.padding;
  const rightEdge = width - padding;
  const fill = layout.theme.colors.axis;

  // Vertically align with the first bottom chrome element.
  const { chrome } = layout;
  const xAxisExtent = computeXAxisExtent(layout);
  const bottomOffset = layout.area.y + layout.area.height + xAxisExtent;
  const firstBottom = chrome.source ?? chrome.byline ?? chrome.footer;
  const chromeY = firstBottom
    ? bottomOffset + firstBottom.y
    : bottomOffset + layout.theme.spacing.chartToFooter;

  const a = createSVGElement('a');
  a.setAttribute('href', BRAND_URL);
  a.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
  a.setAttribute('class', 'viz-chrome-ref');

  // "Open" in normal weight, "Data" in semibold, rendered as a single
  // right-aligned text element with two tspans.
  const text = createSVGElement('text');
  setAttrs(text, {
    x: rightEdge,
    y: chromeY,
    'font-family': layout.theme.fonts.family,
    'font-size': BRAND_FONT_SIZE,
    'text-anchor': 'end',
    'dominant-baseline': 'hanging',
    'fill-opacity': 0.55,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', fill);

  const openSpan = createSVGElement('tspan');
  openSpan.setAttribute('font-weight', '500');
  openSpan.textContent = 'Open';
  text.appendChild(openSpan);

  const dataSpan = createSVGElement('tspan');
  dataSpan.setAttribute('font-weight', '600');
  dataSpan.textContent = 'Data';
  text.appendChild(dataSpan);

  a.appendChild(text);
  parent.appendChild(a);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a compiled ChartLayout into an SVG element and append it to a container.
 *
 * @param layout - Compiled ChartLayout from compileChart().
 * @param container - DOM element to mount the SVG into.
 * @returns The created SVG element.
 */
export function renderChartSVG(layout: ChartLayout, container: HTMLElement): SVGElement {
  const { width, height } = layout.dimensions;

  const svg = createSVGElement('svg') as SVGSVGElement;
  setAttrs(svg, {
    viewBox: `0 0 ${width} ${height}`,
    xmlns: SVG_NS,
  });
  svg.setAttribute('role', layout.a11y.role);
  svg.setAttribute('aria-label', layout.a11y.altText);
  svg.setAttribute('class', 'viz-chart');

  // Background
  const bg = createSVGElement('rect');
  setAttrs(bg, {
    x: 0,
    y: 0,
    width,
    height,
    fill: layout.theme.colors.background,
  });
  svg.appendChild(bg);

  // Clip path to prevent marks (especially area fills) from overflowing
  // into the chrome region (title/subtitle). Extends full width so
  // end-of-line labels aren't clipped, but constrains vertically.
  const clipId = `viz-clip-${Math.random().toString(36).slice(2, 8)}`;
  const defs = createSVGElement('defs');
  const clipPath = createSVGElement('clipPath');
  clipPath.setAttribute('id', clipId);
  const clipRect = createSVGElement('rect');
  setAttrs(clipRect, {
    x: 0,
    y: layout.area.y,
    width,
    height: layout.area.height + 2,
  });
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  // Render layers in order (back to front)
  // Axes render outside clip (labels extend beyond chart area)
  renderAxes(svg, layout);

  // Marks are clipped to chart area so area fills don't cover chrome
  const clippedGroup = createSVGElement('g');
  clippedGroup.setAttribute('clip-path', `url(#${clipId})`);
  renderMarks(clippedGroup, layout);
  svg.appendChild(clippedGroup);

  renderAnnotations(svg, layout);
  renderLegend(svg, layout.legend);

  // Chrome renders on top so titles are never obscured by chart elements
  renderChrome(svg, layout);

  // Brand renders as a footer item, right-aligned on the source/footer row
  renderBrand(svg, layout);

  container.appendChild(svg);
  return svg;
}
