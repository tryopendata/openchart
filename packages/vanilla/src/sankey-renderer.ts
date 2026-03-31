/**
 * Sankey SVG renderer: converts a SankeyLayout into SVG DOM elements.
 *
 * Creates an <svg> with gradient defs, links (behind), nodes, labels,
 * legend, and chrome. All styling via inline SVG attributes from layout data.
 * Animation is pure CSS, driven by data attributes and CSS custom properties.
 */

import type {
  LegendLayout,
  ResolvedAnimation,
  ResolvedChromeElement,
  SankeyLayout,
  SankeyLinkMark,
  SankeyNodeMark,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { BRAND_FONT_SIZE, BRAND_MIN_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const BRAND_URL = 'https://tryopendata.ai';

/** CSS easing preset map for inline style custom properties. */
const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

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

function applyTextStyle(el: SVGElement, style: TextStyle): void {
  setAttrs(el, {
    'font-family': style.fontFamily,
    'font-size': style.fontSize,
    'font-weight': style.fontWeight,
  });
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', style.fill);
  if (style.textAnchor) {
    el.setAttribute('text-anchor', style.textAnchor);
  }
  if (style.dominantBaseline) {
    el.setAttribute('dominant-baseline', style.dominantBaseline);
  }
  if (style.fontVariant) {
    el.setAttribute('font-variant', style.fontVariant);
  }
}

/**
 * Stamp animation index attributes on a mark element when animation is enabled.
 */
function stampAnimationAttrs(
  el: SVGElement,
  mark: { animationIndex?: number },
  fallbackIndex: number,
  animation?: ResolvedAnimation,
): void {
  if (!animation?.enabled) return;
  const idx = mark.animationIndex ?? fallbackIndex;
  el.setAttribute('data-animation-index', String(idx));
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('--oc-mark-index', String(idx));
}

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

/**
 * Break text into lines that fit within maxWidth using word wrapping.
 */
function wrapText(text: string, fontSize: number, fontWeight: number, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];

  const AVG_CHAR_WIDTH = 0.55;
  const WEIGHT_FACTORS: Record<number, number> = {
    100: 0.9,
    200: 0.92,
    300: 0.95,
    400: 1.0,
    500: 1.02,
    600: 1.05,
    700: 1.08,
    800: 1.1,
    900: 1.12,
  };
  const weightFactor = WEIGHT_FACTORS[fontWeight] ?? 1.0;
  const charWidth = fontSize * AVG_CHAR_WIDTH * weightFactor;
  const maxChars = Math.floor(maxWidth / charWidth);

  if (text.length <= maxChars) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

function renderChromeElement(
  parent: SVGElement,
  element: ResolvedChromeElement,
  className: string,
  chromeKey: string,
): void {
  const text = createSVGElement('text');
  setAttrs(text, { x: element.x, y: element.y });
  applyTextStyle(text, element.style);
  text.setAttribute('class', className);
  text.setAttribute('data-chrome-key', chromeKey);

  const lines = wrapText(
    element.text,
    element.style.fontSize,
    element.style.fontWeight,
    element.maxWidth,
  );

  if (lines.length === 1) {
    text.textContent = element.text;
  } else {
    const lineHeight = element.style.fontSize * (element.style.lineHeight ?? 1.3);
    for (let i = 0; i < lines.length; i++) {
      const tspan = createSVGElement('tspan');
      setAttrs(tspan, { x: element.x, dy: i === 0 ? 0 : lineHeight });
      tspan.textContent = lines[i];
      text.appendChild(tspan);
    }
  }

  parent.appendChild(text);
}

function renderChrome(parent: SVGElement, layout: SankeyLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome } = layout;

  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title');
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle');
  }

  // Bottom chrome: positioned below the sankey drawing area.
  // Sankey has no x-axis, so no extra axis extent to account for.
  const bottomOffset = layout.area.y + layout.area.height;
  if (chrome.source) {
    renderChromeElement(
      g,
      { ...chrome.source, y: bottomOffset + chrome.source.y },
      'oc-source',
      'source',
    );
  }
  if (chrome.byline) {
    renderChromeElement(
      g,
      { ...chrome.byline, y: bottomOffset + chrome.byline.y },
      'oc-byline',
      'byline',
    );
  }
  if (chrome.footer) {
    renderChromeElement(
      g,
      { ...chrome.footer, y: bottomOffset + chrome.footer.y },
      'oc-footer',
      'footer',
    );
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Brand rendering
// ---------------------------------------------------------------------------

function renderBrand(parent: SVGElement, layout: SankeyLayout): void {
  if (layout.dimensions.width < BRAND_MIN_WIDTH) return;

  const { width } = layout.dimensions;
  const padding = layout.theme.spacing.padding;
  const rightEdge = width - padding;
  const fill = layout.theme.colors.axis;

  const bottomOffset = layout.area.y + layout.area.height;
  const { chrome } = layout;
  const firstBottom = chrome.source ?? chrome.byline ?? chrome.footer;
  const chromeY = firstBottom
    ? bottomOffset + firstBottom.y
    : bottomOffset + layout.theme.spacing.chartToFooter;

  const a = createSVGElement('a');
  a.setAttribute('href', BRAND_URL);
  a.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
  a.setAttribute('class', 'oc-chrome-ref');

  const BRAND_LARGE = 16;
  const text = createSVGElement('text');
  setAttrs(text, {
    x: rightEdge,
    y: chromeY + BRAND_LARGE,
    'dominant-baseline': 'alphabetic',
    'text-anchor': 'end',
    'font-family': layout.theme.fonts.family,
    'font-size': BRAND_FONT_SIZE,
    'fill-opacity': 0.55,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', fill);

  const trySpan = createSVGElement('tspan');
  setAttrs(trySpan, { 'font-weight': 500 });
  trySpan.textContent = 'try';

  const openDataSpan = createSVGElement('tspan');
  setAttrs(openDataSpan, { 'font-weight': 600, 'font-size': BRAND_LARGE });
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
// Legend rendering
// ---------------------------------------------------------------------------

function renderLegend(parent: SVGElement, legend: LegendLayout): void {
  if (legend.entries.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend');
  g.setAttribute('role', 'list');
  g.setAttribute('aria-label', 'Chart legend');

  const isHorizontal = legend.position === 'top' || legend.position === 'bottom';
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];

    // Wrap to next line if this entry would overflow bounds
    if (isHorizontal && i > 0) {
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      if (offsetX + entryWidth > legend.bounds.x + legend.bounds.width) {
        offsetX = legend.bounds.x;
        offsetY += legend.swatchSize + 6;
      }
    }

    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'oc-legend-entry');
    entryG.setAttribute('role', 'listitem');
    entryG.setAttribute('data-legend-index', String(i));
    entryG.setAttribute('data-legend-label', entry.label);

    if (entry.overflow) {
      entryG.setAttribute('data-legend-overflow', 'true');
      entryG.setAttribute('aria-label', entry.label);
      entryG.setAttribute('opacity', '0.5');
    } else {
      entryG.setAttribute(
        'aria-label',
        `${entry.label}: ${entry.active !== false ? 'visible' : 'hidden'}`,
      );
      entryG.setAttribute('style', 'cursor: pointer');
      if (entry.active === false) {
        entryG.setAttribute('opacity', '0.3');
      }
    }

    // Swatch (always rect for sankey)
    const rect = createSVGElement('rect');
    setAttrs(rect, {
      x: offsetX,
      y: offsetY,
      width: legend.swatchSize,
      height: legend.swatchSize,
      fill: entry.color,
      rx: 2,
    });
    entryG.appendChild(rect);

    // Label
    const label = createSVGElement('text');
    setAttrs(label, {
      x: offsetX + legend.swatchSize + legend.swatchGap,
      y: offsetY + legend.swatchSize / 2,
      'dominant-baseline': 'central',
    });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = entry.label;
    entryG.appendChild(label);

    g.appendChild(entryG);

    // Advance position for next entry
    if (isHorizontal) {
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      offsetX += entryWidth;
    } else {
      offsetY += legend.swatchSize + legend.entryGap;
    }
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Gradient defs
// ---------------------------------------------------------------------------

/**
 * Build a node position lookup for gradient x1/x2 coordinates.
 * Maps nodeId to { x, width } so we can compute gradient endpoints.
 */
function buildNodePositionMap(nodes: SankeyNodeMark[]): Map<string, { x: number; width: number }> {
  const map = new Map<string, { x: number; width: number }>();
  for (const node of nodes) {
    map.set(node.nodeId, { x: node.x, width: node.width });
  }
  return map;
}

/** Sanitize a string for use as an SVG element ID (no spaces, $, or other invalid chars). */
function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function renderGradientDefs(
  defs: SVGElement,
  links: SankeyLinkMark[],
  nodePositions: Map<string, { x: number; width: number }>,
): void {
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    // Only create gradients when source and target colors differ
    if (link.sourceColor === link.targetColor) continue;

    // Use sanitized node names for debuggability, with index suffix for uniqueness
    const gradId = `oc-sg-${sanitizeId(link.sourceId)}-${sanitizeId(link.targetId)}-${i}`;
    const gradient = createSVGElement('linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

    // x1 = right edge of source node, x2 = left edge of target node
    const sourcePos = nodePositions.get(link.sourceId);
    const targetPos = nodePositions.get(link.targetId);
    const x1 = sourcePos ? sourcePos.x + sourcePos.width : 0;
    const x2 = targetPos ? targetPos.x : 0;

    gradient.setAttribute('x1', String(x1));
    gradient.setAttribute('x2', String(x2));

    const stop0 = createSVGElement('stop');
    setAttrs(stop0, { offset: '0%', 'stop-color': link.sourceColor });
    gradient.appendChild(stop0);

    const stop1 = createSVGElement('stop');
    setAttrs(stop1, { offset: '100%', 'stop-color': link.targetColor });
    gradient.appendChild(stop1);

    defs.appendChild(gradient);
  }
}

// ---------------------------------------------------------------------------
// Links rendering
// ---------------------------------------------------------------------------

function renderLinks(
  parent: SVGElement,
  links: SankeyLinkMark[],
  _nodePositions: Map<string, { x: number; width: number }>,
  animation?: ResolvedAnimation,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-sankey-links');

  for (let i = 0; i < links.length; i++) {
    const link = links[i];

    const linkG = createSVGElement('g');
    linkG.setAttribute('class', 'oc-sankey-link');
    linkG.setAttribute('data-mark-id', `link-${link.sourceId}-${link.targetId}`);
    linkG.setAttribute('data-source', link.sourceId);
    linkG.setAttribute('data-target', link.targetId);

    if (link.aria?.label) {
      linkG.setAttribute('aria-label', link.aria.label);
    }

    stampAnimationAttrs(linkG, link, i, animation);

    const path = createSVGElement('path');
    path.setAttribute('d', link.path);
    path.setAttribute('stroke', 'none');
    path.setAttribute('fill-opacity', String(link.fillOpacity));

    // Use gradient fill when colors differ, otherwise solid fill
    if (link.sourceColor !== link.targetColor) {
      const gradId = `oc-sg-${sanitizeId(link.sourceId)}-${sanitizeId(link.targetId)}-${i}`;
      path.setAttribute('fill', `url(#${gradId})`);
    } else {
      path.setAttribute('fill', link.sourceColor);
    }

    linkG.appendChild(path);
    g.appendChild(linkG);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Nodes rendering
// ---------------------------------------------------------------------------

function renderNodes(
  parent: SVGElement,
  nodes: SankeyNodeMark[],
  animation?: ResolvedAnimation,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-sankey-nodes');

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    const nodeG = createSVGElement('g');
    nodeG.setAttribute('class', 'oc-sankey-node');
    nodeG.setAttribute('data-mark-id', `node-${node.nodeId}`);
    nodeG.setAttribute('data-node-id', node.nodeId);

    if (node.aria?.label) {
      nodeG.setAttribute('aria-label', node.aria.label);
    }

    stampAnimationAttrs(nodeG, node, i, animation);

    const rect = createSVGElement('rect');
    setAttrs(rect, {
      x: node.x,
      y: node.y,
      width: node.width,
      height: Math.max(node.height, 1), // Ensure at least 1px visibility
      fill: node.fill,
      rx: node.cornerRadius,
    });

    if (node.stroke) {
      rect.setAttribute('stroke', node.stroke);
    }
    if (node.strokeWidth) {
      rect.setAttribute('stroke-width', String(node.strokeWidth));
    }

    nodeG.appendChild(rect);
    g.appendChild(nodeG);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Labels rendering
// ---------------------------------------------------------------------------

function renderLabels(parent: SVGElement, nodes: SankeyNodeMark[]): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-sankey-labels');

  for (const node of nodes) {
    const { label } = node;
    if (!label.visible) continue;

    const text = createSVGElement('text');
    setAttrs(text, { x: label.x, y: label.y });
    applyTextStyle(text, label.style);
    text.textContent = label.text;

    g.appendChild(text);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a SankeyLayout into an SVG element.
 *
 * The SVG structure is: background > defs (gradients) > links > nodes > labels > legend > chrome > brand.
 * Links render before nodes so they appear visually behind.
 */
export function renderSankeySVG(
  layout: SankeyLayout,
  animation?: ResolvedAnimation,
): SVGSVGElement {
  const { width, height } = layout.dimensions;

  const svg = createSVGElement('svg') as SVGSVGElement;
  setAttrs(svg, {
    viewBox: `0 0 ${width} ${height}`,
    xmlns: SVG_NS,
    overflow: 'visible',
  });
  svg.style.height = `${height}px`;
  svg.setAttribute('role', layout.a11y.role);
  svg.setAttribute('aria-label', layout.a11y.altText);

  // Classes: oc-chart oc-sankey, plus oc-animate if animated
  const animate = animation?.enabled;
  const classes = animate ? 'oc-chart oc-sankey oc-animate' : 'oc-chart oc-sankey';
  svg.setAttribute('class', classes);

  // Set animation CSS custom properties when enabled
  if (animation?.enabled) {
    const totalMarks = layout.nodes.length + layout.links.length;
    const stagger = clampStaggerDelay(animation.staggerDelay, totalMarks);
    svg.style.setProperty('--oc-animation-duration', `${animation.duration}ms`);
    svg.style.setProperty('--oc-animation-stagger', `${stagger}ms`);
    svg.style.setProperty('--oc-annotation-delay', `${animation.annotationDelay}ms`);
    const easeVar = EASE_VAR_MAP[animation.ease] || EASE_VAR_MAP.smooth;
    svg.style.setProperty('--oc-animation-ease', easeVar);
  }

  // Background
  const bg = createSVGElement('rect');
  bg.setAttribute('class', 'oc-background');
  setAttrs(bg, {
    x: 0,
    y: 0,
    width,
    height,
    fill: layout.theme.colors.background,
  });
  svg.appendChild(bg);

  // Defs: gradient definitions for links
  const nodePositions = buildNodePositionMap(layout.nodes);
  const defs = createSVGElement('defs');
  renderGradientDefs(defs, layout.links, nodePositions);
  svg.appendChild(defs);

  // Links (behind nodes)
  renderLinks(svg, layout.links, nodePositions, animation);

  // Nodes
  renderNodes(svg, layout.nodes, animation);

  // Labels
  renderLabels(svg, layout.nodes);

  // Legend
  renderLegend(svg, layout.legend);

  // Chrome (title, subtitle, source, byline, footer) renders on top
  renderChrome(svg, layout);

  // Brand
  renderBrand(svg, layout);

  return svg;
}
