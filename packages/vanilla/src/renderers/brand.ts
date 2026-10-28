/** Shared measured attribution painting for SVG visualizations. */
import type { ChartLayout, MeasureTextFn, ResolvedChrome } from '@opendata-ai/openchart-core';
import { computeNoteBandHeight } from '@opendata-ai/openchart-core';
import { createRenderContext, type RenderContext } from '../render-context';
import { renderChromeElement } from './chrome';
import { createSVGElement, XLINK_NS } from './svg-dom';

const BRAND_URL = 'https://tryopendata.ai';

/** Paint the exact portable footer mark resolved by computeChrome. */
export function renderAttributionBrand(
  parent: SVGElement,
  chrome: ResolvedChrome,
  bottomOffset: number,
  measureText?: MeasureTextFn,
  includeCustom = true,
  ctx: RenderContext = createRenderContext(),
): void {
  if (includeCustom && chrome.brand) {
    renderChromeElement(
      parent,
      { ...chrome.brand, y: bottomOffset + chrome.brand.y },
      'oc-brand',
      'brand',
      measureText,
      undefined,
      ctx,
    );
  }
  const mark = chrome.watermark;
  if (!mark) return;
  const link = createSVGElement('a', ctx.factory);
  link.setAttribute('href', BRAND_URL);
  link.setAttributeNS(XLINK_NS, 'xlink:href', BRAND_URL);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');
  link.setAttribute('class', 'oc-chrome-ref');
  link.setAttribute('opacity', '0.55');
  renderChromeElement(
    link,
    { ...mark, y: bottomOffset + mark.y },
    'oc-watermark',
    'watermark',
    measureText,
    undefined,
    ctx,
  );
  parent.appendChild(link);
}

export function renderBrand(
  parent: SVGElement,
  layout: ChartLayout,
  ctx: RenderContext = createRenderContext(),
): void {
  const bandHeight =
    layout.chrome.noteBandHeight ?? computeNoteBandHeight(layout.chrome, layout.theme);
  const bottomOffset =
    (layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height) + bandHeight;
  renderAttributionBrand(parent, layout.chrome, bottomOffset, layout.measureText, false, ctx);
}
