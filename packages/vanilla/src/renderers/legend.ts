/**
 * Legend rendering: swatches + labels with wrap/overflow handling, plus the
 * continuous variant (gradient bar / binned swatch row) for quantitative
 * color scales.
 */

import type {
  CategoricalLegendLayout,
  ContinuousLegendLayout,
  LegendLayout,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { nextSvgId } from '../svg-ids';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

function isCategorical(legend: LegendLayout): legend is CategoricalLegendLayout {
  return !legend.type || legend.type === 'categorical';
}

/**
 * Render a continuous color legend: a gradient-filled bar (gradient mode) or
 * a contiguous swatch row (binned mode) with value labels below.
 *
 * The gradient ID comes from the shared `nextSvgId` counter like every other
 * gradient/clip-path def, so IDs stay deterministic at generation time.
 */
function renderContinuousLegend(parent: SVGElement, legend: ContinuousLegendLayout): void {
  if (legend.bounds.width <= 0 || legend.bounds.height <= 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend oc-legend--continuous');
  g.setAttribute('role', 'img');
  const first = legend.ticks[0];
  const last = legend.ticks[legend.ticks.length - 1];
  if (first && last) {
    g.setAttribute('aria-label', `Color scale from ${first.label} to ${last.label}`);
  } else {
    g.setAttribute('aria-label', 'Color scale');
  }

  if (legend.mode === 'gradient') {
    // linearGradient def + one rect. Defs may already exist (clip paths).
    let defs: SVGElement | null = parent.querySelector('defs');
    if (!defs) {
      defs = createSVGElement('defs');
      parent.insertBefore(defs, parent.firstChild);
    }
    const gradientId = nextSvgId('oc-legend-gradient');
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', gradientId);
    setAttrs(grad, { x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
    for (const stop of legend.colorStops) {
      const s = createSVGElement('stop');
      const attrs: Record<string, string | number> = {
        offset: `${stop.offset * 100}%`,
        'stop-color': stop.color,
      };
      if (stop.opacity !== undefined) attrs['stop-opacity'] = stop.opacity;
      setAttrs(s, attrs);
      grad.appendChild(s);
    }
    defs.appendChild(grad);

    const bar = createSVGElement('rect');
    bar.setAttribute('class', 'oc-legend-gradient-bar');
    setAttrs(bar, {
      x: legend.bar.x,
      y: legend.bar.y,
      width: legend.bar.width,
      height: legend.bar.height,
      rx: 2,
      ry: 2,
      fill: `url(#${gradientId})`,
    });
    g.appendChild(bar);
  } else {
    // Binned: contiguous class swatches, square-cornered (Datawrapper-style).
    for (const bin of legend.bins) {
      const rect = createSVGElement('rect');
      rect.setAttribute('class', 'oc-legend-bin');
      setAttrs(rect, {
        x: bin.x,
        y: legend.bar.y,
        width: bin.width,
        height: legend.bar.height,
        fill: bin.color,
      });
      g.appendChild(rect);
    }
  }

  for (const tick of legend.ticks) {
    const label = createSVGElement('text');
    setAttrs(label, { x: tick.x, y: legend.labelY, 'text-anchor': tick.anchor });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = tick.label;
    g.appendChild(label);
  }

  parent.appendChild(g);
}

export function renderLegend(parent: SVGElement, legend: LegendLayout): void {
  if (legend.type === 'continuous') {
    renderContinuousLegend(parent, legend);
    return;
  }
  if (!isCategorical(legend) || legend.entries.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend');
  g.setAttribute('role', 'list');
  g.setAttribute('aria-label', 'Chart legend');

  const isHorizontal = legend.position === 'top' || legend.position === 'bottom';
  const positions = 'entryPositions' in legend ? legend.entryPositions : undefined;
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];

    const pos = positions?.[i];
    if (pos) {
      offsetX = pos.x;
      offsetY = pos.y;
    } else if (isHorizontal && i > 0) {
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

    if (!pos) {
      if (isHorizontal) {
        const labelWidth = estimateTextWidth(
          entry.label,
          legend.labelStyle.fontSize,
          legend.labelStyle.fontWeight,
        );
        const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
        offsetX += entryWidth;
      } else {
        offsetY +=
          'rowHeight' in legend && legend.rowHeight
            ? legend.rowHeight
            : legend.swatchSize + legend.entryGap;
      }
    }
  }

  parent.appendChild(g);
}
