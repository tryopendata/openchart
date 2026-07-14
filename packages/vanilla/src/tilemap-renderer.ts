/**
 * TileMap SVG renderer: converts a TileMapLayout into SVG DOM elements.
 *
 * Creates an <svg> with tile rectangles, state code labels, value labels,
 * gradient legend, and chrome. All styling via inline SVG attributes from
 * layout data. Animation is pure CSS, driven by data attributes.
 */

import type {
  ResolvedAnimation,
  TileMapLayout,
  TileMapTileMark,
} from '@opendata-ai/openchart-core';
import { stampAnimationVars } from './animation-vars';
import { renderChromeElement } from './renderers/chrome';
import { renderLegend } from './renderers/legend';
import { nextSvgId } from './svg-ids';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const BRAND_URL = 'https://tryopendata.ai';

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

function renderChrome(parent: SVGElement, layout: TileMapLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome, measureText } = layout;
  const bottomOffset = layout.area.y + layout.area.height;

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

function renderWatermark(parent: SVGElement, layout: TileMapLayout): void {
  if (layout.width < 480) return; // Don't render if too narrow

  const { width, height } = layout;
  const { theme } = layout;
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
// Tiles rendering
// ---------------------------------------------------------------------------

function renderTiles(
  parent: SVGElement,
  tiles: TileMapTileMark[],
  animation?: ResolvedAnimation,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-tilemap-tiles');
  g.setAttribute('role', 'list');

  // Compute per-tile delays with jitter for organic feel.
  // Base delay spreads tiles across ~800ms window, jitter adds +-40% variation
  // so some tiles pop in clusters while others have longer gaps.
  const tileDelays: number[] = [];
  if (animation?.enter) {
    const baseStagger = 800 / Math.max(tiles.length, 1);
    let seed = 17;
    for (let i = 0; i < tiles.length; i++) {
      const idx = tiles[i].animationIndex ?? i;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const jitter = ((seed % 1000) / 1000 - 0.5) * 0.8;
      tileDelays.push(Math.max(0, Math.round(idx * baseStagger * (1 + jitter))));
    }
  }

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const tileGroup = createSVGElement('g');
    tileGroup.setAttribute('class', 'oc-tilemap-tile');
    tileGroup.setAttribute('data-state', tile.stateCode);
    tileGroup.setAttribute('role', 'listitem');
    if (tile.aria?.label) {
      tileGroup.setAttribute('aria-label', tile.aria.label);
    }

    if (animation?.enter) {
      const idx = tile.animationIndex ?? i;
      tileGroup.setAttribute('data-animation-index', String(idx));
      (tileGroup as SVGElement & ElementCSSInlineStyle).style.setProperty(
        '--oc-mark-index',
        String(idx),
      );
      (tileGroup as SVGElement & ElementCSSInlineStyle).style.setProperty(
        '--oc-tile-delay',
        `${tileDelays[i]}ms`,
      );
    }

    // Tile background rect
    const rect = createSVGElement('rect');
    setAttrs(rect, {
      x: tile.x,
      y: tile.y,
      width: tile.size,
      height: tile.size,
      rx: tile.cornerRadius,
      fill: tile.fill,
      'fill-opacity': tile.fillOpacity ?? 1,
      stroke: tile.stroke,
      'stroke-width': tile.strokeWidth,
    });
    tileGroup.appendChild(rect);

    // State code label
    const codeLabel = createSVGElement('text');
    setAttrs(codeLabel, {
      x: tile.label.x,
      y: tile.label.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-family': tile.label.style.fontFamily,
      'font-size': tile.label.style.fontSize,
      'font-weight': tile.label.style.fontWeight,
    });
    (codeLabel as SVGElement & ElementCSSInlineStyle).style.setProperty(
      'fill',
      tile.label.style.fill,
    );
    codeLabel.textContent = tile.label.text;
    tileGroup.appendChild(codeLabel);

    // Value label (if visible)
    if (tile.valueLabel.visible && tile.valueLabel.text) {
      const valueLabel = createSVGElement('text');
      setAttrs(valueLabel, {
        x: tile.valueLabel.x,
        y: tile.valueLabel.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-family': tile.valueLabel.style.fontFamily,
        'font-size': tile.valueLabel.style.fontSize,
        'font-weight': tile.valueLabel.style.fontWeight,
      });
      (valueLabel as SVGElement & ElementCSSInlineStyle).style.setProperty(
        'fill',
        tile.valueLabel.style.fill,
      );
      valueLabel.textContent = tile.valueLabel.text;
      tileGroup.appendChild(valueLabel);
    }

    g.appendChild(tileGroup);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Gradient legend rendering
// ---------------------------------------------------------------------------

function renderGradientLegend(parent: SVGElement, layout: TileMapLayout): void {
  if (!layout.gradientLegend) return;

  const { gradientLegend } = layout;
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-tilemap-legend');

  // Build linear gradient in defs
  const defs = parent.querySelector('defs') || createSVGElement('defs');
  const exists = parent.querySelector('defs');
  if (!exists) {
    parent.insertBefore(defs, parent.firstChild);
  }

  const gradientId = nextSvgId('oc-tilemap-legend-gradient');
  const grad = createSVGElement('linearGradient');
  grad.id = gradientId;
  grad.setAttribute('x1', '0%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y2', '0%');

  for (const stop of gradientLegend.colorStops) {
    const s = createSVGElement('stop');
    const attrs: Record<string, string | number> = {
      offset: `${stop.offset * 100}%`,
      'stop-color': stop.color,
    };
    if (stop.opacity !== undefined) {
      attrs['stop-opacity'] = stop.opacity;
    }
    setAttrs(s, attrs);
    grad.appendChild(s);
  }

  (defs as SVGElement).appendChild(grad);

  // Gradient bar (pill-shaped)
  const barHeight = gradientLegend.bounds.height;
  const bar = createSVGElement('rect');
  setAttrs(bar, {
    x: gradientLegend.bounds.x,
    y: gradientLegend.bounds.y,
    width: gradientLegend.bounds.width,
    height: barHeight,
    rx: barHeight / 2,
    fill: `url(#${gradientId})`,
  });
  g.appendChild(bar);

  // Min label
  const minText = createSVGElement('text');
  setAttrs(minText, {
    x: gradientLegend.bounds.x,
    y: gradientLegend.bounds.y + gradientLegend.bounds.height + 14,
    'text-anchor': 'start',
    'font-family': gradientLegend.labelStyle.fontFamily,
    'font-size': gradientLegend.labelStyle.fontSize,
    'font-weight': gradientLegend.labelStyle.fontWeight,
  });
  (minText as SVGElement & ElementCSSInlineStyle).style.setProperty(
    'fill',
    gradientLegend.labelStyle.fill,
  );
  minText.textContent = gradientLegend.minLabel;
  g.appendChild(minText);

  // Max label
  const maxText = createSVGElement('text');
  setAttrs(maxText, {
    x: gradientLegend.bounds.x + gradientLegend.bounds.width,
    y: gradientLegend.bounds.y + gradientLegend.bounds.height + 14,
    'text-anchor': 'end',
    'font-family': gradientLegend.labelStyle.fontFamily,
    'font-size': gradientLegend.labelStyle.fontSize,
    'font-weight': gradientLegend.labelStyle.fontWeight,
  });
  (maxText as SVGElement & ElementCSSInlineStyle).style.setProperty(
    'fill',
    gradientLegend.labelStyle.fill,
  );
  maxText.textContent = gradientLegend.maxLabel;
  g.appendChild(maxText);

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a TileMapLayout to an SVG element.
 */
export function renderTileMapSVG(
  layout: TileMapLayout,
  opts?: { animate?: boolean },
): SVGSVGElement {
  const { width, height, tiles, a11y, watermark, animation } = layout;
  const animate = opts?.animate && !!animation?.enter;

  const svg = createSVGElement('svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  if (a11y.altText) {
    svg.setAttribute('aria-label', a11y.altText);
  }

  const classes = animate ? 'oc-tilemap oc-animate' : 'oc-tilemap';
  svg.setAttribute('class', classes);

  if (animate && animation?.enter) {
    // Target ~1s total: stagger window ~800ms + per-tile pop ~200ms
    const stagger = Math.max(5, Math.round(800 / Math.max(tiles.length, 1)));
    stampAnimationVars(svg, {
      duration: animation.enter.duration,
      stagger,
      annotationDelay: animation.annotationDelay,
      ease: animation.enter.ease,
    });
  }

  // Empty defs element (will be filled by gradient legend)
  const defs = createSVGElement('defs');
  svg.appendChild(defs);

  // Render chrome
  renderChrome(svg, layout);

  // Render tiles
  renderTiles(svg, tiles, animate ? animation : undefined);

  // Render legend (gradient for quantitative, categorical for nominal)
  if (layout.categoricalLegend) {
    renderLegend(svg, layout.categoricalLegend);
  } else {
    renderGradientLegend(svg, layout);
  }

  // Render watermark
  if (watermark) {
    renderWatermark(svg, layout);
  }

  return svg;
}
