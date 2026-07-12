/**
 * Annotation rendering: range rects, reference lines, labels with connectors.
 */

import type { ChartLayout, Point, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import {
  ARROWHEAD_LENGTH,
  BOLD_SPAN_FONT_WEIGHT,
  computeArrowheadPoints,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  parseAnnotationSpans,
} from '@opendata-ai/openchart-engine';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

/** Stroke width shared by every connector voice except the drop-line hairline. */
const CONNECTOR_STROKE_WIDTH = 1.25;

/**
 * Render an open-V arrowhead at the given tip with tangent direction. A stroked
 * polyline, not a filled triangle — the hand-annotated look.
 */
function renderArrowhead(
  parent: SVGElement,
  tipX: number,
  tipY: number,
  tangentX: number,
  tangentY: number,
  stroke: string,
): void {
  const head = computeArrowheadPoints(tipX, tipY, tangentX, tangentY);
  const arrow = createSVGElement('polyline');
  // `oc-annotation-arrowhead` is what edit mode selects on to find the tip. Both
  // the straight and the curved connector draw their head through here, and both
  // keep the shared `oc-annotation-connector` class for styling -- without the
  // dedicated class the drag code has to select `polyline.oc-annotation-connector`
  // and rely on no other polyline existing in the group.
  arrow.setAttribute('class', 'oc-annotation-connector oc-annotation-arrowhead');
  setAttrs(arrow, {
    points: [
      `${head.baseLeft.x},${head.baseLeft.y}`,
      `${head.tip.x},${head.tip.y}`,
      `${head.baseRight.x},${head.baseRight.y}`,
    ].join(' '),
    fill: 'none',
    stroke,
    'stroke-width': CONNECTOR_STROKE_WIDTH,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  parent.appendChild(arrow);
}

/**
 * Render a curved connector from a label to a data point: a single quadratic
 * with one decisive bend, no S-swoop. The control point leans along the axis the
 * connector left the text block on, so a vertical exit sweeps out and down while
 * a horizontal exit runs flat then dives.
 */
function renderCurvedConnector(
  parent: SVGElement,
  from: Point,
  to: Point,
  stroke: string,
  showArrow: boolean,
  exit: 'horizontal' | 'vertical' | undefined,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const vertical = exit ? exit === 'vertical' : Math.abs(dy) >= Math.abs(dx);
  const cpx = from.x + dx * (vertical ? 0.2 : 0.6);
  const cpy = from.y + dy * (vertical ? 0.6 : 0.2);

  // Tangent at the tip runs from the control point to the tip.
  const tx = to.x - cpx;
  const ty = to.y - cpy;
  const tLen = Math.sqrt(tx * tx + ty * ty) || 1;

  // When arrowed, stop the stroke at the arrowhead base so it doesn't poke
  // through the open V.
  const endX = showArrow ? to.x - (tx / tLen) * ARROWHEAD_LENGTH : to.x;
  const endY = showArrow ? to.y - (ty / tLen) * ARROWHEAD_LENGTH : to.y;

  const path = createSVGElement('path');
  path.setAttribute('class', 'oc-annotation-connector');
  setAttrs(path, {
    d: `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${endX} ${endY}`,
    fill: 'none',
    stroke,
    'stroke-width': CONNECTOR_STROKE_WIDTH,
    'stroke-linecap': 'round',
  });
  parent.appendChild(path);

  if (showArrow) {
    renderArrowhead(parent, to.x, to.y, tx, ty, stroke);
  }
}

/**
 * Fill a `<text>` with annotation copy: one `<tspan>` per `**bold**` span, lines
 * split on `\n`. The first span of each line carries the `x` reset and the `dy`
 * line advance, so multi-line and inline-bold compose. The engine measures these
 * same spans at these same weights, so bounds match what lands on screen.
 */
function fillRichText(text: SVGElement, content: string, x: number, lineHeight: number): void {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const spans = parseAnnotationSpans(lines[i]);
    for (let s = 0; s < spans.length; s++) {
      const tspan = createSVGElement('tspan');
      if (s === 0) {
        setAttrs(tspan, { x, dy: i === 0 ? 0 : lineHeight });
      }
      if (spans[s].bold) {
        tspan.setAttribute('font-weight', String(BOLD_SPAN_FONT_WEIGHT));
      }
      tspan.textContent = spans[s].text;
      text.appendChild(tspan);
    }
  }
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
    // Range fills cover large chart-area regions; if they intercept pointer
    // events the voronoi tooltip overlay below stops receiving mousemove
    // inside the range, creating hover dead zones. The label still receives
    // events for annotation click handlers.
    rect.setAttribute('pointer-events', 'none');
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

  // Footnote marker: annotation was demoted by auto-thinning. Render a numbered
  // dot at the data point instead of the full label text.
  if (annotation.footnoteIndex != null && annotation.label) {
    // Prefer the data point. A suppressed connector (too short to be worth
    // drawing) still leaves a resolved dot there, so fall through to it before
    // giving up on the label position.
    const cx =
      annotation.label.connector?.endpoint?.x ??
      annotation.label.connector?.to.x ??
      annotation.dot?.x ??
      annotation.label.x;
    const cy =
      annotation.label.connector?.endpoint?.y ??
      annotation.label.connector?.to.y ??
      annotation.dot?.y ??
      annotation.label.y;
    const r = 8;
    const circle = createSVGElement('circle');
    circle.setAttribute('class', 'oc-annotation-footnote-marker');
    setAttrs(circle, {
      cx,
      cy,
      r,
      fill: bgColor ?? '#ffffff',
      stroke: annotation.label.style.fill ?? '#666',
      'stroke-width': 1.5,
    });
    g.appendChild(circle);

    const num = createSVGElement('text');
    num.setAttribute('class', 'oc-annotation-footnote-number');
    setAttrs(num, {
      x: cx,
      y: cy,
      'dominant-baseline': 'central',
      'text-anchor': 'middle',
    });
    applyTextStyle(num, {
      ...annotation.label.style,
      fontSize: 9,
      fontWeight: 600,
    });
    num.textContent = String(annotation.footnoteIndex);
    g.appendChild(num);
    parent.appendChild(g);
    return;
  }

  // Label with optional connector line
  if (annotation.label?.visible) {
    // Render connector first (behind the label text)
    if (annotation.label.connector) {
      const c = annotation.label.connector;
      if (c.style === 'curve') {
        renderCurvedConnector(g, c.from, c.to, c.stroke, c.arrow, c.exit);
      } else if (c.style === 'drop-line') {
        // Quiet voice: hairline, slightly recessed, snapped to the pixel grid.
        const connector = createSVGElement('line');
        connector.setAttribute('class', 'oc-annotation-connector oc-annotation-drop-line');
        setAttrs(connector, {
          x1: c.from.x,
          y1: c.from.y,
          x2: c.to.x,
          y2: c.to.y,
          stroke: c.stroke,
          'stroke-width': 1,
          'stroke-opacity': 0.7,
          'shape-rendering': 'crispEdges',
        });
        g.appendChild(connector);
      } else if (c.arrow) {
        const dx = c.to.x - c.from.x;
        const dy = c.to.y - c.from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const lineEndX = c.to.x - ux * ARROWHEAD_LENGTH;
        const lineEndY = c.to.y - uy * ARROWHEAD_LENGTH;

        const connector = createSVGElement('line');
        connector.setAttribute('class', 'oc-annotation-connector');
        setAttrs(connector, {
          x1: c.from.x,
          y1: c.from.y,
          x2: lineEndX,
          y2: lineEndY,
          stroke: c.stroke,
          'stroke-width': CONNECTOR_STROKE_WIDTH,
          'stroke-linecap': 'round',
        });
        g.appendChild(connector);

        renderArrowhead(g, c.to.x, c.to.y, dx, dy, c.stroke);
      } else {
        const connector = createSVGElement('line');
        connector.setAttribute('class', 'oc-annotation-connector');
        setAttrs(connector, {
          x1: c.from.x,
          y1: c.from.y,
          x2: c.to.x,
          y2: c.to.y,
          stroke: c.stroke,
          'stroke-width': CONNECTOR_STROKE_WIDTH,
          'stroke-linecap': 'round',
        });
        g.appendChild(connector);
      }
    }

    // Endpoint marker: rendered AFTER the connector but BEFORE the label text so
    // it sits on top of the leader and under any text halo. The engine resolves
    // dot.x/y at the data point (never the pulled-back connector tip) and picks
    // the stroke so marker and leader read as one system.
    if (annotation.dot) {
      const dot = createSVGElement('circle');
      dot.setAttribute('class', 'oc-annotation-dot');
      setAttrs(dot, {
        cx: annotation.dot.x,
        cy: annotation.dot.y,
        r: annotation.dot.radius,
        fill: annotation.dot.fill,
        stroke: annotation.dot.stroke,
        'stroke-width': annotation.dot.strokeWidth,
      });
      g.appendChild(dot);
    }

    const text = createSVGElement('text');
    text.setAttribute('class', 'oc-annotation-label');
    setAttrs(text, { x: annotation.label.x, y: annotation.label.y });
    applyTextStyle(text, annotation.label.style);

    const fontSize = annotation.label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
    const lineHeight = fontSize * (annotation.label.style.lineHeight ?? DEFAULT_LINE_HEIGHT);

    fillRichText(text, annotation.label.text, annotation.label.x, lineHeight);

    // Render background rect behind text if specified, otherwise use
    // paint-order stroke halo to knock out lines behind text
    if (annotation.label.background && annotation.label.bounds) {
      // Size the plate from the engine's measured bounds, full stop. There used to
      // be a fallback branch here that re-derived the box from `fontSize * 0.55`
      // per character and center-aligned it for multi-line text. It was
      // unreachable (every resolver stamps `label.bounds`), but it was a third
      // copy of text geometry living in the renderer, and a *stale* one: it
      // center-aligned, which the redesign explicitly does not do. Dead code that
      // contradicts live code is the drift trap, not protection from it.
      const pad = 3;
      const b = annotation.label.bounds;
      const bgX = b.x - pad;
      const bgY = b.y - pad;
      const bgW = b.width + pad * 2;
      const bgH = b.height + pad * 2;

      const bgRect = createSVGElement('rect');
      bgRect.setAttribute('class', 'oc-annotation-bg');
      setAttrs(bgRect, {
        x: bgX,
        y: bgY,
        width: bgW,
        height: bgH,
        fill: annotation.label.background,
        rx: 2,
      });
      g.appendChild(bgRect);
    } else if (bgColor && annotation.label.halo !== false) {
      text.style.paintOrder = 'stroke';
      text.style.stroke = bgColor;
      text.style.strokeWidth = `${Math.round(fontSize * 0.3)}px`;
      text.style.strokeLinejoin = 'round';
    }

    g.appendChild(text);

    // Optional muted subtitle, positioned by the engine below the primary label.
    if (annotation.subtitle) {
      const sub = createSVGElement('text');
      sub.setAttribute('class', 'oc-annotation-subtitle');
      setAttrs(sub, { x: annotation.subtitle.x, y: annotation.subtitle.y });
      applyTextStyle(sub, annotation.subtitle.style);
      const subFontSize = annotation.subtitle.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
      const subLineHeight =
        subFontSize * (annotation.subtitle.style.lineHeight ?? DEFAULT_LINE_HEIGHT);
      fillRichText(sub, annotation.subtitle.text, annotation.subtitle.x, subLineHeight);
      g.appendChild(sub);
    }
  }

  parent.appendChild(g);
}

export function renderAnnotations(parent: SVGElement, layout: ChartLayout): void {
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
