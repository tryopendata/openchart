/**
 * SVG renderer: converts a ChartLayout into SVG DOM elements.
 *
 * Creates an <svg> element with viewBox matching layout dimensions,
 * renders chrome (title/subtitle/source), axes, marks, annotations,
 * and legend. All styling via inline SVG attributes from layout data.
 *
 * This file is the orchestrator only. Each rendering concern lives in its
 * own module under `./renderers/`.
 */

import type { ChartLayout, RectMark } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';
import { buildGradientDefs } from './gradient-utils';
import { renderAnnotations } from './renderers/annotations';
import { renderAxes } from './renderers/axes';
import { renderBrand } from './renderers/brand';
import { renderChrome } from './renderers/chrome';
import { renderEndpointLabels } from './renderers/endpoint-labels';
import { renderLegend } from './renderers/legend';
import { renderMarks, resetMarkRenderState, setMarkRenderState } from './renderers/marks';
import { createSVGElement, SVG_NS, setAttrs } from './renderers/svg-dom';
import { nextSvgId } from './svg-ids';

// Re-export registerMarkRenderer so external consumers can still register
// custom mark renderers via the vanilla package entry point.
export { registerMarkRenderer } from './renderers/marks';

/** CSS easing preset map for inline style custom properties. */
const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

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
  opts?: { animate?: boolean; crosshair?: boolean },
): SVGElement {
  const { width, height } = layout.dimensions;
  const animation = layout.animation;

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

  // Sparkline display mode: stamp a data attribute so consumers can target
  // sparkline-specific styles. Only set the attribute in sparkline mode so
  // regular charts keep an unchanged DOM signature.
  if (layout.display === 'sparkline') {
    svg.setAttribute('data-display', 'sparkline');
  }

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
  const maxPointR = layout.marks.reduce(
    (max, m) =>
      m.type === 'point' && (m as { r?: number }).r ? Math.max(max, (m as { r?: number }).r!) : max,
    0,
  );
  const clipPad = Math.max(maxPointR, 2);
  const clipRect = createSVGElement('rect');
  setAttrs(clipRect, {
    x: 0,
    y: layout.area.y - clipPad,
    width,
    height: layout.area.height + clipPad * 2,
  });
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);

  // Build gradient defs for marks with gradient fills
  const gradientMap = buildGradientDefs(layout.marks as Array<{ fill?: unknown }>, defs);

  svg.appendChild(defs);

  // Prime mark-renderer module-level state so mark sub-renderers can resolve
  // animation + gradient fills without signature changes. try/finally guarantees
  // the reset fires even if any downstream renderer throws, so the next render
  // starts with a clean slate.
  setMarkRenderState({ animation, gradientMap });
  try {
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

      // Crosshair line: opt-in vertical line that tracks the nearest data point
      if (opts?.crosshair) {
        const crosshairLine = createSVGElement('line');
        crosshairLine.setAttribute('data-crosshair', 'true');
        crosshairLine.setAttribute('class', 'oc-crosshair');
        setAttrs(crosshairLine, {
          x1: 0,
          y1: layout.area.y,
          x2: 0,
          y2: layout.area.y + layout.area.height,
          stroke: layout.theme.colors.gridline,
          'stroke-opacity': '0.5',
          'stroke-dasharray': '4,3',
          'stroke-width': '1',
          'pointer-events': 'none',
        });
        crosshairLine.style.display = 'none';
        clippedGroup.appendChild(crosshairLine);
      }
    }

    svg.appendChild(clippedGroup);

    renderAnnotations(svg, layout);

    // Endpoint labels render after marks/annotations so they sit on top of any
    // chart-edge content, but before the traditional legend so chrome wins on
    // collision. The engine handles all suppression — when entries is empty,
    // renderEndpointLabels is a no-op.
    renderEndpointLabels(svg, layout);

    renderLegend(svg, layout.legend);

    // Chrome renders on top so titles are never obscured by chart elements
    renderChrome(svg, layout);

    // Brand renders as a footer item, right-aligned on the source/footer row
    if (layout.watermark) {
      renderBrand(svg, layout);
    }
  } finally {
    resetMarkRenderState();
  }

  container.appendChild(svg);
  return svg;
}
