/**
 * Legend rendering: swatches + labels with wrap/overflow handling.
 */

import type { CategoricalLegendLayout, LegendLayout } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
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
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];

    // Pre-check: wrap to next line if this entry would overflow bounds
    if (isHorizontal && i > 0) {
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
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

    // Swatch
    if (entry.shape === 'circle') {
      const circle = createSVGElement('circle');
      setAttrs(circle, {
        cx: offsetX + legend.swatchSize / 2,
        cy: offsetY + legend.swatchSize / 2,
        r: legend.swatchSize / 2,
        fill: entry.color,
      });
      entryG.appendChild(circle);
    } else if (entry.shape === 'line') {
      // Line swatch: a short line segment with a dot in the middle
      const line = createSVGElement('line');
      setAttrs(line, {
        x1: offsetX,
        y1: offsetY + legend.swatchSize / 2,
        x2: offsetX + legend.swatchSize,
        y2: offsetY + legend.swatchSize / 2,
        stroke: entry.color,
        'stroke-width': 2,
      });
      entryG.appendChild(line);
      // Small dot at center
      const dot = createSVGElement('circle');
      setAttrs(dot, {
        cx: offsetX + legend.swatchSize / 2,
        cy: offsetY + legend.swatchSize / 2,
        r: 2.5,
        fill: entry.color,
      });
      entryG.appendChild(dot);
    } else {
      const rect = createSVGElement('rect');
      setAttrs(rect, {
        x: offsetX,
        y: offsetY,
        width: legend.swatchSize,
        height: legend.swatchSize,
        fill: entry.color,
        rx: 2,
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
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      offsetX += entryWidth;
    } else {
      offsetY += legend.swatchSize + legend.entryGap;
    }
  }

  parent.appendChild(g);
}
