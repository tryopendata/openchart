/**
 * Chrome rendering: title, subtitle, source, byline, footer.
 */

import type {
  ChartLayout,
  MeasureTextFn,
  ResolvedChromeElement,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, textAscent, wrapText } from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

function renderChromeElement(
  parent: SVGElement,
  element: ResolvedChromeElement,
  className: string,
  chromeKey: string,
  measureText?: MeasureTextFn,
  uppercase = false,
): void {
  const text = createSVGElement('text');
  // element.y is the TOP of the text box; convert to the alphabetic baseline
  // here instead of relying on dominant-baseline:hanging, which WebKit
  // positions from different font metrics and never inherits into tspans.
  setAttrs(text, { x: element.x, y: element.y + textAscent(element.style.fontSize) });
  applyTextStyle(text, element.style);
  text.setAttribute('class', className);
  text.setAttribute('data-chrome-key', chromeKey);

  // happy-dom doesn't apply CSS text-transform inside SVG measurement, so
  // pre-uppercase the rendered text for elements that style as uppercase.
  // Browsers honor the CSS rule too, so this is double-applied harmlessly.
  const renderedText = uppercase ? element.text.toUpperCase() : element.text;

  const lines = wrapText(
    renderedText,
    element.style.fontSize,
    element.style.fontWeight,
    element.maxWidth,
    measureText,
  );

  if (lines.length === 1) {
    text.textContent = renderedText;
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
  if (chrome.eyebrow) {
    // Leading accent dot — matches the editorial design system mock.
    // eyebrow.y is the top of the text box. Visual center is roughly
    // y + fontSize * 0.55 (cap height).
    const eyebrow = chrome.eyebrow;
    const dotR = 3;
    const dotGap = 8;
    const dotX = eyebrow.x + dotR;
    const dotY = eyebrow.y + eyebrow.style.fontSize * 0.42;
    const dot = createSVGElement('circle');
    dot.setAttribute('class', 'oc-eyebrow-dot');
    setAttrs(dot, { cx: dotX, cy: dotY, r: dotR });
    dot.setAttribute('fill', eyebrow.style.fill ?? 'currentColor');
    g.appendChild(dot);

    const shifted: ResolvedChromeElement = {
      ...eyebrow,
      x: eyebrow.x + dotR * 2 + dotGap,
    };
    renderChromeElement(g, shifted, 'oc-eyebrow', 'eyebrow', measureText, true);
  }
  if (chrome.title) {
    renderChromeElement(g, chrome.title, 'oc-title', 'title', measureText);
  }
  if (chrome.subtitle) {
    renderChromeElement(g, chrome.subtitle, 'oc-subtitle', 'subtitle', measureText);
  }

  const bottomOffset = layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height;
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
  if (chrome.brand) {
    const brandY = bottomOffset + chrome.brand.y;
    renderChromeElement(g, { ...chrome.brand, y: brandY }, 'oc-brand', 'brand', measureText);
    // Accent dot to the left of the brand text. text-anchor=end means
    // brand.x is the right edge, so the dot sits 12px left of the measured
    // text's leftmost glyph. Use estimateTextWidth (the same path the
    // engine uses for label sizing) instead of a `length * 0.55em` fudge
    // so wide glyphs (W, M) and narrow ones (i, l) land correctly.
    const textWidth = estimateTextWidth(
      chrome.brand.text,
      chrome.brand.style.fontSize,
      chrome.brand.style.fontWeight,
    );
    const dotX = chrome.brand.x - textWidth - 12;
    const dotY = brandY + chrome.brand.style.fontSize / 2;
    const dot = createSVGElement('circle');
    dot.setAttribute('class', 'oc-brand-dot');
    setAttrs(dot, { cx: dotX, cy: dotY, r: 3 });
    g.appendChild(dot);
  }

  parent.appendChild(g);
}
