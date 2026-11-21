/**
 * Spotlight/highlight update transitions: verifies that line stroke-width,
 * stacked-area fill-opacity and seam stroke-width, faceted multi-panel marks,
 * and entering endpoint labels all interpolate smoothly instead of snapping.
 */
import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createChart } from '../mount';

const DATA = [
  { year: '2020', source: 'Gas', share: 41.3 },
  { year: '2023', source: 'Gas', share: 43.5 },
  { year: '2020', source: 'Coal', share: 19.6 },
  { year: '2023', source: 'Coal', share: 16.2 },
  { year: '2020', source: 'Nuclear', share: 20.1 },
  { year: '2023', source: 'Nuclear', share: 18.6 },
];

const SPRING_UPDATE = {
  enter: false as const,
  update: { spring: { stiffness: 1100, damping: 67, mass: 1 } },
};

function makeContainer(): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 640, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe('highlight update transitions', () => {
  it('smoothly tweens stacked area fill-opacity and seam stroke-width when spotlight changes', () => {
    const container = makeContainer();
    const specFor = (highlight: string): ChartSpec => ({
      mark: 'area',
      data: DATA,
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative', stack: 'normalize' },
        color: { field: 'source', type: 'nominal', highlight: [highlight] },
      },
      animation: SPRING_UPDATE,
    });

    const chart = createChart(container, specFor('Coal'), { autoResize: false });
    const handle = chart.beginManualUpdate(specFor('Gas'));
    expect(handle).not.toBeNull();
    expect(handle!.totalMs).toBeGreaterThanOrEqual(300);
    expect(handle!.totalMs).toBeLessThanOrEqual(500);

    const gasFill = () =>
      container.querySelector('.oc-mark-area[data-key="Gas"] path:not(.oc-area-top)');
    const gasTop = () => container.querySelector('.oc-mark-area[data-key="Gas"] path.oc-area-top');

    // Frame 0 starts from previous muted state (0.42 opacity, 1.5 seam width).
    expect(Number(gasFill()?.getAttribute('fill-opacity'))).toBeCloseTo(0.42, 2);
    expect(Number(gasTop()?.getAttribute('stroke-width'))).toBeCloseTo(1.5, 2);

    // Mid-transition is strictly between 0.42 and 0.92 (no snap).
    handle!.step(100);
    const midOpacity = Number(gasFill()?.getAttribute('fill-opacity'));
    expect(midOpacity).toBeGreaterThan(0.5);
    expect(midOpacity).toBeLessThan(0.9);

    // Settled state lands on exact highlighted target.
    handle!.step(handle!.totalMs);
    expect(Number(gasFill()?.getAttribute('fill-opacity'))).toBeCloseTo(0.92, 2);
    expect(Number(gasTop()?.getAttribute('stroke-width'))).toBeCloseTo(1, 2);

    handle!.cancel();
    chart.destroy();
    container.remove();
  });

  it('smoothly tweens line stroke-width and fades in entering endpoint labels', () => {
    const container = makeContainer();
    const specFor = (highlight: string): ChartSpec => ({
      mark: { type: 'line', strokeWidth: 2 },
      data: DATA,
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal', highlight: [highlight] },
      },
      endpointLabels: { content: 'label' },
      animation: SPRING_UPDATE,
    });

    const chart = createChart(container, specFor('Coal'), { autoResize: false });
    const handle = chart.beginManualUpdate(specFor('Gas'));
    expect(handle).not.toBeNull();

    const gasPath = () => container.querySelector('.oc-mark-line[data-key="Gas"] path');
    const gasLabel = () =>
      container.querySelector('[data-endpoint-key="Gas"]') as SVGElement | null;

    // Starts at muted line width (1.5) and opacity 0 for the entering endpoint label.
    expect(Number(gasPath()?.getAttribute('stroke-width'))).toBeCloseTo(1.5, 2);
    expect(Number(gasLabel()?.style.opacity)).toBe(0);

    handle!.step(100);
    const midWidth = Number(gasPath()?.getAttribute('stroke-width'));
    expect(midWidth).toBeGreaterThan(1.55);
    expect(midWidth).toBeLessThan(1.98);
    expect(Number(gasLabel()?.style.opacity)).toBeGreaterThan(0.2);

    handle!.step(handle!.totalMs);
    expect(Number(gasPath()?.getAttribute('stroke-width'))).toBeCloseTo(2, 2);
    expect(gasLabel()?.style.opacity).toBe('');

    handle!.cancel();
    chart.destroy();
    container.remove();
  });

  it('tweens marks across all facet panels, not only the first panel', () => {
    const container = makeContainer();
    const specFor = (highlight: string): ChartSpec => ({
      mark: { type: 'line', strokeWidth: 2 },
      data: DATA,
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal', highlight: [highlight] },
        facet: { field: 'source', type: 'nominal', columns: 3, sort: null },
      },
      legend: { show: false },
      animation: SPRING_UPDATE,
    });

    const chart = createChart(container, specFor('Gas'), { autoResize: false });
    const handle = chart.beginManualUpdate(specFor('Nuclear'));
    expect(handle).not.toBeNull();

    // Nuclear lives in panel 3 (not panel 1), so its stroke-width must start at 1.5 and tween to 2.
    const nuclearPath = () => container.querySelector('.oc-mark-line[data-key="Nuclear"] path');
    expect(Number(nuclearPath()?.getAttribute('stroke-width'))).toBeCloseTo(1.5, 2);

    handle!.step(100);
    const midWidth = Number(nuclearPath()?.getAttribute('stroke-width'));
    expect(midWidth).toBeGreaterThan(1.55);
    expect(midWidth).toBeLessThan(1.98);

    handle!.step(handle!.totalMs);
    expect(Number(nuclearPath()?.getAttribute('stroke-width'))).toBeCloseTo(2, 2);

    handle!.cancel();
    chart.destroy();
    container.remove();
  });
});
