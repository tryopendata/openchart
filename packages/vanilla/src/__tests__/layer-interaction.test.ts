import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

afterEach(() => {
  document.body.innerHTML = '';
});

function leaf(
  mark: ChartSpec['mark'],
  name: string,
  value: number,
  format: string,
  zIndex: number,
): ChartSpec {
  return {
    mark,
    zIndex,
    animation: false,
    data: [
      { id: 'same-key', series: 'Shared', name, x: 1, value },
      ...(mark === 'point' ? [] : [{ id: 'next-key', series: 'Shared', name, x: 2, value }]),
    ],
    encoding: {
      key: { field: 'id', type: 'nominal' },
      x: { field: 'x', type: mark === 'point' ? 'quantitative' : 'ordinal' },
      y: { field: 'value', type: 'quantitative', stack: null },
      color: { field: 'series', type: 'nominal' },
      tooltip: [{ field: 'value', type: 'quantitative', title: name, format }],
    },
  };
}

describe('inspection of real layered charts', () => {
  it.each([
    'shared',
    'independent',
  ] as const)('shows exact leaf formatting on hover and keyboard with %s scales', (scale) => {
    const container = createContainer();
    const spec: LayerSpec = {
      layer: [leaf('point', 'Revenue', 1250, '$,.0f', 1), leaf('point', 'Share', 0.25, '.0%', 0)],
      resolve: { scale: { y: scale } },
    };
    const clicked: unknown[] = [];
    const chart = createChart(container, spec, {
      onMarkClick: (event) => clicked.push(event.datum.name),
    });
    try {
      const marks = [...container.querySelectorAll('.oc-marks [data-mark-id]')];
      expect(marks).toHaveLength(2);
      for (const [index, expected] of ['25%', '$1,250'].entries()) {
        marks[index].dispatchEvent(createMouseEvent('mouseenter'));
        expect(container.querySelector('[role="tooltip"]')?.textContent).toContain(expected);
        marks[index].dispatchEvent(createMouseEvent('click'));
        marks[index].dispatchEvent(createMouseEvent('mouseleave'));
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(container.querySelector('[role="tooltip"]')?.textContent).toContain(expected);
      }
      expect(clicked).toEqual(['Share', 'Revenue']);
    } finally {
      chart.destroy();
    }
  });

  it.each([
    'line',
    'area',
  ] as const)('dispatches each %s leaf with the same series name to its own observation', (mark) => {
    const container = createContainer();
    const clicked: unknown[] = [];
    const chart = createChart(
      container,
      {
        layer: [{ layer: [leaf(mark, 'First', 10, '.0f', 1)] }, leaf(mark, 'Second', 20, '.0f', 0)],
      },
      { onMarkClick: (event) => clicked.push({ name: event.datum.name, series: event.series }) },
    );
    try {
      const marks = [...container.querySelectorAll(`.oc-mark-${mark}`)];
      expect(marks).toHaveLength(2);
      expect(new Set(marks.map((element) => element.getAttribute('data-mark-id'))).size).toBe(2);
      for (const element of marks) element.dispatchEvent(createMouseEvent('click'));
      expect(clicked).toEqual([
        { name: 'Second', series: 'Shared' },
        { name: 'First', series: 'Shared' },
      ]);
    } finally {
      chart.destroy();
    }
  });

  it.each([
    'line',
    'area',
  ] as const)('inspects both %s layers with repeated series names through the shared crosshair', (mark) => {
    const container = createContainer();
    const chart = createChart(container, {
      layer: [leaf(mark, 'Revenue', 1250, '$,.0f', 1), leaf(mark, 'Share', 0.25, '.0%', 0)],
    });
    try {
      const tooltip = container.querySelector('[role="tooltip"]')!;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(tooltip.textContent).toContain('25%');
      expect(tooltip.textContent).toContain('$1,250');
      expect(tooltip.textContent).toContain('Shared · Share');
      expect(tooltip.textContent).toContain('Shared · Revenue');
      expect(container.querySelectorAll('[data-snap-dots] circle')).toHaveLength(2);
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(tooltip.querySelectorAll('.oc-tooltip-row--emphasis')).toHaveLength(1);
      expect(tooltip.querySelector('.oc-tooltip-row--emphasis')?.textContent).toContain('25%');
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(tooltip.querySelectorAll('.oc-tooltip-row--emphasis')).toHaveLength(1);
      expect(tooltip.querySelector('.oc-tooltip-row--emphasis')?.textContent).toContain('$1,250');
      const line = chart.layout.marks.find(
        (item) => item.type === mark && item.data[0].name === 'Share',
      );
      if (!line || (line.type !== 'line' && line.type !== 'area') || !line.dataPoints?.length)
        throw new Error('Missing share series');
      const point = line.dataPoints[0];
      container
        .querySelector('[data-voronoi-overlay]')!
        .dispatchEvent(createMouseEvent('mousemove', point.x, point.y));
      expect(tooltip.querySelector('.oc-tooltip-row--emphasis')?.textContent).toContain('25%');
    } finally {
      chart.destroy();
    }
  });
});
