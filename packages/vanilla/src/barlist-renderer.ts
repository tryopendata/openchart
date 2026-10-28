import { createRenderContext, type RenderContext } from './render-context';
import { createSVGElement } from './renderers/svg-dom';
/**
 * BarList SVG renderer: converts a BarListLayout into SVG DOM elements.
 *
 * Creates an <svg> with rows of label + track + bar + value. Animation is
 * pure CSS, driven by data attributes and CSS custom properties.
 */

import type { BarListLayout, ResolvedAnimation } from '@opendata-ai/openchart-core';
import { stampAnimationVars } from './animation-vars';
import { renderAttributionBrand } from './renderers/brand';
import { renderChromeElement } from './renderers/chrome';
import { stampThemeProperties } from './theme-tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

function renderChrome(
  parent: SVGElement,
  layout: BarListLayout,
  ctx: RenderContext = createRenderContext(),
): void {
  const g = createSVGElement('g', ctx.factory);
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
      undefined,
      ctx,
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
  layout: BarListLayout,
  animation?: ResolvedAnimation,
  ctx: RenderContext = createRenderContext(),
): void {
  const g = createSVGElement('g', ctx.factory);
  g.setAttribute('class', 'oc-barlist-rows');
  if (ctx.interactive) g.setAttribute('role', 'list');

  for (const row of layout.rows) {
    const rowGroup = createSVGElement('g', ctx.factory);
    rowGroup.setAttribute('class', 'oc-barlist-row');
    rowGroup.setAttribute('data-row-index', String(row.index));
    if (ctx.interactive) rowGroup.setAttribute('role', 'listitem');
    if (ctx.interactive && row.aria?.label) {
      rowGroup.setAttribute('aria-label', row.aria.label);
    }

    if (animation?.enter) {
      rowGroup.setAttribute('data-animation-index', String(row.animationIndex));
      const style = (rowGroup as SVGElement & ElementCSSInlineStyle).style;
      style.setProperty('--oc-mark-index', String(row.animationIndex));
      style.setProperty('--oc-row-delay', `${row.animationIndex * 40}ms`);
    }

    // Label text
    const labelEl = createSVGElement('text', ctx.factory);
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
    if (row.fullLabel && row.fullLabel !== row.label.text) {
      const labelGroup = createSVGElement('g', ctx.factory);
      labelGroup.setAttribute('class', 'oc-barlist-label');
      const title = createSVGElement('title', ctx.factory);
      title.textContent = row.fullLabel;
      labelGroup.appendChild(title);
      labelGroup.appendChild(labelEl);
      rowGroup.appendChild(labelGroup);
    } else rowGroup.appendChild(labelEl);

    // Subtitle text (if present)
    if (row.subtitle?.visible) {
      const subEl = createSVGElement('text', ctx.factory);
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
    const trackRect = createSVGElement('rect', ctx.factory);
    setAttrs(trackRect, {
      x: row.track.x,
      y: row.track.y,
      width: row.track.width,
      height: row.track.height,
      rx: row.track.cornerRadius,
      fill: ctx.interactive ? 'currentColor' : layout.theme.colors.text,
      'fill-opacity': 0.06,
    });
    trackRect.setAttribute('class', 'oc-barlist-track');
    rowGroup.appendChild(trackRect);

    // Fill bar
    const barRect = createSVGElement('rect', ctx.factory);
    setAttrs(barRect, {
      x: row.bar.x,
      y: row.bar.y,
      width: row.bar.width,
      height: row.bar.height,
      rx: row.bar.cornerRadius,
      fill: row.bar.fill,
    });
    barRect.setAttribute('class', 'oc-barlist-bar');
    barRect.setAttribute('data-mark', 'bar');
    for (const [field, value] of Object.entries(row.identity ?? {}))
      barRect.setAttribute(`data-${field}`, value);
    const description = row.authoredDescription ?? row.aria.label;
    if (!ctx.interactive && description !== undefined) {
      const title = createSVGElement('title', ctx.factory);
      title.textContent = description;
      barRect.appendChild(title);
    }
    rowGroup.appendChild(barRect);

    // Value label (right-aligned)
    const valueEl = createSVGElement('text', ctx.factory);
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
  opts?: { animate?: boolean; context?: RenderContext },
): SVGSVGElement {
  const ctx = opts?.context ?? createRenderContext();
  const { width, height, a11y, animation } = layout;
  const animate = ctx.interactive && opts?.animate && !!animation?.enter;

  const svg = createSVGElement('svg', ctx.factory) as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (a11y.hidden) svg.setAttribute('aria-hidden', 'true');
  else svg.setAttribute('role', ctx.interactive ? 'list' : 'img');
  // No explicit width attribute — CSS width:100% on .oc-barlist-root handles it.
  // Explicit pixel height via inline style avoids iOS Safari's height:100% quirk.
  svg.style.height = `${height}px`;
  if (!a11y.hidden && a11y.altText) {
    svg.setAttribute('aria-label', a11y.altText);
  }

  const classes = animate ? 'oc-barlist oc-animate' : 'oc-barlist';
  svg.setAttribute('class', classes);
  if (ctx.interactive) stampThemeProperties(svg, layout.theme);

  if (animate && animation?.enter) {
    stampAnimationVars(svg, {
      duration: animation.enter.duration,
      spring: animation.enter.spring,
      stagger: 40,
    });
  }

  renderChrome(svg, layout, ctx);
  for (const group of layout.groups ?? []) {
    if (group.separator) {
      const rule = createSVGElement('line', ctx.factory);
      setAttrs(rule, {
        x1: group.separator.x1,
        x2: group.separator.x2,
        y1: group.separator.y,
        y2: group.separator.y,
        stroke: layout.theme.colors.neutral.border,
        'stroke-width': 1,
      });
      rule.setAttribute('class', 'oc-barlist-group-rule');
      svg.appendChild(rule);
    }
    const label = createSVGElement('text', ctx.factory);
    setAttrs(label, {
      x: group.label.x,
      y: group.label.y,
      'dominant-baseline': 'central',
      'font-family': group.label.style.fontFamily,
      'font-size': group.label.style.fontSize,
      'font-weight': group.label.style.fontWeight,
      fill: group.label.style.fill,
    });
    label.setAttribute('class', 'oc-barlist-group-label');
    label.textContent = group.label.text;
    svg.appendChild(label);
  }
  renderRows(svg, layout, animate ? animation : undefined, ctx);
  for (const reference of layout.referenceLines ?? []) {
    const line = createSVGElement('line', ctx.factory);
    setAttrs(line, {
      x1: reference.x,
      x2: reference.x,
      y1: reference.y1,
      y2: reference.y2,
      stroke: reference.stroke,
      'stroke-width': reference.strokeWidth,
    });
    if (reference.strokeDasharray) line.setAttribute('stroke-dasharray', reference.strokeDasharray);
    line.setAttribute('class', 'oc-barlist-refline');
    svg.appendChild(line);
    if (reference.label) {
      const label = createSVGElement('text', ctx.factory);
      setAttrs(label, {
        x: reference.label.x,
        y: reference.label.y,
        'text-anchor': 'middle',
        'font-family': reference.label.style.fontFamily,
        'font-size': reference.label.style.fontSize,
        'font-weight': reference.label.style.fontWeight,
        fill: reference.label.style.fill,
      });
      label.textContent = reference.label.text;
      svg.appendChild(label);
    }
  }

  renderAttributionBrand(
    svg,
    layout.chrome,
    layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height,
    layout.measureText,
    undefined,
    ctx,
  );

  return svg;
}
