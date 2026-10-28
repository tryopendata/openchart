import { cameraForTarget } from './map-camera';
import { renderStaticGeoColorKeys } from './map-color-key';
import {
  describeGeoLabelInventory,
  renderGeoLabelOverlay,
  resolveMapLabelOverlay,
} from './map-labels';
import { renderGeoMapViews } from './map-view-renderer';
import { createRenderContext, type RenderContext } from './render-context';
import { createSVGElement } from './renderers/svg-dom';
/**
 * Map SVG renderer: converts a GeoMapLayout into SVG DOM elements.
 *
 * Creates an <svg> with geo feature paths, border overlays, gradient or
 * categorical legend, and chrome. All styling via inline SVG attributes from
 * layout data. Animation is pure CSS, driven by data attributes.
 */

import type {
  GeoMapBorders,
  GeoMapFeatureMark,
  GeoMapLayout,
  GeoMapPointMark,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';
import { stampAnimationVars } from './animation-vars';
import { FOCUS_DIM_OPACITY } from './map-camera';
import { buildPatternDefs, resolvePatternFill } from './pattern-utils';
import { renderAttributionBrand } from './renderers/brand';
import { renderChromeElement } from './renderers/chrome';
import { renderLegend } from './renderers/legend';
import { resolvedSurface, stampThemeProperties } from './theme-tokens';

// Above this count, skip per-feature CSS fill animations (not GPU-compositable)
// and fade the entire features group with a single opacity animation instead.
const BULK_ANIMATION_THRESHOLD = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Opacity of the legend backdrops that float over map geography. */
const LEGEND_BACKDROP_ALPHA = 0.5;

/**
 * The theme's own surface, at legend-backdrop alpha.
 *
 * The overlay legends sit on top of geography, so they need a scrim rather than
 * a solid fill. Hardcoding zinc-950/white here pinned both backdrops to the
 * default theme; a warm or branded surface got a grey card over it.
 */
function legendBackdrop(theme: GeoMapLayout['theme']): string {
  const surface = resolvedSurface(theme).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(surface);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${LEGEND_BACKDROP_ALPHA})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(surface);
  if (rgb) {
    return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${LEGEND_BACKDROP_ALPHA})`;
  }
  // Named colors and anything else: no way to add alpha, so paint it opaque.
  return surface;
}

function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

// ---------------------------------------------------------------------------
// Chrome rendering (delegates to the shared helper for text wrapping)
// ---------------------------------------------------------------------------

function renderChrome(
  parent: SVGElement,
  layout: GeoMapLayout,
  ctx: RenderContext = createRenderContext(),
): void {
  const g = createSVGElement('g', ctx.factory);
  g.setAttribute('class', 'oc-chrome');

  const { chrome, measureText } = layout;
  const bottomOffset = chrome.bottomAnchorY ?? layout.area.y + layout.area.height;

  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title', measureText, undefined, ctx);
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle', measureText, undefined, ctx);
  }
  if (chrome.source) {
    renderChromeElement(
      g,
      { ...chrome.source, y: bottomOffset + chrome.source.y },
      'oc-source',
      'source',
      measureText,
      undefined,
      ctx,
    );
  }
  if (chrome.byline) {
    renderChromeElement(
      g,
      { ...chrome.byline, y: bottomOffset + chrome.byline.y },
      'oc-byline',
      'byline',
      measureText,
      undefined,
      ctx,
    );
  }
  if (chrome.footer) {
    renderChromeElement(
      g,
      { ...chrome.footer, y: bottomOffset + chrome.footer.y },
      'oc-footer',
      'footer',
      measureText,
      undefined,
      ctx,
    );
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Watermark rendering
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Border rendering
// ---------------------------------------------------------------------------

function renderBorders(
  parent: SVGElement,
  borders: GeoMapBorders,
  ctx: RenderContext = createRenderContext(),
): void {
  const g = createSVGElement('g', ctx.factory);
  g.setAttribute('class', 'oc-map-borders');

  // Interior borders (between features)
  if (borders.interiorPath) {
    const interior = createSVGElement('path', ctx.factory);
    setAttrs(interior, {
      d: borders.interiorPath,
      fill: 'none',
      stroke: borders.interiorStroke,
      'stroke-width': borders.interiorWidth,
      'stroke-linejoin': 'round',
    });
    interior.setAttribute('class', 'oc-map-border-interior');
    interior.setAttribute('pointer-events', 'none');
    g.appendChild(interior);
  }

  // Outline border (coastline / outer boundary)
  if (borders.outlinePath) {
    const outline = createSVGElement('path', ctx.factory);
    setAttrs(outline, {
      d: borders.outlinePath,
      fill: 'none',
      stroke: borders.outlineStroke,
      'stroke-width': borders.outlineWidth,
      'stroke-linejoin': 'round',
    });
    outline.setAttribute('class', 'oc-map-border-outline');
    outline.setAttribute('pointer-events', 'none');
    g.appendChild(outline);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Feature rendering
// ---------------------------------------------------------------------------

function renderFeatures(
  parent: SVGElement,
  features: GeoMapFeatureMark[],
  animation?: ResolvedAnimation,
  staggerBudget = 0,
  focusIds?: Set<string>,
  patternMap?: Map<string, string>,
  ctx: RenderContext = createRenderContext(),
): void {
  const g = createSVGElement('g', ctx.factory);
  g.setAttribute('class', 'oc-map-features');
  g.setAttribute('role', 'list');

  const bulk = features.length > BULK_ANIMATION_THRESHOLD;

  if (bulk && animation?.enter) {
    g.setAttribute('data-bulk-animate', '');
  }

  const maxIdx = features.length - 1;

  // Build evenly spaced delays then shuffle for organic pop-in
  // (skipped in bulk mode where the whole group fades as one)
  const shuffledDelays: number[] = [];
  if (!bulk && staggerBudget > 0 && maxIdx > 0) {
    for (let i = 0; i <= maxIdx; i++) {
      shuffledDelays.push((i / maxIdx) * staggerBudget);
    }
    // Seeded Fisher-Yates shuffle (deterministic per-map via first feature id)
    let seed = 0x9e3779b9 ^ (features.length * 2654435761);
    for (let i = maxIdx; i > 0; i--) {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed ^ (seed >>> 15);
      t = Math.imul(t, t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) % (i + 1);
      [shuffledDelays[i], shuffledDelays[r]] = [shuffledDelays[r], shuffledDelays[i]];
    }
  }

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const path = createSVGElement('path', ctx.factory);
    path.setAttribute('class', 'oc-map-feature');
    path.setAttribute('role', 'listitem');
    // No-data features carry a hatch pattern so they never read as a class of
    // the ramp (redBlue's middle class is near the neutral gray).
    const fill =
      feature.pattern && patternMap
        ? resolvePatternFill(feature.pattern, patternMap)
        : feature.fill;
    setAttrs(path, {
      d: feature.path,
      fill,
      stroke: feature.stroke,
      'stroke-width': feature.strokeWidth,
    });
    path.setAttribute('data-feature-id', String(feature.id));
    if (feature.noData) {
      path.setAttribute('data-nodata', 'true');
    }
    path.setAttribute('data-key', String(feature.id));
    // The class this feature's value fell in. Hovering a legend swatch dims
    // every feature whose index does not match (CSS in interaction.css).
    if (feature.binIndex !== undefined) {
      path.setAttribute('data-bin-index', String(feature.binIndex));
    }
    if (feature.name) {
      path.setAttribute('data-feature-name', feature.name);
    }
    if (feature.aria?.label) {
      path.setAttribute('aria-label', feature.aria.label);
    }

    // Under a focus, features outside the set rest at the dim opacity. Set it
    // as the resting inline opacity (correct in every render path) and as the
    // entrance animation's target so they fade straight to dim instead of
    // hitting full opacity and snapping down when the dim lands post-animation.
    const dimmed = focusIds ? !focusIds.has(String(feature.id)) : false;
    const s = (path as SVGElement & ElementCSSInlineStyle).style;
    if (dimmed) {
      s.setProperty('opacity', String(FOCUS_DIM_OPACITY));
    }

    // Per-feature animation props only in non-bulk mode
    if (!bulk && animation?.enter) {
      const idx = feature.animationIndex ?? i;
      path.setAttribute('data-animation-index', String(idx));
      s.setProperty('--oc-mark-index', String(idx));
      // Non-interpolable for hatched features; see oc-enter-map-fill in
      // packages/core/src/styles/keyframes.css.
      s.setProperty('--oc-feature-fill', fill);
      if (dimmed) {
        s.setProperty('--oc-feature-target-opacity', String(FOCUS_DIM_OPACITY));
      }
      if (staggerBudget > 0 && maxIdx > 0) {
        s.setProperty('--oc-map-delay', `${shuffledDelays[i]}ms`);
      }
    }

    g.appendChild(path);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Point mark rendering
// ---------------------------------------------------------------------------

function renderPointMarks(
  parent: SVGElement,
  points: GeoMapPointMark[],
  animation?: ResolvedAnimation,
  ctx: RenderContext = createRenderContext(),
): void {
  if (points.length === 0) return;

  const g = createSVGElement('g', ctx.factory);
  g.setAttribute('class', 'oc-map-points');

  for (const pt of points) {
    const circle = createSVGElement('circle', ctx.factory);
    circle.setAttribute('class', 'oc-map-point');
    setAttrs(circle, {
      cx: pt.cx,
      cy: pt.cy,
      r: pt.r,
      fill: pt.fill,
      'fill-opacity': pt.fillOpacity,
      stroke: pt.stroke,
      'stroke-width': pt.strokeWidth,
    });
    circle.setAttribute('data-point-key', pt.key);
    circle.setAttribute('data-base-r', String(pt.r));
    circle.setAttribute('data-base-stroke-width', String(pt.strokeWidth));
    if (pt.aria?.label) {
      circle.setAttribute('aria-label', pt.aria.label);
    }
    if (animation?.enter) {
      const s = circle.style;
      s.setProperty('--oc-mark-index', String(pt.animationIndex));
      s.setProperty('transform-origin', `${pt.cx}px ${pt.cy}px`);
    }
    g.appendChild(circle);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a GeoMapLayout to an SVG element.
 */
export function renderMapSVG(
  layout: GeoMapLayout,
  opts?: { animate?: boolean; context?: RenderContext },
): SVGSVGElement {
  const ctx = opts?.context ?? createRenderContext();
  const { width, height, features, borders, a11y, animation } = layout;
  const animate = opts?.animate && !!animation?.enter;

  const svg = createSVGElement('svg', ctx.factory) as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  if (a11y.altText) {
    svg.setAttribute('aria-label', a11y.altText);
  }

  const classes = animate ? 'oc-map oc-animate' : 'oc-map';
  svg.setAttribute('class', classes);
  stampThemeProperties(svg, layout.theme);

  // Export must carry the same authored surface as the embedded map.
  const background = createSVGElement('rect', ctx.factory);
  setAttrs(background, {
    width,
    height,
    fill: layout.theme.colors.background,
    'aria-hidden': 'true',
  });
  svg.appendChild(background);

  const bulk = features.length > BULK_ANIMATION_THRESHOLD;
  let mapStaggerBudget = 0;
  if (animate && animation?.enter) {
    const dur = animation.enter.duration;
    const perFeature = Math.min(dur, 500);
    if (!bulk) {
      mapStaggerBudget = Math.round(dur * 1.2);
    }
    const n = Math.max(features.length, 1);
    const stagger = !bulk && n > 1 ? mapStaggerBudget / (n - 1) : 0;
    stampAnimationVars(svg, {
      duration: perFeature,
      spring: animation.enter.spring,
      stagger,
      annotationDelay: animation.annotationDelay,
      ease: animation.enter.ease,
    });
  }

  // Empty defs element (will be filled by gradient legend)
  const defs = createSVGElement('defs', ctx.factory);
  svg.appendChild(defs);

  // One <pattern> per unique hatch, shared by every no-data feature and the
  // legend's no-data swatch (the legend entry carries the same pattern object,
  // so buildPatternDefs dedups them onto a single def).
  const noDataSwatch = layout.continuousLegend?.noData ?? layout.categoricalLegend?.noData;
  const patternMap = buildPatternDefs(
    noDataSwatch ? [...features, noDataSwatch] : features,
    defs,
    ctx,
  );

  if (layout.views) {
    renderGeoMapViews(
      svg,
      layout,
      patternMap,
      {
        features: (parent, marks, patterns) =>
          renderFeatures(parent, marks, undefined, 0, undefined, patterns, ctx),
        borders: (parent, borders) => renderBorders(parent, borders, ctx),
        points: (parent, marks) => renderPointMarks(parent, marks, undefined, ctx),
      },
      ctx,
    );
  } else {
    // Create map group offset to the drawing area
    const mapGroup = createSVGElement('g', ctx.factory);
    mapGroup.setAttribute('class', 'oc-map-group');
    mapGroup.setAttribute('transform', `translate(${layout.area.x},${layout.area.y})`);
    // Side gutters are outside the camera viewport, including authored focus/zoom.
    const hasSideGutter = [
      layout.continuousLegend,
      layout.categoricalLegend,
      layout.pointContinuousLegend,
      layout.pointCategoricalLegend,
      layout.pointSizeLegend,
    ].some(
      (legend) =>
        legend?.position === 'right' ||
        (legend?.position === 'bottom-right' &&
          legend.bounds.x >= layout.area.x + layout.area.width),
    );
    if (hasSideGutter) {
      const clipId = ctx.ids.next('oc-map-viewport');
      const clip = createSVGElement('clipPath', ctx.factory);
      clip.setAttribute('id', clipId);
      const rect = createSVGElement('rect', ctx.factory);
      setAttrs(rect, { x: 0, y: 0, width: layout.area.width, height: layout.area.height });
      clip.appendChild(rect);
      defs.appendChild(clip);
      mapGroup.setAttribute('clip-path', `url(#${clipId})`);
    }

    // Camera group wraps features + borders only (chrome, legend, watermark stay outside)
    const cameraGroup = createSVGElement('g', ctx.factory);
    cameraGroup.setAttribute('class', 'oc-map-camera');
    cameraGroup.setAttribute('data-oc-map-camera', '');

    // Features outside the focus set rest dimmed; the renderer stamps that so it's
    // correct in every render path and the entrance fades straight to it. This
    // handles *declarative* focus (layout.focus from the spec) only. Imperative
    // focus set via zoomTo()/panTo() never re-renders, so it dims through
    // applyMapCamera + applyFocusDim on the live SVG instead.
    const focusIdSet =
      layout.focus && layout.focus.ids.length > 0
        ? new Set(layout.focus.ids.map(String))
        : undefined;

    // Render features first (so borders overlay them)
    renderFeatures(
      cameraGroup,
      features,
      animate ? animation : undefined,
      mapStaggerBudget,
      focusIdSet,
      patternMap,
      ctx,
    );

    // Render borders on top of features
    renderBorders(cameraGroup, borders, ctx);

    // Render point marks inside camera group (above borders).
    // Stamp a per-point stagger so the total spread stays bounded regardless of
    // point count (the CSS hardcoded 60ms per point which explodes past ~15 pts).
    if (animate && animation?.enter && layout.pointMarks.length > 1) {
      const pointStaggerBudget = animation.enter.duration * 0.5;
      const perPoint = pointStaggerBudget / (layout.pointMarks.length - 1);
      svg.style.setProperty('--oc-point-stagger', `${perPoint}ms`);
    }
    renderPointMarks(cameraGroup, layout.pointMarks, animate ? animation : undefined, ctx);

    mapGroup.appendChild(cameraGroup);
    svg.appendChild(mapGroup);
  }

  // Render chrome AFTER the map group so the title/subtitle paint on top of a
  // focus-zoomed map that overflows up into the chrome band. Earlier SVG
  // children paint underneath later ones, so chrome must come last of the two.
  renderChrome(svg, layout, ctx);

  // Render legend (continuous for quantitative, categorical for nominal)
  if (layout.continuousLegend) {
    // The swatch fill is a string in the layout, so resolve the hatch to its
    // url(#id) here — the map renderer owns the defs the pattern lives in.
    const contNoData = layout.continuousLegend.noData;
    renderLegend(
      svg,
      contNoData?.pattern
        ? {
            ...layout.continuousLegend,
            noData: { ...contNoData, fill: resolvePatternFill(contNoData.pattern, patternMap) },
          }
        : layout.continuousLegend,
      undefined,
      ctx,
    );
  } else if (layout.categoricalLegend) {
    const catNoData = layout.categoricalLegend.noData;
    renderLegend(
      svg,
      catNoData?.pattern
        ? {
            ...layout.categoricalLegend,
            noData: { ...catNoData, fill: resolvePatternFill(catNoData.pattern, patternMap) },
          }
        : layout.categoricalLegend,
      undefined,
      ctx,
    );
  }

  // Render point legends with a semi-transparent background so they read
  // clearly over map geography (e.g. AK/HI insets in Albers USA).
  const ptLegend = layout.pointCategoricalLegend ?? layout.pointContinuousLegend;
  if (ptLegend) {
    if (ptLegend.position === 'top-left') {
      const bg = createSVGElement('rect', ctx.factory);
      setAttrs(bg, {
        x: ptLegend.bounds.x - 10,
        y: ptLegend.bounds.y - 8,
        width: ptLegend.bounds.width + 20,
        height: ptLegend.bounds.height + 16,
        rx: 4,
        fill: legendBackdrop(layout.theme),
      });
      svg.appendChild(bg);
    }
    renderLegend(svg, ptLegend, undefined, ctx);
  }

  // Point size key: nested circles bottom-right, on the same backdrop treatment
  // as the point color legend so it stays readable over geography.
  if (layout.pointSizeLegend) {
    const sizeLegend = layout.pointSizeLegend;
    const pad = 10;
    const bg = createSVGElement('rect', ctx.factory);
    setAttrs(bg, {
      x: sizeLegend.bounds.x - pad,
      y: sizeLegend.bounds.y - pad,
      width: sizeLegend.bounds.width + pad * 2,
      height: sizeLegend.bounds.height + pad * 2,
      rx: 6,
      fill: legendBackdrop(layout.theme),
    });
    if (
      sizeLegend.bounds.x < layout.area.x + layout.area.width &&
      sizeLegend.bounds.y < layout.area.y + layout.area.height
    )
      svg.appendChild(bg);
    renderLegend(svg, sizeLegend, undefined, ctx);
  }

  // Render watermark
  renderAttributionBrand(
    svg,
    layout.chrome,
    layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height,
    layout.measureText,
    undefined,
    ctx,
  );

  if (layout.labels && !layout.views) {
    const overlay = resolveMapLabelOverlay(layout, cameraForTarget(layout, layout.focus?.target));
    if (overlay) {
      renderGeoLabelOverlay(svg, layout, overlay, ctx);
      describeGeoLabelInventory(svg, overlay, ctx);
    }
  }
  renderStaticGeoColorKeys(svg, layout, ctx);
  return svg;
}
