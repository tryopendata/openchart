/**
 * Shared SVG DOM helpers used across the per-concern renderers.
 *
 * Pure, stateless utilities. No layout/theme knowledge.
 */

import type { ChartLayout, TextStyle } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

export function createSVGElement(tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag);
}

export function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

export function applyTextStyle(el: SVGElement, style: TextStyle): void {
  setAttrs(el, {
    'font-family': style.fontFamily,
    'font-size': style.fontSize,
    'font-weight': style.fontWeight,
  });
  // Use inline style for fill so it takes priority over CSS class defaults
  // (e.g. .oc-title { fill: var(--oc-text) } which would override attributes)
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', style.fill);
  if (style.textAnchor) {
    el.setAttribute('text-anchor', style.textAnchor);
  }
  if (style.dominantBaseline) {
    el.setAttribute('dominant-baseline', style.dominantBaseline);
  }
  if (style.fontVariant) {
    el.setAttribute('font-variant', style.fontVariant);
  }
}

/**
 * Compute the vertical extent of x-axis labels below the chart area.
 * Accounts for rotated tick labels which need more vertical space.
 */
export function computeXAxisExtent(layout: ChartLayout): number {
  const xAxis = layout.axes.x;
  if (!xAxis) return 0;

  if (xAxis.tickAngle && Math.abs(xAxis.tickAngle) > 10) {
    // Rotated labels: estimate height from the longest tick label.
    const fontSize = xAxis.tickLabelStyle.fontSize;
    const fontWeight = xAxis.tickLabelStyle.fontWeight;
    const angleRad = Math.abs(xAxis.tickAngle) * (Math.PI / 180);
    let maxLabelWidth = 40;
    for (const tick of xAxis.ticks) {
      const w = estimateTextWidth(tick.label, fontSize, fontWeight);
      if (w > maxLabelWidth) maxLabelWidth = w;
    }
    const rotatedHeight = Math.min(maxLabelWidth * Math.sin(angleRad) + 6, 120);
    return xAxis.label ? rotatedHeight + 20 : rotatedHeight;
  }

  return xAxis.label ? 48 : 26;
}
