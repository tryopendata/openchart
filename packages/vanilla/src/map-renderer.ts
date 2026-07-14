/**
 * Map SVG renderer: converts a MapLayout into SVG DOM elements.
 *
 * Creates an <svg> with geo feature paths, border overlays, gradient or
 * categorical legend, and chrome. All styling via inline SVG attributes from
 * layout data. Animation is pure CSS, driven by data attributes.
 */

import type {
  MapBorders,
  MapFeatureMark,
  MapLayout,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';
import { renderChromeElement } from './renderers/chrome';
import { renderLegend } from './renderers/legend';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const BRAND_URL = 'https://tryopendata.ai';

const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

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

function renderChrome(parent: SVGElement, layout: MapLayout): void {
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

function renderWatermark(parent: SVGElement, layout: MapLayout): void {
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

function renderBorders(parent: SVGElement, borders: MapBorders): void {
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
  features: MapFeatureMark[],
  animation?: ResolvedAnimation,
  staggerBudget = 0,
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

    // Per-feature animation props only in non-bulk mode
    if (!bulk && animation?.enter) {
      const idx = feature.animationIndex ?? i;
      path.setAttribute('data-animation-index', String(idx));
      const s = (path as SVGElement & ElementCSSInlineStyle).style;
      s.setProperty('--oc-mark-index', String(idx));
      s.setProperty('--oc-feature-fill', feature.fill);
      if (staggerBudget > 0 && maxIdx > 0) {
        s.setProperty('--oc-map-delay', `${shuffledDelays[i]}ms`);
      }
    }

    g.appendChild(path);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a MapLayout to an SVG element.
 */
export function renderMapSVG(layout: MapLayout, opts?: { animate?: boolean }): SVGSVGElement {
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
    svg.style.setProperty('--oc-animation-duration', `${perFeature}ms`);
    svg.style.setProperty(
      '--oc-animation-stagger',
      `${!bulk && n > 1 ? mapStaggerBudget / (n - 1) : 0}ms`,
    );
    svg.style.setProperty('--oc-annotation-delay', `${animation.annotationDelay}ms`);
    const easeVar = EASE_VAR_MAP[animation.enter.ease] || EASE_VAR_MAP.smooth;
    svg.style.setProperty('--oc-animation-ease', easeVar);
  }

  // Empty defs element (will be filled by gradient legend)
  const defs = createSVGElement('defs');
  svg.appendChild(defs);

  // Render chrome
  renderChrome(svg, layout);

  // Create map group offset to the drawing area
  const mapGroup = createSVGElement('g');
  mapGroup.setAttribute('class', 'oc-map-group');
  mapGroup.setAttribute('transform', `translate(${layout.area.x},${layout.area.y})`);

  // Camera group wraps features + borders only (chrome, legend, watermark stay outside)
  const cameraGroup = createSVGElement('g');
  cameraGroup.setAttribute('class', 'oc-map-camera');
  cameraGroup.setAttribute('data-oc-map-camera', '');

  // Render features first (so borders overlay them)
  renderFeatures(cameraGroup, features, animate ? animation : undefined, mapStaggerBudget);

  // Render borders on top of features
  renderBorders(cameraGroup, borders);

  mapGroup.appendChild(cameraGroup);
  svg.appendChild(mapGroup);

  // Render legend (continuous for quantitative, categorical for nominal)
  if (layout.continuousLegend) {
    renderLegend(svg, layout.continuousLegend);
  } else if (layout.categoricalLegend) {
    renderLegend(svg, layout.categoricalLegend);
  }

  // Render watermark
  if (watermark) {
    renderWatermark(svg, layout);
  }

  return svg;
}
