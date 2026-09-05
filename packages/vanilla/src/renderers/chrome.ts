/**
 * Chrome rendering: title, subtitle, source, byline, footer.
 */

import type {
  ChartLayout,
  MeasureTextFn,
  ResolvedChromeElement,
} from '@opendata-ai/openchart-core';
import {
  FOOTNOTE_LINE_HEIGHT,
  footnoteBandHeight as footnoteBandHeightFor,
  textAscent,
  truncateToWidth,
  wrapText,
} from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

/**
 * Vertical space the auto-thinning footnote list occupies below the plot.
 * Everything on the footer row (source, byline, footer, brand) shifts down by
 * this much so the footnotes don't land on top of it. Zero when there are no
 * footnotes. The brand watermark renders from a separate path
 * (`renderBrand`), so it has to read the same number from here rather than
 * recompute it.
 *
 * A `ChartLayout`-shaped adapter over the core helper -- deliberately not a
 * second implementation. The engine reserves this band in the bottom margin
 * from the same function, so a local copy of the arithmetic is a standing
 * invitation for the two to drift and drop the footnotes onto the watermark.
 */
export function footnoteBandHeight(layout: ChartLayout): number {
  return footnoteBandHeightFor(layout.chrome.footnotes?.length ?? 0, layout.theme);
}

export function renderChromeElement(
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

  // Cap wrapped output to maxLines, truncating the last kept line with an
  // ellipsis so it fits maxWidth. Only when the natural wrap exceeds the cap.
  let truncated = false;
  if (element.maxLines != null && lines.length > element.maxLines) {
    truncated = true;
    lines.length = element.maxLines;
    const lastIndex = element.maxLines - 1;
    const measure = measureText
      ? (text: string, fontSize: number, fontWeight?: number) =>
          measureText(text, fontSize, fontWeight).width
      : undefined;
    // Content was dropped, so the last kept line always gets an ellipsis.
    // Append it first, then shrink to fit maxWidth if the combined string
    // overflows.
    const withEllipsis = `${lines[lastIndex]}…`;
    lines[lastIndex] = truncateToWidth(
      withEllipsis,
      element.maxWidth,
      element.style.fontSize,
      element.style.fontWeight,
      measure,
    );
  }

  if (lines.length === 1 && !truncated) {
    text.textContent = renderedText;
  } else if (lines.length === 1) {
    text.textContent = lines[0];
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

  // Editorial rule: a short colored bar above the top chrome block.
  if (chrome.rule) {
    const rule = createSVGElement('rect');
    rule.setAttribute('class', 'oc-chrome-rule');
    setAttrs(rule, {
      x: chrome.rule.x,
      y: chrome.rule.y,
      width: chrome.rule.width,
      height: chrome.rule.thickness,
    });
    rule.setAttribute('fill', chrome.rule.color);
    rule.setAttribute('shape-rendering', 'crispEdges');
    g.appendChild(rule);
  }

  // Top chrome: render at their stored y positions (already absolute)
  if (chrome.eyebrow && chrome.rule) {
    // The rule already carries the accent above the block; a dot as well is
    // two pieces of furniture saying the same thing.
    renderChromeElement(g, chrome.eyebrow, 'oc-eyebrow', 'eyebrow', measureText, true);
  } else if (chrome.eyebrow) {
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

  // Footnotes from auto-thinned annotations, rendered above source/byline.
  // Each footnote gets its own line to avoid horizontal overflow.
  const bandHeight = footnoteBandHeight(layout);
  if (chrome.footnotes && chrome.footnotes.length > 0) {
    const fontSize = layout.theme.fonts.sizes.small;
    const pad = layout.theme.spacing.padding;
    const lineHeight = fontSize * FOOTNOTE_LINE_HEIGHT;
    const style = {
      fontFamily: layout.theme.fonts.family,
      fontSize,
      fontWeight: layout.theme.fonts.weights.normal,
      fill: layout.theme.chrome.source.color,
      lineHeight: FOOTNOTE_LINE_HEIGHT,
      textAnchor: 'start' as const,
    };

    for (let i = 0; i < chrome.footnotes.length; i++) {
      const f = chrome.footnotes[i];
      const y =
        bottomOffset + layout.theme.spacing.chartToFooter + textAscent(fontSize) + i * lineHeight;
      const el = createSVGElement('text');
      el.setAttribute('class', 'oc-footnotes');
      setAttrs(el, { x: pad, y });
      applyTextStyle(el, style);
      el.textContent = `${f.index}. ${f.text}`;
      g.appendChild(el);
    }
  }

  if (chrome.source) {
    renderChromeElement(
      g,
      { ...chrome.source, y: bottomOffset + chrome.source.y + bandHeight },
      'oc-source',
      'source',
      measureText,
    );
  }
  if (chrome.byline) {
    renderChromeElement(
      g,
      { ...chrome.byline, y: bottomOffset + chrome.byline.y + bandHeight },
      'oc-byline',
      'byline',
      measureText,
    );
  }
  if (chrome.footer) {
    renderChromeElement(
      g,
      { ...chrome.footer, y: bottomOffset + chrome.footer.y + bandHeight },
      'oc-footer',
      'footer',
      measureText,
    );
  }
  if (chrome.brand) {
    const brandY = bottomOffset + chrome.brand.y + bandHeight;
    renderChromeElement(g, { ...chrome.brand, y: brandY }, 'oc-brand', 'brand', measureText);
  }

  parent.appendChild(g);
}
