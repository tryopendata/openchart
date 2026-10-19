import type { ContinuousLegendLayout } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { renderLegend } from '../renderers/legend';

it('paints engine-measured map caption rows once at their resolved positions', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const style = {
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 400,
    fill: '#222',
    lineHeight: 1.3,
  };
  const key: ContinuousLegendLayout = {
    type: 'continuous',
    mode: 'binned',
    position: 'top',
    bounds: { x: 20, y: 30, width: 350, height: 180 },
    labelStyle: style,
    bar: { x: 20, y: 110, width: 220, height: 32 },
    bins: [{ x: 20, width: 220, color: '#f7f7f7' }],
    colorStops: [],
    ticks: [],
    labelY: 170,
    title: 'Rate change',
    titleY: 54,
    textRows: [
      { text: 'Rate change', x: 20, y: 54, style, role: 'title' },
      { text: 'percentage points', x: 20, y: 88, style, role: 'unit' },
      { text: 'Near zero: −2.5 to <2.5', x: 20, y: 200, style, role: 'context' },
    ],
  };
  renderLegend(svg, key);
  expect(svg.querySelectorAll('.oc-legend-title')).toHaveLength(1);
  expect(svg.querySelector('.oc-legend-unit')?.textContent).toBe('percentage points');
  expect(svg.querySelector('.oc-legend-context')?.getAttribute('y')).toBe('200');
  expect(svg.textContent).toContain('Near zero: −2.5 to <2.5');
});
