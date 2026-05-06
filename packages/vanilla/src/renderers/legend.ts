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
    // The default ('square') and 'line' shapes render as a "chip": a small
    // rounded rectangle in a subtle elevated surface tone with a colored
    // rounded bar through the middle. Matches the editorial mock-2 legend
    // and the endpoint-labels swatch so a chart never shows two swatch styles.
    // 'circle' is preserved for point/scatter charts.
    if (entry.shape === 'circle') {
      const circle = createSVGElement('circle');
      setAttrs(circle, {
        cx: offsetX + legend.swatchSize / 2,
        cy: offsetY + legend.swatchSize / 2,
        r: legend.swatchSize / 2,
        fill: entry.color,
      });
      entryG.appendChild(circle);
    } else {
      const chipHeight = Math.max(12, Math.round(legend.swatchSize * 0.85));
      const chipY = offsetY + legend.swatchSize / 2 - chipHeight / 2;
      const chip = createSVGElement('rect');
      chip.setAttribute('class', 'oc-legend-swatch-chip');
      setAttrs(chip, {
        x: offsetX,
        y: chipY,
        width: legend.swatchSize,
        height: chipHeight,
        rx: 3,
        ry: 3,
        fill: legend.swatchChipFill,
      });
      entryG.appendChild(chip);

      const barWidth = Math.max(8, legend.swatchSize - 8);
      const barHeight = 3;
      const barX = offsetX + (legend.swatchSize - barWidth) / 2;
      const barY = offsetY + legend.swatchSize / 2 - barHeight / 2;
      const bar = createSVGElement('rect');
      bar.setAttribute('class', 'oc-legend-swatch-bar');
      setAttrs(bar, {
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        rx: barHeight / 2,
        ry: barHeight / 2,
        fill: entry.color,
      });
      entryG.appendChild(bar);
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
