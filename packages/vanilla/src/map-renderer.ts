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
import { renderChromeElement } from './renderers/chrome';
import { renderLegend } from './renderers/legend';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const BRAND_URL = 'https://tryopendata.ai';

// Above this count, skip per-feature CSS fill animations (not GPU-compositable)
// and fade the entire features group with a single opacity animation instead.
const BULK_ANIMATION_THRESHOLD = 200;

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

// ---------------------------------------------------------------------------
// Chrome rendering (delegates to the shared helper for text wrapping)
// ---------------------------------------------------------------------------

function renderChrome(parent: SVGElement, layout: GeoMapLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome, measureText } = layout;
  const bottomOffset = chrome.bottomAnchorY ?? layout.area.y + layout.area.height;

  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title', measureText);
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle', measureText);
  }
  if (chrome.source) {
    renderChromeElement(
      g,
      { ...chrome.source, y: bottomOffset + chrome.source.y },
      'oc-source',
      'source',
      measureText,
    );
  }
  if (chrome.byline) {
    renderChromeElement(
      g,
      { ...chrome.byline, y: bottomOffset + chrome.byline.y },
      'oc-byline',
      'byline',
      measureText,
    );
  }
  if (chrome.footer) {
    renderChromeElement(
      g,
      { ...chrome.footer, y: bottomOffset + chrome.footer.y },
      'oc-footer',
      'footer',
      measureText,
    );
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Watermark rendering
// ---------------------------------------------------------------------------

function renderWatermark(parent: SVGElement, layout: GeoMapLayout): void {
  if (layout.width < 480) return;

  const { width, height, theme } = layout;
  const padding = theme.spacing.padding;
  const rightEdge = width - padding;
  const bottomEdge = height - padding;
  const fill = theme.colors.axis;

  const a = createSVGElement('a');
  a.setAttribute('href', BRAND_URL);
  a.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
  a.setAttribute('class', 'oc-chrome-ref');

  const text = createSVGElement('text');
  setAttrs(text, {
    x: rightEdge,
    y: bottomEdge,
    'dominant-baseline': 'alphabetic',
    'text-anchor': 'end',
    'font-family': theme.fonts.family,
    'font-size': 12,
    'fill-opacity': 0.55,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', fill);

  const trySpan = createSVGElement('tspan');
  setAttrs(trySpan, { 'font-weight': 500 });
  trySpan.textContent = 'try';

  const openDataSpan = createSVGElement('tspan');
  setAttrs(openDataSpan, { 'font-weight': 600, 'font-size': 16 });
  openDataSpan.textContent = 'OpenData';

  const aiSpan = createSVGElement('tspan');
  setAttrs(aiSpan, { 'font-weight': 500 });
  aiSpan.textContent = '.ai';

  text.appendChild(trySpan);
  text.appendChild(openDataSpan);
  text.appendChild(aiSpan);
  a.appendChild(text);
  parent.appendChild(a);
}

// ---------------------------------------------------------------------------
// Border rendering
// ---------------------------------------------------------------------------

function renderBorders(parent: SVGElement, borders: GeoMapBorders): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-map-borders');

  // Interior borders (between features)
  if (borders.interiorPath) {
    const interior = createSVGElement('path');
    setAttrs(interior, {
      d: borders.interiorPath,
      fill: 'none',
      stroke: borders.interiorStroke,
      'stroke-width': 0.5,
      'stroke-linejoin': 'round',
    });
    interior.setAttribute('class', 'oc-map-border-interior');
    interior.setAttribute('pointer-events', 'none');
    g.appendChild(interior);
  }

  // Outline border (coastline / outer boundary)
  if (borders.outlinePath) {
    const outline = createSVGElement('path');
    setAttrs(outline, {
      d: borders.outlinePath,
      fill: 'none',
      stroke: borders.outlineStroke,
      'stroke-width': 1,
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
): void {
  const g = createSVGElement('g');
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
    const path = createSVGElement('path');
    path.setAttribute('class', 'oc-map-feature');
    path.setAttribute('role', 'listitem');
    setAttrs(path, {
      d: feature.path,
      fill: feature.fill,
      stroke: feature.stroke,
      'stroke-width': feature.strokeWidth,
    });
    path.setAttribute('data-feature-id', String(feature.id));
    path.setAttribute('data-key', String(feature.id));
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
      s.setProperty('--oc-feature-fill', feature.fill);
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
): void {
  if (points.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-map-points');

  for (const pt of points) {
    const circle = createSVGElement('circle');
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
      const s = (circle as unknown as ElementCSSInlineStyle).style;
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
export function renderMapSVG(layout: GeoMapLayout, opts?: { animate?: boolean }): SVGSVGElement {
  const { width, height, features, borders, a11y, watermark, animation } = layout;
  const animate = opts?.animate && !!animation?.enter;

  const svg = createSVGElement('svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  if (a11y.altText) {
    svg.setAttribute('aria-label', a11y.altText);
  }

  const classes = animate ? 'oc-map oc-animate' : 'oc-map';
  svg.setAttribute('class', classes);

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
      stagger,
      annotationDelay: animation.annotationDelay,
      ease: animation.enter.ease,
    });
  }

  // Empty defs element (will be filled by gradient legend)
  const defs = createSVGElement('defs');
  svg.appendChild(defs);

  // Create map group offset to the drawing area
  const mapGroup = createSVGElement('g');
  mapGroup.setAttribute('class', 'oc-map-group');
  mapGroup.setAttribute('transform', `translate(${layout.area.x},${layout.area.y})`);

  // Camera group wraps features + borders only (chrome, legend, watermark stay outside)
  const cameraGroup = createSVGElement('g');
  cameraGroup.setAttribute('class', 'oc-map-camera');
  cameraGroup.setAttribute('data-oc-map-camera', '');

  // Features outside the focus set rest dimmed; the renderer stamps that so it's
  // correct in every render path and the entrance fades straight to it. This
  // handles *declarative* focus (layout.focus from the spec) only. Imperative
  // focus set via zoomTo()/panTo() never re-renders, so it dims through
  // applyMapCamera + applyFocusDim on the live SVG instead.
  const focusIdSet =
    layout.focus && layout.focus.ids.length > 0 ? new Set(layout.focus.ids.map(String)) : undefined;

  // Render features first (so borders overlay them)
  renderFeatures(
    cameraGroup,
    features,
    animate ? animation : undefined,
    mapStaggerBudget,
    focusIdSet,
  );

  // Render borders on top of features
  renderBorders(cameraGroup, borders);

  // Render point marks inside camera group (above borders).
  // Stamp a per-point stagger so the total spread stays bounded regardless of
  // point count (the CSS hardcoded 60ms per point which explodes past ~15 pts).
  if (animate && animation?.enter && layout.pointMarks.length > 1) {
    const pointStaggerBudget = animation.enter.duration * 0.5;
    const perPoint = pointStaggerBudget / (layout.pointMarks.length - 1);
    svg.style.setProperty('--oc-point-stagger', `${perPoint}ms`);
  }
  renderPointMarks(cameraGroup, layout.pointMarks, animate ? animation : undefined);

  mapGroup.appendChild(cameraGroup);
  svg.appendChild(mapGroup);

  // Render chrome AFTER the map group so the title/subtitle paint on top of a
  // focus-zoomed map that overflows up into the chrome band. Earlier SVG
  // children paint underneath later ones, so chrome must come last of the two.
  renderChrome(svg, layout);

  // Render legend (continuous for quantitative, categorical for nominal)
  if (layout.continuousLegend) {
    renderLegend(svg, layout.continuousLegend);
  } else if (layout.categoricalLegend) {
    renderLegend(svg, layout.categoricalLegend);
  }

  // Render point legends with a semi-transparent background so they read
  // clearly over map geography (e.g. AK/HI insets in Albers USA).
  const ptLegend = layout.pointCategoricalLegend ?? layout.pointContinuousLegend;
  if (ptLegend) {
    const isDark = layout.theme.isDark;
    const padX = 10;
    const padY = 8;

    // Compute content width from entries so the background wraps tightly
    const swatchSize =
      'swatchSize' in ptLegend ? (ptLegend as { swatchSize: number }).swatchSize : 10;
    const swatchGap = 'swatchGap' in ptLegend ? (ptLegend as { swatchGap: number }).swatchGap : 6;
    const entryGap = 'entryGap' in ptLegend ? (ptLegend as { entryGap: number }).entryGap : 16;
    let contentWidth = ptLegend.bounds.width;
    if ('entries' in ptLegend && ptLegend.entries) {
      const cat = ptLegend as typeof layout.pointCategoricalLegend & {
        entries: Array<{ label: string }>;
      };
      if (cat && cat.entries.length > 0) {
        const fontSize = ptLegend.labelStyle.fontSize;
        let w = 0;
        for (const entry of cat.entries) {
          w += swatchSize + swatchGap + entry.label.length * fontSize * 0.6 + entryGap;
        }
        w -= entryGap;
        contentWidth = Math.min(w, ptLegend.bounds.width);
      }
    }

    // Center the background rect vertically around the swatch content.
    // Overlay continuous legends ('top-left') float over map geography, so
    // their backdrop must cover the full bounds (tick labels hang below the
    // bar) instead of just the swatch row. Categorical rows keep the
    // swatch-centered backdrop in both positions.
    const isOverlayContinuous =
      ptLegend.position === 'top-left' && !('entries' in ptLegend && ptLegend.entries);
    const contentCenterY = ptLegend.bounds.y + swatchSize / 2;
    const bgHeight = isOverlayContinuous
      ? ptLegend.bounds.height + padY * 2
      : swatchSize + padY * 2;
    const bgY = isOverlayContinuous ? ptLegend.bounds.y - padY : contentCenterY - bgHeight / 2;
    const bg = createSVGElement('rect');
    setAttrs(bg, {
      x: ptLegend.bounds.x - padX,
      y: bgY,
      width: contentWidth + padX * 2,
      height: bgHeight,
      rx: 4,
      fill: isDark ? 'rgba(24,24,27,0.9)' : 'rgba(255,255,255,0.9)',
    });
    svg.appendChild(bg);
    renderLegend(svg, ptLegend);
  }

  // Render watermark
  if (watermark) {
    renderWatermark(svg, layout);
  }

  return svg;
}
