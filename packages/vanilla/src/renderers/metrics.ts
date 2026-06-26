/**
 * KPI metric bar rendering. Emits a `<g class="oc-metrics">` group containing
 * a label/value pair per cell. Visual styling lives in `chrome.css`
 * (`.oc-metric-*` classes); this renderer only sets positions and structure.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { createSVGElement, setAttrs } from './svg-dom';

// Delta and secondary text run at a fraction of the primary value size. This
// preserves the editorial mock's proportion (12px delta against a 22px value)
// at any theme-driven value size, so scaling metricValue scales the whole cell.
const DELTA_SIZE_RATIO = 12 / 22;

export function renderMetrics(parent: SVGElement, layout: ChartLayout): void {
  const bar = layout.metrics;
  if (!bar || bar.cells.length === 0) return;

  // Font sizes flow from the theme. Set them inline so they override the CSS
  // defaults (.oc-metric-* in chrome.css) when a chart customizes the sizes.
  const labelSize = layout.theme.fonts.sizes.metricLabel;
  const valueSize = layout.theme.fonts.sizes.metricValue;
  const deltaSize = Math.round(valueSize * DELTA_SIZE_RATIO);

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-metrics');

  for (const cell of bar.cells) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-metric-label');
    setAttrs(label, { x: cell.x, y: cell.labelY, 'font-size': labelSize });
    label.textContent = cell.metric.label.toUpperCase();
    g.appendChild(label);

    const value = createSVGElement('text');
    value.setAttribute('class', 'oc-metric-value');
    setAttrs(value, { x: cell.x, y: cell.valueY, 'font-size': valueSize });
    value.textContent = cell.metric.value;

    if (cell.metric.delta) {
      const delta = createSVGElement('tspan');
      const tone = cell.metric.deltaTone ?? 'up';
      delta.setAttribute('class', tone === 'down' ? 'oc-metric-delta-down' : 'oc-metric-delta-up');
      delta.setAttribute('dx', '8');
      delta.setAttribute('font-size', String(deltaSize));
      delta.textContent = cell.metric.delta;
      value.appendChild(delta);
    }

    if (cell.metric.secondary) {
      const secondary = createSVGElement('tspan');
      secondary.setAttribute('class', 'oc-metric-secondary');
      secondary.setAttribute('dx', '6');
      secondary.setAttribute('font-size', String(deltaSize));
      secondary.textContent = cell.metric.secondary;
      value.appendChild(secondary);
    }

    g.appendChild(value);
  }

  parent.appendChild(g);
}
