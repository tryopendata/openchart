/**
 * BarList SVG renderer: converts a BarListLayout into SVG DOM elements.
 *
 * Creates an <svg> with rows of label + track + bar + value. Animation is
 * pure CSS, driven by data attributes and CSS custom properties.
 */

import type { BarListLayout, BarListRowMark, ResolvedAnimation } from '@opendata-ai/openchart-core';
import { stampAnimationVars } from './animation-vars';
import { renderAttributionBrand } from './renderers/brand';
import { renderChromeElement } from './renderers/chrome';
import { stampThemeProperties } from './theme-tokens';

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

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

function renderChrome(parent: SVGElement, layout: BarListLayout): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-chrome');

  const { chrome } = layout;
  const bottomOffset = layout.area.y + layout.area.height;

  for (const key of ['title', 'subtitle', 'source', 'byline', 'footer'] as const) {
    const el = chrome[key];
    if (!el) continue;

    const isBottom = key === 'source' || key === 'byline' || key === 'footer';
    renderChromeElement(
      g,
      isBottom ? { ...el, y: bottomOffset + el.y } : el,
      `oc-${key}`,
      key,
      layout.measureText,
    );
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Watermark rendering
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row rendering
// ---------------------------------------------------------------------------

function renderRows(
  parent: SVGElement,
  rows: BarListRowMark[],
  animation?: ResolvedAnimation,
): void {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-barlist-rows');
  g.setAttribute('role', 'list');

  for (const row of rows) {
    const rowGroup = createSVGElement('g');
    rowGroup.setAttribute('class', 'oc-barlist-row');
    rowGroup.setAttribute('data-row-index', String(row.index));
    rowGroup.setAttribute('role', 'listitem');
    if (row.aria?.label) {
      rowGroup.setAttribute('aria-label', row.aria.label);
    }

    if (animation?.enter) {
      rowGroup.setAttribute('data-animation-index', String(row.animationIndex));
      const style = (rowGroup as SVGElement & ElementCSSInlineStyle).style;
      style.setProperty('--oc-mark-index', String(row.animationIndex));
      style.setProperty('--oc-row-delay', `${row.animationIndex * 40}ms`);
    }

    // Label text
    const labelEl = createSVGElement('text');
    setAttrs(labelEl, {
      x: row.label.x,
      y: row.label.y,
      'dominant-baseline': 'central',
      'text-anchor': 'start',
      'font-family': row.label.style.fontFamily,
      'font-size': row.label.style.fontSize,
      'font-weight': row.label.style.fontWeight,
    });
    (labelEl as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', row.label.style.fill);
    labelEl.textContent = row.label.text;
    rowGroup.appendChild(labelEl);

    // Subtitle text (if present)
    if (row.subtitle?.visible) {
      const subEl = createSVGElement('text');
      setAttrs(subEl, {
        x: row.subtitle.x,
        y: row.subtitle.y,
        'dominant-baseline': 'central',
        'text-anchor': 'start',
        'font-family': row.subtitle.style.fontFamily,
        'font-size': row.subtitle.style.fontSize,
        'font-weight': row.subtitle.style.fontWeight,
      });
      (subEl as SVGElement & ElementCSSInlineStyle).style.setProperty(
        'fill',
        row.subtitle.style.fill,
      );
      subEl.textContent = row.subtitle.text;
      rowGroup.appendChild(subEl);
    }

    // Track (muted background bar)
    const trackRect = createSVGElement('rect');
    setAttrs(trackRect, {
      x: row.track.x,
      y: row.track.y,
      width: row.track.width,
      height: row.track.height,
      rx: row.track.cornerRadius,
      fill: 'currentColor',
      'fill-opacity': 0.06,
    });
    trackRect.setAttribute('class', 'oc-barlist-track');
    rowGroup.appendChild(trackRect);

    // Fill bar
    const barRect = createSVGElement('rect');
    setAttrs(barRect, {
      x: row.bar.x,
      y: row.bar.y,
      width: row.bar.width,
      height: row.bar.height,
      rx: row.bar.cornerRadius,
      fill: row.bar.fill,
    });
    barRect.setAttribute('class', 'oc-barlist-bar');
    rowGroup.appendChild(barRect);

    // Value label (right-aligned)
    const valueEl = createSVGElement('text');
    setAttrs(valueEl, {
      x: row.valueLabel.x,
      y: row.valueLabel.y,
      'dominant-baseline': 'central',
      'text-anchor': 'end',
      'font-family': row.valueLabel.style.fontFamily,
      'font-size': row.valueLabel.style.fontSize,
      'font-weight': row.valueLabel.style.fontWeight,
    });
    (valueEl as SVGElement & ElementCSSInlineStyle).style.setProperty(
      'fill',
      row.valueLabel.style.fill,
    );
    valueEl.textContent = row.valueLabel.text;
    rowGroup.appendChild(valueEl);

    g.appendChild(rowGroup);
  }

  parent.appendChild(g);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderBarListSVG(
  layout: BarListLayout,
  opts?: { animate?: boolean },
): SVGSVGElement {
  const { width, height, rows, a11y, animation } = layout;
  const animate = opts?.animate && !!animation?.enter;

  const svg = createSVGElement('svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'list');
  // No explicit width attribute — CSS width:100% on .oc-barlist-root handles it.
  // Explicit pixel height via inline style avoids iOS Safari's height:100% quirk.
  svg.style.height = `${height}px`;
  if (a11y.altText) {
    svg.setAttribute('aria-label', a11y.altText);
  }

  const classes = animate ? 'oc-barlist oc-animate' : 'oc-barlist';
  svg.setAttribute('class', classes);
  stampThemeProperties(svg, layout.theme);

  if (animate && animation?.enter) {
    stampAnimationVars(svg, {
      duration: animation.enter.duration,
      spring: animation.enter.spring,
      stagger: 40,
    });
  }

  renderChrome(svg, layout);
  renderRows(svg, rows, animate ? animation : undefined);

  renderAttributionBrand(
    svg,
    layout.chrome,
    layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height,
    layout.measureText,
  );

  return svg;
}
