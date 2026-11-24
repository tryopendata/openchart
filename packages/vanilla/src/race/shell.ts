import type { RaceLayout, RaceMarkType } from '@opendata-ai/openchart-core';
import { renderAttributionBrand } from '../renderers/brand';
import { renderChromeElement } from '../renderers/chrome';
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import { stampThemeProperties } from '../theme-tokens';

export type RaceMarkHost<TMark extends RaceMarkType> = TMark extends 'table'
  ? HTMLElement
  : SVGGElement;

export interface RaceShell<TMark extends RaceMarkType = RaceMarkType> {
  root: HTMLElement;
  svg: SVGSVGElement;
  markHost: RaceMarkHost<TMark>;
  controlsSlot: HTMLElement;
  destroy(): void;
}

export function createRaceShell<TLayout extends RaceLayout>(
  container: HTMLElement,
  layout: TLayout,
  idScope: string,
): RaceShell<TLayout['mark']>;
export function createRaceShell(
  container: HTMLElement,
  layout: RaceLayout,
  _idScope: string,
): RaceShell {
  const doc = container.ownerDocument;
  const { width, height, area, a11y, chrome, theme, measureText } = layout;
  const root = doc.createElement('div');
  root.className = 'oc-root oc-race-root';
  stampThemeProperties(root, theme);

  const svg = doc.createElementNS(SVG_NS, 'svg');
  setAttrs(svg, { class: 'oc-race', viewBox: `0 0 ${width} ${height}` });
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = `${height}px`;
  svg.style.fontFamily = 'var(--oc-font-family)';
  if (a11y.hidden) svg.setAttribute('aria-hidden', 'true');
  else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', a11y.altText.trim() ? a11y.altText : 'Race chart');
  }
  stampThemeProperties(svg, theme);
  root.append(svg);

  const chromeGroup = doc.createElementNS(SVG_NS, 'g');
  chromeGroup.setAttribute('class', 'oc-chrome');
  if (chrome.rule) {
    const rule = doc.createElementNS(SVG_NS, 'rect');
    setAttrs(rule, {
      class: 'oc-chrome-rule',
      x: chrome.rule.x,
      y: chrome.rule.y,
      width: chrome.rule.width,
      height: chrome.rule.thickness,
      fill: chrome.rule.color,
      'shape-rendering': 'crispEdges',
    });
    chromeGroup.append(rule);
  }
  const bottom = chrome.bottomAnchorY ?? area.y + area.height;
  for (const key of ['eyebrow', 'title', 'subtitle', 'source', 'byline', 'footer'] as const) {
    const element = chrome[key];
    if (!element) continue;
    const isBottom = key === 'source' || key === 'byline' || key === 'footer';
    renderChromeElement(
      chromeGroup,
      isBottom ? { ...element, y: bottom + element.y } : element,
      `oc-${key}`,
      key,
      measureText,
      key === 'eyebrow',
    );
  }
  svg.append(chromeGroup);
  renderAttributionBrand(
    svg,
    layout.watermark ? chrome : { ...chrome, watermark: undefined },
    bottom,
    measureText,
  );
  if (a11y.hidden) svg.querySelector('.oc-chrome-ref')?.setAttribute('tabindex', '-1');

  let markHost: RaceMarkHost<RaceMarkType>;
  if (layout.mark === 'table') {
    markHost = doc.createElement('div');
    markHost.className = 'oc-race-table';
    root.append(markHost);
  } else {
    markHost = doc.createElementNS(SVG_NS, 'g');
    markHost.setAttribute('class', 'oc-race-mark');
    svg.append(markHost);
  }

  const controlsSlot = doc.createElement('div');
  controlsSlot.className = 'oc-race-controls-slot';
  root.append(controlsSlot);
  container.append(root);

  return {
    root,
    svg,
    markHost,
    controlsSlot,
    destroy() {
      root.remove();
    },
  };
}
