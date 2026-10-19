/** Portable SVG attribution embedded in HTML table and graph shells. */
import type { MeasureTextFn, ResolvedChrome } from '@opendata-ai/openchart-core';
import { renderAttributionBrand } from './brand';
import { renderChromeElement } from './chrome';
import { createSVGElement, setAttrs } from './svg-dom';

export function createAttributionFooter(
  chrome: ResolvedChrome,
  width: number,
  measureText?: MeasureTextFn,
): SVGSVGElement | null {
  if (!chrome.source && !chrome.byline && !chrome.footer && !chrome.brand && !chrome.watermark)
    return null;
  const svg = createSVGElement('svg') as SVGSVGElement;
  svg.setAttribute('class', 'oc-attribution-footer');
  setAttrs(svg, {
    width: '100%',
    height: chrome.bottomHeight,
    viewBox: `0 0 ${width} ${chrome.bottomHeight}`,
  });
  svg.style.display = 'block';
  svg.style.flex = '0 0 auto';
  for (const key of ['source', 'byline', 'footer'] as const) {
    const element = chrome[key];
    if (element) renderChromeElement(svg, element, `oc-${key}`, key, measureText);
  }
  renderAttributionBrand(svg, chrome, 0, measureText);
  return svg;
}
