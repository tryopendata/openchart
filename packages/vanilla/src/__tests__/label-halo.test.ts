/**
 * Knockout halos on mark labels and annotation labels.
 *
 * The halo is cut in the theme's resolved *surface* color, not
 * `theme.colors.background` -- that defaults to `'transparent'`, which made
 * every knockout a no-op on a default-theme chart.
 */

import type { ChartSpec, CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { renderChartSVG } from '../svg-renderer';

const COMPILE_OPTS: CompileOptions = { width: 600, height: 400 };

function render(spec: ChartSpec) {
  const container = createContainer(COMPILE_OPTS.width, COMPILE_OPTS.height);
  renderChartSVG(compileChart(spec, COMPILE_OPTS), container);
  return container;
}

const COLUMN_DATA = [
  { category: 'A', value: 10 },
  { category: 'B', value: 30 },
  { category: 'C', value: 20 },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mark label halo', () => {
  it('cuts an opaque halo behind a column label floating above the bar', () => {
    const container = render({
      mark: 'bar',
      data: COLUMN_DATA,
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      labels: true,
    });

    const label = container.querySelector('.oc-mark-label');
    expect(label).toBeTruthy();
    expect(label!.getAttribute('paint-order')).toBe('stroke');
    const stroke = label!.getAttribute('stroke');
    expect(stroke).toBeTruthy();
    expect(stroke).not.toBe('transparent');
    expect(label!.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('scales the halo width with the label font size', () => {
    for (const [fontSize, strokeWidth] of [
      [14, '4'],
      [10, '3'],
    ] as const) {
      const container = render({
        mark: 'bar',
        data: COLUMN_DATA,
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
        labels: { fontSize },
      });

      const label = container.querySelector('.oc-mark-label');
      expect(label).toBeTruthy();
      expect(label!.getAttribute('stroke-width')).toBe(strokeWidth);
    }
  });

  it('leaves a stacked (inside) label unhaloed', () => {
    const container = render({
      mark: 'bar',
      data: [
        { category: 'A', series: 'x', value: 40 },
        { category: 'A', series: 'y', value: 40 },
        { category: 'B', series: 'x', value: 30 },
        { category: 'B', series: 'y', value: 30 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', stack: true },
        color: { field: 'series', type: 'nominal' },
      },
      labels: true,
    });

    const labels = [...container.querySelectorAll('.oc-mark-label')];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.getAttribute('paint-order')).toBeNull();
      expect(label.getAttribute('stroke')).toBeNull();
    }
  });
});

describe('annotation label halo', () => {
  it('cuts an opaque halo behind a refline label under the default theme', () => {
    const container = render({
      mark: 'line',
      data: [
        { date: '2020-01-01', value: 10 },
        { date: '2020-02-01', value: 30 },
        { date: '2020-03-01', value: 20 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
      annotations: [{ type: 'refline', y: 20, label: 'avg: 20' }],
    });

    const label = container.querySelector('.oc-annotation-label') as SVGElement | null;
    expect(label).toBeTruthy();
    expect(label!.getAttribute('paint-order')).toBe('stroke');
    const stroke = label!.getAttribute('stroke');
    expect(stroke).toBeTruthy();
    expect(stroke).not.toBe('transparent');
    expect(label!.getAttribute('stroke-linejoin')).toBe('round');
  });
});
