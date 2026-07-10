/**
 * Annotation rendering: range rects, reference lines, labels with connectors.
 */

import type { ChartLayout, Point, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { computeArrowheadPoints } from '@opendata-ai/openchart-engine';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

// Must match computeArrowheadPoints default (engine geometry.ts)
const ARROWHEAD_LENGTH = 8;

/** Render an arrowhead polygon at the given tip with tangent direction. */
function renderArrowhead(
  parent: SVGElement,
  tipX: number,
  tipY: number,
  tangentX: number,
  tangentY: number,
  fill: string,
): void {
  const head = computeArrowheadPoints(tipX, tipY, tangentX, tangentY);
  const arrow = createSVGElement('polygon');
  arrow.setAttribute('class', 'oc-annotation-connector');
  setAttrs(arrow, {
    points: [
      `${head.tip.x},${head.tip.y}`,
      `${head.baseLeft.x},${head.baseLeft.y}`,
      `${head.baseRight.x},${head.baseRight.y}`,
    ].join(' '),
    fill,
  });
  parent.appendChild(arrow);
}

/**
 * Render a curved connector from a label to a data point.
 * Optionally draws an arrowhead at the tip.
 */
function renderCurvedConnector(
  parent: SVGElement,
  from: Point,
  to: Point,
  stroke: string,
  showArrow: boolean,
): void {
  const pad = showArrow ? 6 : 0;
  const tipY = to.y - pad;

  const dy = tipY - from.y;
  const dist = Math.sqrt((to.x - from.x) ** 2 + dy ** 2) || 1;

  const bulge = Math.max(dist * 0.4, 35);
  const cp1x = from.x + bulge;
  const cp1y = from.y + dy * 0.35;
  const cp2x = to.x;
  const cp2y = tipY - Math.abs(dy) * 0.25;

  // Tangent at the tip (from cp2 to tip).
  const tx = to.x - cp2x;
  const ty = tipY - cp2y;
  const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
  const ux = tx / tLen;
  const uy = ty / tLen;

  // When drawing an arrowhead, end the curve at the arrowhead base
  // so the stroke doesn't poke through the filled triangle.
  const endX = showArrow ? to.x - ux * ARROWHEAD_LENGTH : to.x;
  const endY = showArrow ? tipY - uy * ARROWHEAD_LENGTH : tipY;

  const path = createSVGElement('path');
  path.setAttribute('class', 'oc-annotation-connector');
  setAttrs(path, {
    d: `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    fill: 'none',
    stroke,
    'stroke-width': 1.5,
  });
  parent.appendChild(path);

  if (showArrow) {
    renderArrowhead(parent, to.x, tipY, tx, ty, stroke);
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
    const cx =
      annotation.label.connector?.endpoint?.x ??
      annotation.label.connector?.to.x ??
      annotation.label.x;
    const cy =
      annotation.label.connector?.endpoint?.y ??
      annotation.label.connector?.to.y ??
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
        renderCurvedConnector(g, c.from, c.to, c.stroke, c.arrow);
      } else if (c.style === 'drop-line') {
        const connector = createSVGElement('line');
        connector.setAttribute('class', 'oc-annotation-connector oc-annotation-drop-line');
        setAttrs(connector, {
          x1: c.from.x,
          y1: c.from.y,
          x2: c.to.x,
          y2: c.to.y,
          stroke: c.stroke,
          'stroke-width': 1,
          'stroke-opacity': 0.6,
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
          'stroke-width': 1,
          'stroke-opacity': 0.5,
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
          'stroke-width': 1,
          'stroke-opacity': 0.5,
        });
        g.appendChild(connector);
      }

      // Endpoint marker: bullseye dot at the data point. Skipped when an
      // arrowhead is present — it already serves as the endpoint indicator.
      if (c.endpoint && !c.arrow) {
        const ring = createSVGElement('circle');
        ring.setAttribute('class', 'oc-annotation-endpoint-ring');
        setAttrs(ring, {
          cx: c.endpoint.x,
          cy: c.endpoint.y,
          r: 5,
          fill: bgColor ?? '#ffffff',
          stroke: c.stroke,
          'stroke-width': 1.5,
        });
        g.appendChild(ring);

        const dot = createSVGElement('circle');
        dot.setAttribute('class', 'oc-annotation-endpoint-dot');
        setAttrs(dot, {
          cx: c.endpoint.x,
          cy: c.endpoint.y,
          r: 2,
          fill: c.stroke,
        });
        g.appendChild(dot);
      }
    }

    // Optional anchor dot: rendered AFTER the connector but BEFORE the label
    // text so the dot sits on top of the connector and under any text halo.
    // The engine resolves dot.x/y at the post-gap-pullback connector.to point;
    // the renderer just stamps coordinates.
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

    const lines = annotation.label.text.split('\n');
    const fontSize = annotation.label.style.fontSize ?? 12;
    const lineHeight = fontSize * (annotation.label.style.lineHeight ?? 1.3);
    const isMultiLine = lines.length > 1;

    if (isMultiLine) {
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
      const pad = 3;
      let bgX: number;
      let bgY: number;
      let bgW: number;
      let bgH: number;

      if (annotation.label.bounds) {
        const b = annotation.label.bounds;
        bgX = b.x - pad;
        bgY = b.y - pad;
        bgW = b.width + pad * 2;
        bgH = b.height + pad * 2;
      } else {
        const charWidth = fontSize * 0.55;
        const maxLineWidth = Math.max(...lines.map((l) => l.length)) * charWidth;
        const totalHeight = lines.length * lineHeight;
        bgX = isMultiLine ? annotation.label.x - maxLineWidth / 2 - pad : annotation.label.x - pad;
        bgY = annotation.label.y - fontSize + (lineHeight - fontSize) / 2 - pad;
        bgW = maxLineWidth + pad * 2;
        bgH = totalHeight + pad * 2;
      }

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
      sub.textContent = annotation.subtitle.text;
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
