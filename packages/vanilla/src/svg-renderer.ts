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
  LineMark,
  Mark,
  Point,
  PointMark,
  RectMark,
  ResolvedAnimation,
  ResolvedAnnotation,
  RuleMarkLayout,
  TextMarkLayout,
  TickMarkLayout,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';
import { buildGradientDefs, resolveMarkFill } from './gradient-utils';
import { renderBrand } from './renderers/brand';
import { renderChrome } from './renderers/chrome';
import { renderLegend } from './renderers/legend';
import { applyTextStyle, createSVGElement, SVG_NS, setAttrs } from './renderers/svg-dom';
import { nextSvgId } from './svg-ids';

/**
 * Module-level animation state. Set by renderChartSVG before rendering marks
 * so mark renderers can read it without changing their function signatures.
 */
let currentAnimation: ResolvedAnimation | undefined;

/**
 * Module-level gradient map. Set by renderChartSVG after building gradient defs
 * so mark renderers can resolve gradient fills without signature changes.
 */
let currentGradientMap: Map<string, string> = new Map();

/**
 * Stamp animation index attributes on a mark element when animation is enabled.
 * Sets `data-animation-index` (for querySelector) and `--oc-mark-index`
 * (for CSS calc-based stagger delay).
 */
function stampAnimationAttrs(
  el: SVGElement,
  mark: { animationIndex?: number },
  fallbackIndex: number,
): void {
  if (!currentAnimation?.enabled) return;
  const idx = mark.animationIndex ?? fallbackIndex;
  el.setAttribute('data-animation-index', String(idx));
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('--oc-mark-index', String(idx));
}

/** CSS easing preset map for inline style custom properties. */
const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

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
  g.setAttribute('class', `oc-axis oc-axis-${orientation}`);

  const { area } = layout;

  // Only draw axis line for x-axis (bottom baseline).
  // Horizontal gridlines already guide y-values, so the vertical y-axis line is redundant.
  if (orientation === 'x') {
    const line = createSVGElement('line');
    line.setAttribute('class', 'oc-axis-line');
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
      label.setAttribute('class', 'oc-axis-tick');

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
      label.setAttribute('class', 'oc-axis-tick');
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
    gl.setAttribute('class', 'oc-gridline');
    if (orientation === 'y') {
      setAttrs(gl, {
        x1: area.x,
        y1: gridline.position,
        x2: area.x + area.width,
        y2: gridline.position,
        stroke: layout.theme.colors.gridline,
        'stroke-width': 1,
        'stroke-opacity': 0.6,
      });
    } else {
      setAttrs(gl, {
        x1: gridline.position,
        y1: area.y,
        x2: gridline.position,
        y2: area.y + area.height,
        stroke: layout.theme.colors.gridline,
        'stroke-width': 1,
        'stroke-opacity': 0.6,
      });
    }
    g.appendChild(gl);
  }

  // Axis label
  if (axis.label && axis.labelStyle) {
    const axisLabel = createSVGElement('text');
    axisLabel.setAttribute('class', 'oc-axis-title');
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
  g.setAttribute('class', 'oc-mark oc-mark-line');
  stampAnimationAttrs(g, mark, index);

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
    // Note: line drawing animation is handled via CSS clip-path on the group,
    // no inline dasharray/dashoffset needed.
    g.appendChild(path);
  }

  // Render end-of-line label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-mark-label');
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
      connector.setAttribute('class', 'oc-mark-connector');
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
  g.setAttribute('class', 'oc-mark oc-mark-area');
  stampAnimationAttrs(g, mark, index);

  if (mark.path) {
    // Area fill: the full closed shape (top line + baseline), no stroke
    const fill = createSVGElement('path');
    setAttrs(fill, {
      d: mark.path,
      fill: resolveMarkFill(mark.fill, currentGradientMap),
      'fill-opacity': mark.fillOpacity,
      stroke: 'none',
    });
    g.appendChild(fill);

    // Top-line stroke: only along the data points, not the baseline
    if (mark.stroke && mark.topPath) {
      const strokePath = createSVGElement('path');
      strokePath.setAttribute('class', 'oc-area-top');
      setAttrs(strokePath, {
        d: mark.topPath,
        fill: 'none',
        stroke: mark.stroke,
        'stroke-width': mark.strokeWidth ?? 1,
      });
      // Note: area drawing animation is handled via CSS clip-path on the group,
      // no inline dasharray/dashoffset needed.
      g.appendChild(strokePath);
    }
  }

  return g;
}

