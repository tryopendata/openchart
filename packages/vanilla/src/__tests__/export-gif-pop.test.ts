/**
 * GIF frames for the pop entrances: line points, grid cells and pie slices
 * fade and scale on their keyframe, points and cells keep the inline scale
 * origin the renderer stamps (GIF clones carry no animation CSS), and the
 * settled frame leaves no frame-written state behind.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createFrameSampler } from '../export-gif';
import { renderChartSVG } from '../svg-renderer';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const lineWithPoints = {
  mark: { type: 'line', point: true },
  data: MONTHS.map((m, i) => ({ month: m, value: 10 + i * 5 })),
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
  },
  animation: true,
} as ChartSpec;

const heatmap = {
  mark: 'rect',
  data: ['Mon', 'Tue', 'Wed'].flatMap((day, d) =>
    ['9am', '1pm', '5pm'].map((hour, h) => ({ day, hour, visits: d * 3 + h })),
  ),
  encoding: {
    x: { field: 'hour', type: 'nominal' },
    y: { field: 'day', type: 'nominal' },
    color: { field: 'visits', type: 'quantitative' },
  },
  animation: true,
} as ChartSpec;

const donut = {
  mark: { type: 'arc', innerRadius: 60 },
  data: [
    { category: 'A', value: 5 },
    { category: 'B', value: 3 },
    { category: 'C', value: 2 },
  ],
  encoding: {
    theta: { field: 'value', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  animation: true,
} as ChartSpec;

afterEach(() => {
  document.body.innerHTML = '';
});

function sample(spec: ChartSpec, selector: string, pin?: (el: SVGElement) => void) {
  const layout = compileChart(spec, { width: 600, height: 400 });
  const svg = renderChartSVG(layout, createContainer(), { animate: true });
  const els = Array.from(svg.querySelectorAll<SVGElement>(selector));
  expect(els.length).toBeGreaterThan(0);
  // Lane 2/a stamps the origin in the renderer; pin one here so this test
  // holds the GIF path to keeping whatever origin the element carries.
  if (pin) for (const el of els) pin(el);
  const origins = els.map((el) => el.style.getPropertyValue('transform-origin'));
  const sampler = createFrameSampler(svg, layout.animation);
  return { els, origins, sampler };
}

function expectMidFramePop(
  els: SVGElement[],
  origins: string[],
  sampler: ReturnType<typeof createFrameSampler>,
) {
  const seen = els.map(() => false);
  for (let ms = 0; ms <= sampler.endMs; ms += 10) {
    sampler.apply(ms);
    els.forEach((el, i) => {
      const opacity = Number(el.style.opacity);
      if (opacity > 0 && opacity < 1 && el.style.transform.startsWith('scale(')) seen[i] = true;
      expect(el.style.getPropertyValue('transform-origin')).toBe(origins[i]);
    });
  }
  expect(seen.every(Boolean)).toBe(true);
  sampler.apply(null);
  els.forEach((el, i) => {
    expect(el.style.transform).toBe('');
    expect(el.style.opacity).toBe('');
    expect(el.style.getPropertyValue('transform-origin')).toBe(origins[i]);
  });
}

describe('GIF pop entrances', () => {
  it('line points fade and scale about their stamped origin', () => {
    const { els, origins, sampler } = sample(lineWithPoints, 'circle.oc-mark-point', (el) =>
      el.style.setProperty(
        'transform-origin',
        `${el.getAttribute('cx')}px ${el.getAttribute('cy')}px`,
      ),
    );
    expectMidFramePop(els, origins, sampler);
  });

  it('grid cells fade and scale about their stamped origin', () => {
    const { els, origins, sampler } = sample(
      heatmap,
      '.oc-mark-rect[data-cell] :is(rect, path)',
      (el) => el.style.setProperty('transform-origin', '10px 20px'),
    );
    expectMidFramePop(els, origins, sampler);
  });

  it('donut slice paths fade and scale with no origin of their own', () => {
    const { els, origins, sampler } = sample(donut, '.oc-mark-arc > path');
    expect(origins.every((o) => o === '')).toBe(true);
    expectMidFramePop(els, origins, sampler);
  });
});
