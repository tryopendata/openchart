/**
 * Chrome rendering: title, subtitle, source, byline, footer.
 */

import type {
  ChartLayout,
  MeasureTextFn,
  ResolvedChromeElement,
} from '@opendata-ai/openchart-core';
import { wrapText } from '@opendata-ai/openchart-core';
import { applyTextStyle, computeXAxisExtent, createSVGElement, setAttrs } from './svg-dom';

function renderChromeElement(
  parent: SVGElement,
  element: ResolvedChromeElement,
  className: string,
  chromeKey: string,
  measureText?: MeasureTextFn,
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
    measureText,
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

export function renderChrome(parent: SVGElement, layout: ChartLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome, measureText } = layout;

  // Top chrome: render at their stored y positions (already absolute)
  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title', measureText);
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle', measureText);
  }

  // Bottom chrome starts below x-axis labels/title, not at chart area bottom.
  // Accounts for rotated tick labels which need more vertical space.
  const xAxisExtent = computeXAxisExtent(layout);
  const bottomOffset = layout.area.y + layout.area.height + xAxisExtent;
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
