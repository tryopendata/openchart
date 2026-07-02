/**
 * Annotation rendering: range rects, reference lines, labels with connectors.
 */

import type { ChartLayout, Point, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

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

  // Label with optional connector line
  if (annotation.label?.visible) {
    // Render connector first (behind the label text)
    if (annotation.label.connector) {
      const c = annotation.label.connector;
      if (c.style === 'curve') {
        renderCurvedArrow(g, c.from, c.to, c.stroke);
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

      // Endpoint marker: bullseye dot at the data point. Outer ring uses the
      // chart background as fill so it knocks out the line/area beneath; inner
      // dot is the connector color. Skipped for curve style — the arrowhead
      // already serves as the endpoint indicator there.
      if (c.endpoint && c.style !== 'curve') {
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

    // Multi-line text: drop-line connectors keep the resolved side anchor so
    // the label hugs the vertical line. Other connectors center the text for
    // a cleaner look.
    if (isMultiLine) {
      const isDropLine = annotation.label.connector?.style === 'drop-line';
      if (!isDropLine) {
        text.setAttribute('text-anchor', 'middle');
      }
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
      let bgWidth: number;
      let bgHeight: number;
      if (annotation.label.bounds) {
        bgX = annotation.label.bounds.x - pad;
        bgWidth = annotation.label.bounds.width + pad * 2;
        bgHeight = annotation.label.bounds.height + pad * 2;
      } else {
        const charWidth = fontSize * 0.55;
        const maxLineWidth = Math.max(...lines.map((l) => l.length)) * charWidth;
        const totalHeight = lines.length * lineHeight;
        bgX = isMultiLine ? annotation.label.x - maxLineWidth / 2 - pad : annotation.label.x - pad;
        bgWidth = maxLineWidth + pad * 2;
        bgHeight = totalHeight + pad * 2;
      }
      const bgRect = createSVGElement('rect');
      bgRect.setAttribute('class', 'oc-annotation-bg');
      setAttrs(bgRect, {
        x: bgX,
        y: annotation.label.y - fontSize + (lineHeight - fontSize) / 2 - pad,
        width: bgWidth,
        height: bgHeight,
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
