/**
 * Brand rendering: the "tryOpenData.ai" watermark footer.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { BRAND_FONT_SIZE, BRAND_MIN_WIDTH } from '@opendata-ai/openchart-core';
import { computeXAxisExtent, createSVGElement, setAttrs, XLINK_NS } from './svg-dom';

const BRAND_URL = 'https://tryopendata.ai';

/**
 * Render the "OpenData" brand as a footer-row element, right-aligned on the
 * same baseline as the first bottom chrome text (source/byline/footer).
 * Uses the same font size as chrome source text so it blends in as a subtle
 * footer item rather than occupying independent visual space.
 */
export function renderBrand(parent: SVGElement, layout: ChartLayout): void {
  if (layout.dimensions.width < BRAND_MIN_WIDTH) return;

  const { width } = layout.dimensions;
  const padding = layout.theme.spacing.padding;
  const rightEdge = width - padding;
  const fill = layout.theme.colors.axis;

  // Vertically align with the first bottom chrome element.
  const { chrome } = layout;
  const xAxisExtent = computeXAxisExtent(layout);
  const bottomOffset = layout.area.y + layout.area.height + xAxisExtent;
  const firstBottom = chrome.source ?? chrome.byline ?? chrome.footer;
  // When no bottom chrome items exist, derive a fallback offset that still
  // clears any bottom-positioned legend so the brand watermark doesn't
  // overlap legend swatches.
  const { legend } = layout;
  const bottomLegendOffset =
    legend.position === 'bottom' && legend.bounds.height > 0 ? legend.bounds.height + 8 : 0;
  const chromeY = firstBottom
    ? bottomOffset + firstBottom.y
    : bottomOffset + layout.theme.spacing.chartToFooter + bottomLegendOffset;

  const a = createSVGElement('a');
  a.setAttribute('href', BRAND_URL);
  a.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
  a.setAttribute('class', 'oc-chrome-ref');

  // "try" in normal weight, "OpenData" in semibold, ".ai" in normal weight,
  // rendered as a single right-aligned text element with three tspans.
  // Use alphabetic baseline so mixed-size tspans share a common bottom line.
  const BRAND_LARGE = 16;
  const text = createSVGElement('text');
  setAttrs(text, {
    x: rightEdge,
    y: chromeY + BRAND_LARGE,
    'dominant-baseline': 'alphabetic',
    'font-family': layout.theme.fonts.family,
    'font-size': BRAND_FONT_SIZE,
    'text-anchor': 'end',
    'fill-opacity': 0.55,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', fill);

  const trySpan = createSVGElement('tspan');
  trySpan.setAttribute('font-weight', '500');
  trySpan.textContent = 'try';
  text.appendChild(trySpan);

  const openDataSpan = createSVGElement('tspan');
  openDataSpan.setAttribute('font-weight', '600');
  openDataSpan.setAttribute('font-size', String(BRAND_LARGE));
  openDataSpan.textContent = 'OpenData';
  text.appendChild(openDataSpan);

  const aiSpan = createSVGElement('tspan');
  aiSpan.setAttribute('font-weight', '500');
  aiSpan.textContent = '.ai';
  text.appendChild(aiSpan);

  a.appendChild(text);
  parent.appendChild(a);
}
