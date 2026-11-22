import { createRenderContext } from './render-context';
/**
 * Sankey SVG renderer: converts a SankeyLayout into SVG DOM elements.
 *
 * Creates an <svg> with gradient defs, links (behind), nodes, labels,
 * legend, and chrome. All styling via inline SVG attributes from layout data.
 * Animation is pure CSS, driven by data attributes and CSS custom properties.
 */

import type {
  CategoricalLegendLayout,
  LegendLayout,
  MeasureTextFn,
  ResolvedAnimation,
  SankeyLayout,
  SankeyLinkMark,
  SankeyNodeMark,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';
import { stampAnimationVars } from './animation-vars';
import { renderAttributionBrand } from './renderers/brand';
import { renderChromeElement } from './renderers/chrome';
import { applyKnockoutHalo, applyTextStyle } from './renderers/svg-dom';
import { resolvedSurface, stampThemeProperties } from './theme-tokens';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/**
 * Stamp animation index attributes on a mark element when animation is enabled.
 */
function stampAnimationAttrs(
  el: SVGElement,
  mark: { animationIndex?: number },
  fallbackIndex: number,
  animation?: ResolvedAnimation,
): void {
  if (!animation?.enter) return;
  const idx = mark.animationIndex ?? fallbackIndex;
  el.setAttribute('data-animation-index', String(idx));
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('--oc-mark-index', String(idx));
}

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

function renderChrome(parent: SVGElement, layout: SankeyLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome, measureText } = layout;

  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title', measureText);
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle', measureText);
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
// Brand rendering
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Legend rendering
// ---------------------------------------------------------------------------

function renderLegend(parent: SVGElement, legendLayout: LegendLayout): void {
  if (!('entries' in legendLayout) || legendLayout.entries.length === 0) return;
  const legend = legendLayout as CategoricalLegendLayout;

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
  gradientIds: Map<number, string>,
): void {
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    // Only create gradients when source and target colors differ
    if (link.sourceColor === link.targetColor) continue;

    // Use sanitized node names for debuggability, with index suffix for uniqueness
    const gradId = gradientIds.get(i)!;
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
  nodes: SankeyNodeMark[],
  animation: ResolvedAnimation | undefined,
  gradientIds: Map<number, string>,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-sankey-links');
  // A link enters when its source node is halfway in, so it takes that
  // node's stagger slot.
  const nodeIndex = new Map(nodes.map((n, i) => [n.nodeId, n.animationIndex ?? i]));

  for (let i = 0; i < links.length; i++) {
    const link = links[i];

    const linkG = createSVGElement('g');
    linkG.setAttribute('class', 'oc-sankey-link');
    linkG.setAttribute('data-mark-id', `link-${link.sourceId}-${link.targetId}-${i}`);
    linkG.setAttribute('data-source', link.sourceId);
    linkG.setAttribute('data-target', link.targetId);

    if (link.aria?.label) {
      linkG.setAttribute('aria-label', link.aria.label);
    }

    stampAnimationAttrs(
      linkG,
      { animationIndex: nodeIndex.get(link.sourceId) ?? link.animationIndex },
      i,
      animation,
    );

    const path = createSVGElement('path');
    path.setAttribute('d', link.path);
    path.setAttribute('stroke', 'none');
    path.setAttribute('fill-opacity', String(link.fillOpacity));

    // Use gradient fill when colors differ, otherwise solid fill
    if (link.sourceColor !== link.targetColor) {
      const gradId = gradientIds.get(i)!;
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

/** The gap between a node's name and its value on the same line, in px. */
const VALUE_DX = 5;

/** Create a tspan that starts a new line at `x`, `y`. */
function lineSpan(text: string, x: number, y: number): SVGElement {
  const tspan = createSVGElement('tspan');
  tspan.setAttribute('x', String(x));
  tspan.setAttribute('y', String(y));
  tspan.textContent = text;
  return tspan;
}

/** The node's value as a quieter tabular tspan. */
function valueSpan(valueLabel: NonNullable<SankeyNodeMark['valueLabel']>): SVGElement {
  const span = createSVGElement('tspan');
  span.setAttribute('class', 'oc-sankey-label-value');
  applyTextStyle(span, valueLabel.style);
  span.textContent = valueLabel.text;
  return span;
}

/**
 * A label the engine placed on the flow: its wrapped name lines, then the
 * value on its own line, the whole block centred on the label's y.
 */
function fillStackedLabel(text: SVGElement, node: SankeyNodeMark, lines: string[]): void {
  const { label, valueLabel } = node;
  const lineHeight = label.style.fontSize * label.style.lineHeight;
  const lineCount = lines.length + (valueLabel ? 1 : 0);
  const startY = label.y - ((lineCount - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    text.appendChild(lineSpan(line, label.x, startY + i * lineHeight));
  });
  if (valueLabel) {
    const span = valueSpan(valueLabel);
    span.setAttribute('x', String(label.x));
    span.setAttribute('y', String(startY + lines.length * lineHeight));
    text.appendChild(span);
  }
}

/**
 * A label outside the flow (or between columns at wider sizes): the name,
 * wrapped to its room and centred on the label's y, with the value riding the
 * last line. The value carries no x/y, so it stays in the same text chunk and
 * the anchor applies to name and value as one block.
 */
function fillInlineLabel(
  text: SVGElement,
  node: SankeyNodeMark,
  measureText?: MeasureTextFn,
): void {
  const { label, valueLabel } = node;
  const { fontSize, fontWeight } = label.style;
  let lines = [label.text];
  if (label.maxWidth !== undefined && label.maxWidth > 0) {
    lines = wrapText(label.text, fontSize, fontWeight, label.maxWidth, measureText);
  }

  if (lines.length > 1) {
    const lineHeight = fontSize * label.style.lineHeight;
    const startY = label.y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      text.appendChild(lineSpan(line, label.x, startY + i * lineHeight));
    });
  } else if (valueLabel) {
    // The name needs its own tspan, or the value tspan would render before it.
    const nameSpan = createSVGElement('tspan');
    nameSpan.textContent = lines[0];
    text.appendChild(nameSpan);
  } else {
    text.textContent = lines[0];
  }

  if (valueLabel) {
    const span = valueSpan(valueLabel);
    span.setAttribute('dx', String(VALUE_DX));
    text.appendChild(span);
  }
}

/**
 * Draw every visible node label. Whether a node's value is drawn is the
 * engine's call: the renderer draws the value whenever the layout carries one.
 */
function renderLabels(
  parent: SVGElement,
  nodes: SankeyNodeMark[],
  surface: string,
  measureText?: MeasureTextFn,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-sankey-labels');

  for (const node of nodes) {
    const { label } = node;
    if (!label.visible) continue;

    const text = createSVGElement('text');
    setAttrs(text, { x: label.x, y: label.y });
    applyTextStyle(text, label.style);
    // Path highlighting dims labels alongside their node.
    text.setAttribute('class', 'oc-sankey-label');
    text.setAttribute('data-node-id', node.nodeId);
    // Sankey labels carry a halo only where the engine asks for one, on labels
    // placed over the flow. Outside labels sit on the bare background.
    if (label.halo === true) applyKnockoutHalo(text, surface, label.style.fontSize);

    if (label.lines) fillStackedLabel(text, node, label.lines);
    else fillInlineLabel(text, node, measureText);

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
  ctx = createRenderContext(),
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
  const enterPhase = animation?.enter;
  const animate = !!enterPhase;
  const classes = animate ? 'oc-chart oc-sankey oc-animate' : 'oc-chart oc-sankey';
  svg.setAttribute('class', classes);
  stampThemeProperties(svg, layout.theme);

  // Set animation CSS custom properties when the enter phase is enabled
  if (enterPhase) {
    // Links share their source node's slot, so only nodes spread the stagger.
    const stagger = clampStaggerDelay(enterPhase.staggerDelay, layout.nodes.length);
    stampAnimationVars(svg, {
      duration: enterPhase.duration,
      spring: enterPhase.spring,
      stagger,
      annotationDelay: animation!.annotationDelay,
      ease: enterPhase.ease,
    });
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
  const gradientIds = new Map(
    layout.links.map((link, i) => [
      i,
      ctx.ids.next(`oc-sg-${sanitizeId(link.sourceId)}-${sanitizeId(link.targetId)}`),
    ]),
  );
  renderGradientDefs(defs, layout.links, nodePositions, gradientIds);
  svg.appendChild(defs);

  // Links (behind nodes)
  renderLinks(svg, layout.links, layout.nodes, animation, gradientIds);

  // Nodes
  renderNodes(svg, layout.nodes, animation);

  // Labels
  renderLabels(svg, layout.nodes, resolvedSurface(layout.theme), layout.measureText);

  // Legend
  renderLegend(svg, layout.legend);

  // Chrome (title, subtitle, source, byline, footer) renders on top
  renderChrome(svg, layout);

  // Brand
  renderAttributionBrand(
    svg,
    layout.chrome,
    layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height,
    layout.measureText,
  );

  return svg;
}
