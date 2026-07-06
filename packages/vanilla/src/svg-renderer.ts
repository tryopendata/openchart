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

import type { ChartLayout, FacetPanelLayout, RectMark } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';
import { buildGradientDefs } from './gradient-utils';
import { renderAnnotations } from './renderers/annotations';
import { renderAxes } from './renderers/axes';
import { renderBrand } from './renderers/brand';
import { renderChrome } from './renderers/chrome';
import { renderEndpointLabels } from './renderers/endpoint-labels';
import { renderLegend } from './renderers/legend';
import { renderMarks, resetMarkRenderState, setMarkRenderState } from './renderers/marks';
import { renderMetrics } from './renderers/metrics';
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
    // The SVG spec default is overflow:"hidden", which clips anything a hair
    // outside the viewBox. We now position all text on the alphabetic/central
    // baseline (dominant-baseline:hanging was dropped because WebKit computed
    // it from different metrics), but WebKit/iOS still reports getBBox extents
    // with a few pixels of slack around tspans, so text touching an edge can
    // still get clipped. overflow:visible avoids that. Chart marks are already
    // constrained by a clipPath, so nothing bleeds out.
    overflow: 'visible',
    // Hint browsers to enable sub-pixel font hinting and kerning for chart text.
    'text-rendering': 'optimizeLegibility',
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

  // Background. Sparkline mode skips the background rect entirely so the
  // host page's surface color shows through — sparklines are drop-ins for
  // KPI cards, table cells, and inline contexts where the consumer owns
  // the background. Other display modes paint a fill so the chart is a
  // self-contained visual on any host surface.
  if (layout.display !== 'sparkline') {
    const bg = createSVGElement('rect');
    setAttrs(bg, {
      x: 0,
      y: 0,
      width,
      height,
      fill: layout.theme.colors.background,
    });
    svg.appendChild(bg);
  }

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
    if (layout.facet) {
      // Faceted rendering: per-panel axes, marks, annotations
      renderFacetedPanels(svg, layout, layout.facet.panels, defs);
    } else {
      // Standard (non-faceted) rendering
      // Axes render outside clip (labels extend beyond chart area)
      renderAxes(svg, layout);

      // Marks are clipped to chart area so area fills don't cover chrome
      const clippedGroup = createSVGElement('g');
      clippedGroup.setAttribute('clip-path', `url(#${clipId})`);
      const markLabelsOverlay = renderMarks(clippedGroup, layout);

      // Add transparent overlay rect for line/area charts to enable voronoi tooltip lookup.
      const hasLineOrAreaWithDataPoints = layout.marks.some(
        (m) => (m.type === 'line' || m.type === 'area') && m.dataPoints && m.dataPoints.length > 0,
      );
      if (hasLineOrAreaWithDataPoints) {
        const pointEls = clippedGroup.querySelectorAll('circle.oc-mark-point');
        for (const el of pointEls) {
          el.setAttribute('pointer-events', 'none');
        }

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

        if (opts?.crosshair) {
          const crosshairLine = createSVGElement('line');
          crosshairLine.setAttribute('data-crosshair', 'true');
          crosshairLine.setAttribute('class', 'oc-crosshair');
          setAttrs(crosshairLine, {
            x1: 0,
            y1: layout.area.y,
            x2: 0,
            y2: layout.area.y + layout.area.height,
            stroke: layout.theme.colors.axis,
            'stroke-opacity': '0.4',
            'stroke-dasharray': '3,3',
            'stroke-width': '1',
            'pointer-events': 'none',
          });
          crosshairLine.style.display = 'none';
          clippedGroup.appendChild(crosshairLine);
        }

        const dotsGroup = createSVGElement('g');
        dotsGroup.setAttribute('data-snap-dots', 'true');
        dotsGroup.setAttribute('class', 'oc-snap-dots');
        dotsGroup.setAttribute('pointer-events', 'none');
        clippedGroup.appendChild(dotsGroup);
      }

      svg.appendChild(clippedGroup);

      if (markLabelsOverlay) {
        svg.appendChild(markLabelsOverlay);
      }

      renderAnnotations(svg, layout);
      renderEndpointLabels(svg, layout);

      // Suppress decorative point marks under endpoint markers
      const epEntries = layout.endpointLabels?.entries ?? [];
      if (epEntries.length > 0) {
        const pointEls = clippedGroup.querySelectorAll<SVGCircleElement>('circle.oc-mark-point');
        for (const entry of epEntries) {
          if (!entry.marker) continue;
          const mx = entry.marker.dataX;
          const my = entry.marker.y;
          for (const el of pointEls) {
            const cx = Number(el.getAttribute('cx'));
            const cy = Number(el.getAttribute('cy'));
            if (Math.abs(cx - mx) < 0.5 && Math.abs(cy - my) < 0.5) {
              el.setAttribute('opacity', '0');
            }
          }
        }
      }
    }

    renderLegend(svg, layout.legend);

    // Chrome renders on top so titles are never obscured by chart elements
    renderChrome(svg, layout);
    renderMetrics(svg, layout);

    // Brand renders as a footer item, right-aligned on the source/footer row.
    // Suppressed when the spec supplies a custom chrome.brand so the two
    // brand blocks don't stack.
    if (layout.watermark && !layout.chrome.brand) {
      renderBrand(svg, layout);
    }
  } finally {
    resetMarkRenderState();
  }

  container.appendChild(svg);
  return svg;
}

