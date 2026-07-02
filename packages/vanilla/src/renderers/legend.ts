/**
 * Legend rendering: swatches + labels with wrap/overflow handling.
 */

import type { CategoricalLegendLayout, LegendLayout } from '@opendata-ai/openchart-core';
import { sharedMeasureText } from '../measure-text';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

function isCategorical(legend: LegendLayout): legend is CategoricalLegendLayout {
  return !legend.type || legend.type === 'categorical';
}

export function renderLegend(parent: SVGElement, legend: LegendLayout): void {
  if (!isCategorical(legend) || legend.entries.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend');
  g.setAttribute('role', 'list');
  g.setAttribute('aria-label', 'Chart legend');

  const isHorizontal = legend.position === 'top' || legend.position === 'bottom';
  const measure = sharedMeasureText();
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];

    // Pre-check: wrap to next line if this entry would overflow bounds
    if (isHorizontal && i > 0) {
      const labelWidth = measure(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      ).width;
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      if (offsetX + entryWidth > legend.bounds.x + legend.bounds.width) {
        offsetX = legend.bounds.x;
        offsetY += legend.swatchSize + 6;
      }
    }
    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'oc-legend-entry');
    entryG.setAttribute('role', 'listitem');
    entryG.setAttribute('data-legend-index', String(i));
    entryG.setAttribute('data-legend-label', entry.label);
    if (entry.overflow) {
      entryG.setAttribute('data-legend-overflow', 'true');
      entryG.setAttribute('aria-label', entry.label);
      entryG.setAttribute('opacity', '0.5');
    } else {
      entryG.setAttribute(
        'aria-label',
        `${entry.label}: ${entry.active !== false ? 'visible' : 'hidden'}`,
      );
      entryG.setAttribute('style', 'cursor: pointer');

      // Apply dimming for inactive entries
      if (entry.active === false) {
        entryG.setAttribute('opacity', '0.3');
      }
    }

    // Swatch: bare colored mark matching the chart type.
    // Circle for point/scatter, line segment for line/area, filled rect for bar.
    const midX = offsetX + legend.swatchSize / 2;
    const midY = offsetY + legend.swatchSize / 2;
    if (entry.shape === 'circle') {
      const circle = createSVGElement('circle');
      setAttrs(circle, {
        cx: midX,
        cy: midY,
        r: legend.swatchSize / 2,
        fill: entry.color,
      });
      entryG.appendChild(circle);
    } else if (entry.shape === 'line') {
      const lineWidth = legend.swatchSize;
      const line = createSVGElement('line');
      line.setAttribute('class', 'oc-legend-swatch-line');
      setAttrs(line, {
        x1: offsetX,
        y1: midY,
        x2: offsetX + lineWidth,
        y2: midY,
        stroke: entry.color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      entryG.appendChild(line);
    } else {
      const rectSize = Math.round(legend.swatchSize * 0.6);
      const rect = createSVGElement('rect');
      rect.setAttribute('class', 'oc-legend-swatch-rect');
      setAttrs(rect, {
        x: offsetX + (legend.swatchSize - rectSize) / 2,
        y: midY - rectSize / 2,
        width: rectSize,
        height: rectSize,
        rx: 2,
        ry: 2,
        fill: entry.color,
      });
      entryG.appendChild(rect);
    }

    // Label
    const label = createSVGElement('text');
    setAttrs(label, {
      x: offsetX + legend.swatchSize + legend.swatchGap,
      y: offsetY + legend.swatchSize / 2,
      'dominant-baseline': 'central',
    });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = entry.label;
    entryG.appendChild(label);

    g.appendChild(entryG);

    // Advance position for next entry
    if (isHorizontal) {
      const labelWidth = measure(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      ).width;
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      offsetX += entryWidth;
    } else {
      offsetY += legend.swatchSize + legend.entryGap;
    }
  }

  parent.appendChild(g);
}