function renderRectMark(mark: RectMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `rect-${index}`);
  g.setAttribute('class', 'oc-mark oc-mark-rect');
  stampAnimationAttrs(g, mark, index);
  // Use engine-provided orientation for animation direction
  if (currentAnimation?.enabled && mark.orient === 'horizontal') {
    g.setAttribute('data-orient', 'horizontal');
  }

  const rect = createSVGElement('rect');
  setAttrs(rect, {
    x: mark.x,
    y: mark.y,
    width: mark.width,
    height: mark.height,
    fill: resolveMarkFill(mark.fill, currentGradientMap),
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
    label.setAttribute('class', 'oc-mark-label');
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
  g.setAttribute('class', 'oc-mark oc-mark-arc');
  g.setAttribute('transform', `translate(${mark.center.x},${mark.center.y})`);
  stampAnimationAttrs(g, mark, index);

  const path = createSVGElement('path');
  setAttrs(path, {
    d: mark.path,
    fill: resolveMarkFill(mark.fill, currentGradientMap),
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  g.appendChild(path);

  // Render label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-mark-label');
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
  circle.setAttribute('class', 'oc-mark oc-mark-point');
  stampAnimationAttrs(circle, mark, index);

  setAttrs(circle, {
    cx: mark.cx,
    cy: mark.cy,
    r: mark.r,
    fill: resolveMarkFill(mark.fill, currentGradientMap),
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  if (mark.fillOpacity !== undefined) {
    circle.setAttribute('fill-opacity', String(mark.fillOpacity));
  }
  return circle;
}

function renderTextMark(mark: TextMarkLayout, index: number): SVGElement {
  const text = createSVGElement('text');
  text.setAttribute('data-mark-id', `textMark-${index}`);
  text.setAttribute('class', 'oc-mark oc-mark-text');
  stampAnimationAttrs(text, mark, index);

  setAttrs(text, {
    x: mark.x,
    y: mark.y,
    'font-size': mark.fontSize,
    'text-anchor': mark.textAnchor,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', mark.fill);
  if (mark.fontWeight) {
    text.setAttribute('font-weight', String(mark.fontWeight));
  }
  if (mark.fontFamily) {
    text.setAttribute('font-family', mark.fontFamily);
  }
  if (mark.angle) {
    text.setAttribute('transform', `rotate(${mark.angle}, ${mark.x}, ${mark.y})`);
  }
  text.textContent = mark.text;
  return text;
}

function renderRuleMark(mark: RuleMarkLayout, index: number): SVGElement {
  const line = createSVGElement('line');
  line.setAttribute('data-mark-id', `rule-${index}`);
  line.setAttribute('class', 'oc-mark oc-mark-rule');
  stampAnimationAttrs(line, mark, index);

  setAttrs(line, {
    x1: mark.x1,
    y1: mark.y1,
    x2: mark.x2,
    y2: mark.y2,
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  if (mark.strokeDasharray) {
    line.setAttribute('stroke-dasharray', mark.strokeDasharray);
  }
  if (mark.opacity != null) {
    line.setAttribute('opacity', String(mark.opacity));
  }
  return line;
}

function renderTickMark(mark: TickMarkLayout, index: number): SVGElement {
  const line = createSVGElement('line');
  line.setAttribute('data-mark-id', `tick-${index}`);
  line.setAttribute('class', 'oc-mark oc-mark-tick');
  stampAnimationAttrs(line, mark, index);

  // Tick is a short line segment centered at (x, y)
  const half = mark.length / 2;
  if (mark.orient === 'vertical') {
    setAttrs(line, {
      x1: mark.x,
      y1: mark.y - half,
      x2: mark.x,
      y2: mark.y + half,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
    });
  } else {
    setAttrs(line, {
      x1: mark.x - half,
      y1: mark.y,
      x2: mark.x + half,
      y2: mark.y,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
    });
  }

  if (mark.opacity != null) {
    line.setAttribute('opacity', String(mark.opacity));
  }
  return line;
}

// Register built-in renderers
registerMarkRenderer('line', renderLineMark as MarkRenderer<Mark>);
registerMarkRenderer('area', renderAreaMark as MarkRenderer<Mark>);
registerMarkRenderer('rect', renderRectMark as MarkRenderer<Mark>);
registerMarkRenderer('arc', renderArcMark as MarkRenderer<Mark>);
registerMarkRenderer('point', renderPointMark as MarkRenderer<Mark>);
registerMarkRenderer('textMark', renderTextMark as MarkRenderer<Mark>);
registerMarkRenderer('rule', renderRuleMark as MarkRenderer<Mark>);
registerMarkRenderer('tick', renderTickMark as MarkRenderer<Mark>);

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
  g.setAttribute('class', 'oc-marks');

  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    const renderer = markRenderers[mark.type];
    if (!renderer) continue;

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

    // For stacked segments, set stack position for sequential animation chaining.
    // stackPos is computed by the engine on RectMark during compilation.
    if (currentAnimation?.enabled && mark.type === 'rect') {
      const rect = mark as RectMark;
      if (rect.stackGroup && rect.stackPos !== undefined) {
        el.setAttribute('data-stack-pos', String(rect.stackPos));
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty(
          '--oc-stack-pos',
          String(rect.stackPos),
        );
      }
    }

    g.appendChild(el);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Annotation rendering
// ---------------------------------------------------------------------------

function renderAnnotations(parent: SVGElement, layout: ChartLayout): void {
  if (layout.annotations.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-annotations');

  // Annotations are already sorted by zIndex from the engine, so render in order
  const bgColor = layout.theme.colors.background;
  for (let i = 0; i < layout.annotations.length; i++) {
    renderAnnotation(g, layout.annotations[i], i, bgColor);
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
  path.setAttribute('class', 'oc-annotation-connector');
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
  arrow.setAttribute('class', 'oc-annotation-connector');
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

function renderAnnotation(
  parent: SVGElement,
  annotation: ResolvedAnnotation,
  index: number,
  bgColor?: string,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', `oc-annotation oc-annotation-${annotation.type}`);
  g.setAttribute('data-annotation-index', String(index));
  if (annotation.id) {
    g.setAttribute('data-annotation-id', annotation.id);
  }

  // Range rect
  if (annotation.rect) {
    const rect = createSVGElement('rect');
    rect.setAttribute('class', 'oc-annotation-range');
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
    line.setAttribute('class', 'oc-annotation-line');
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
      if (c.style === 'curve') {
        renderCurvedArrow(g, c.from, c.to, c.stroke);
      } else {
        const connector = createSVGElement('line');
        connector.setAttribute('class', 'oc-annotation-connector');
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
    text.setAttribute('class', 'oc-annotation-label');
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

    // Render background rect behind text if specified, otherwise use
    // paint-order stroke halo to knock out lines behind text
    if (annotation.label.background) {
      const charWidth = fontSize * 0.55;
      const maxLineWidth = Math.max(...lines.map((l) => l.length)) * charWidth;
      const totalHeight = lines.length * lineHeight;
      const pad = 3;
      const bgX = isMultiLine
        ? annotation.label.x - maxLineWidth / 2 - pad
        : annotation.label.x - pad;
      const bgRect = createSVGElement('rect');
      bgRect.setAttribute('class', 'oc-annotation-bg');
      setAttrs(bgRect, {
        x: bgX,
        y: annotation.label.y - fontSize + (lineHeight - fontSize) / 2 - pad,
        width: maxLineWidth + pad * 2,
        height: totalHeight + pad * 2,
        fill: annotation.label.background,
        rx: 2,
      });
      g.appendChild(bgRect);
    } else if (bgColor) {
      text.style.paintOrder = 'stroke';
      text.style.stroke = bgColor;
      text.style.strokeWidth = `${Math.round(fontSize * 0.3)}px`;
      text.style.strokeLinejoin = 'round';
    }

    g.appendChild(text);
  }

  parent.appendChild(g);
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
export function renderChartSVG(
  layout: ChartLayout,
  container: HTMLElement,
  opts?: { animate?: boolean },
): SVGElement {
  const { width, height } = layout.dimensions;
  const animation = layout.animation;

  // Set module-level animation state so mark renderers can access it
  currentAnimation = animation;

  const svg = createSVGElement('svg') as SVGSVGElement;
  setAttrs(svg, {
    viewBox: `0 0 ${width} ${height}`,
    xmlns: SVG_NS,
    // WebKit/iOS Safari getBBox() bug: text with dominant-baseline:hanging
    // reports bounding boxes extending above y=0. The SVG spec default
    // overflow is "hidden", which clips this phantom extent. Setting
    // overflow:visible prevents the clipping. Chart marks are already
    // constrained by a clipPath, so nothing bleeds out.
    overflow: 'visible',
  });
  // Set explicit pixel height via inline style. iOS Safari misresolves CSS
  // height:100% when the ancestor chain uses minHeight instead of height,
  // causing the top of the chart (title) to clip on real mobile devices.
  svg.style.height = `${height}px`;
  svg.setAttribute('role', layout.a11y.role);
  svg.setAttribute('aria-label', layout.a11y.altText);

  // oc-animate must be set before the SVG enters the DOM to prevent a flash
  // of the final state. mount.ts passes animate: true only on genuine first render.
  const classes = opts?.animate ? 'oc-chart oc-animate' : 'oc-chart';
  svg.setAttribute('class', classes);

  // Set animation CSS custom properties when enabled
  if (animation?.enabled) {
    const markCount = layout.marks.length;
    const stagger = clampStaggerDelay(animation.staggerDelay, markCount);
    svg.style.setProperty('--oc-animation-duration', `${animation.duration}ms`);
    svg.style.setProperty('--oc-animation-stagger', `${stagger}ms`);
    svg.style.setProperty('--oc-annotation-delay', `${animation.annotationDelay}ms`);
    const easeVar = EASE_VAR_MAP[animation.ease] || EASE_VAR_MAP.smooth;
    svg.style.setProperty('--oc-animation-ease', easeVar);

    // Compute per-segment duration for stacked bars so the total bar animation
    // time stays consistent regardless of segment count.
    // stackPos is set by the engine (0-indexed position within each stack group).
    let maxSegments = 0;
    for (const m of layout.marks) {
      if (m.type === 'rect') {
        const pos = (m as RectMark).stackPos;
        if (pos !== undefined && pos + 1 > maxSegments) {
          maxSegments = pos + 1;
        }
      }
    }
    if (maxSegments > 0) {
      const segDuration = Math.round(animation.duration / maxSegments);
      svg.style.setProperty('--oc-stack-segment-duration', `${segDuration}ms`);
    }
  }

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
  const clipId = nextSvgId('oc-clip');
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

  // Build gradient defs for marks with gradient fills
  currentGradientMap = buildGradientDefs(layout.marks as Array<{ fill?: unknown }>, defs);

  svg.appendChild(defs);

  // Render layers in order (back to front)
  // Axes render outside clip (labels extend beyond chart area)
  renderAxes(svg, layout);

  // Marks are clipped to chart area so area fills don't cover chrome
  const clippedGroup = createSVGElement('g');
  clippedGroup.setAttribute('clip-path', `url(#${clipId})`);
  renderMarks(clippedGroup, layout);

  // Add transparent overlay rect for line/area charts to enable voronoi tooltip lookup.
  // Only added when there are line or area marks with dataPoints, and no explicit
  // PointMark objects (which use per-element event handling instead).
  const hasLineOrAreaWithDataPoints = layout.marks.some(
    (m) => (m.type === 'line' || m.type === 'area') && m.dataPoints && m.dataPoints.length > 0,
  );
  const hasPointMarks = layout.marks.some((m) => m.type === 'point');
  if (hasLineOrAreaWithDataPoints && !hasPointMarks) {
    const overlay = createSVGElement('rect');
    setAttrs(overlay, {
      x: layout.area.x,
      y: layout.area.y,
      width: layout.area.width,
      height: layout.area.height,
      fill: 'transparent',
    });
    overlay.setAttribute('class', 'oc-voronoi-overlay');
    overlay.setAttribute('data-voronoi-overlay', 'true');
    clippedGroup.appendChild(overlay);
  }

  svg.appendChild(clippedGroup);

  renderAnnotations(svg, layout);
  renderLegend(svg, layout.legend);

  // Chrome renders on top so titles are never obscured by chart elements
  renderChrome(svg, layout);

  // Brand renders as a footer item, right-aligned on the source/footer row
  if (layout.watermark) {
    renderBrand(svg, layout);
  }

  // Reset module-level state after rendering
  currentAnimation = undefined;
  currentGradientMap = new Map();

  container.appendChild(svg);
  return svg;
}