function renderFacetedPanels(
  svg: SVGElement,
  layout: ChartLayout,
  panels: FacetPanelLayout[],
  defs: SVGElement,
): void {
  for (const panel of panels) {
    const g = createSVGElement('g');
    g.setAttribute('class', 'oc-facet-panel');
    g.setAttribute('data-facet', panel.key);

    // Panel background for visual grouping
    const bg = createSVGElement('rect');
    setAttrs(bg, {
      x: panel.area.x,
      y: panel.header.y - panel.header.fontSize * 0.6,
      width: panel.area.width,
      height: panel.area.height + panel.header.fontSize + 4,
      rx: 3,
      fill: layout.theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    });
    g.appendChild(bg);

    // Panel header label
    const headerText = createSVGElement('text');
    setAttrs(headerText, {
      x: panel.header.x,
      y: panel.header.y,
      'text-anchor': 'middle',
      'font-family': layout.theme.fonts.family,
      'font-size': panel.header.fontSize,
      'font-weight': panel.header.fontWeight,
      fill: layout.theme.colors.text,
    });
    headerText.textContent = panel.header.text;
    g.appendChild(headerText);

    // Build a per-panel synthetic layout for the existing renderers
    const panelLayout: ChartLayout = {
      ...layout,
      area: panel.area,
      axes: panel.axes,
      marks: panel.marks,
      annotations: panel.annotations,
    };

    // Panel axes (ticks already suppressed for inner panels by the engine)
    renderAxes(g, panelLayout);

    // Panel clip path
    const panelClipId = nextSvgId('oc-facet-clip');
    const clipPath = createSVGElement('clipPath');
    clipPath.setAttribute('id', panelClipId);
    const clipRect = createSVGElement('rect');
    setAttrs(clipRect, {
      x: panel.area.x,
      y: panel.area.y,
      width: panel.area.width,
      height: panel.area.height,
    });
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    // Panel marks (clipped)
    const clippedGroup = createSVGElement('g');
    clippedGroup.setAttribute('clip-path', `url(#${panelClipId})`);
    const panelLabelsOverlay = renderMarks(clippedGroup, panelLayout);
    g.appendChild(clippedGroup);

    if (panelLabelsOverlay) {
      g.appendChild(panelLabelsOverlay);
    }

    // Panel annotations
    renderAnnotations(g, panelLayout);

    svg.appendChild(g);
  }
}
