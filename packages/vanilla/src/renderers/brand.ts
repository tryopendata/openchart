/**
 * Brand rendering: the "OpenData" watermark footer.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { BRAND_MIN_WIDTH, textAscent } from '@opendata-ai/openchart-core';
import { footnoteBandHeight } from './chrome';
import { createSVGElement, setAttrs, XLINK_NS } from './svg-dom';

const BRAND_URL = 'https://tryopendata.ai';

/**
 * Render the brand watermark as a footer-row element, right-aligned on the
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
  const bottomOffset = chrome.bottomAnchorY ?? layout.area.y + layout.area.height;
  const firstBottom = chrome.source ?? chrome.byline ?? chrome.footer;
  // When no bottom chrome items exist, derive a fallback offset that still
  // clears any bottom-positioned legend so the brand watermark doesn't
  // overlap legend swatches.
  const { legend } = layout;
  const bottomLegendOffset =
    legend.position === 'bottom' && legend.bounds.height > 0 ? legend.bounds.height + 8 : 0;
  // renderChrome pushes the whole footer row down past the footnote list; the
  // brand shares that row, so it takes the same shift or the footnotes land on
  // top of it.
  const bandHeight = footnoteBandHeight(layout);
  const chromeY = firstBottom
    ? bottomOffset + firstBottom.y + bandHeight
    : bottomOffset + layout.theme.spacing.chartToFooter + bottomLegendOffset + bandHeight;

  const a = createSVGElement('a');
  a.setAttribute('href', BRAND_URL);
  a.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
  a.setAttribute('class', 'oc-chrome-ref');

  // chromeY is the top edge shared with source/byline chrome text; anchor the
  // shared alphabetic baseline from the largest tspan's ascent. (Hanging
  // baseline is avoided: WebKit positions it differently and never inherits
  // it into tspans, which scattered the three spans on iOS Safari.)
  const BRAND_LARGE = 16;
  const text = createSVGElement('text');
  setAttrs(text, {
    x: rightEdge,
    y: chromeY + textAscent(BRAND_LARGE),
    'font-family': layout.theme.fonts.family,
    'font-size': BRAND_LARGE,
    'font-weight': '600',
    'text-anchor': 'end',
    'fill-opacity': 0.55,
  });
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', fill);

  text.textContent = 'OpenData';

  a.appendChild(text);
  parent.appendChild(a);
}
