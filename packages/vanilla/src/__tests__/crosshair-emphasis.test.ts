/**
 * Crosshair slice tooltip: series emphasis by pointer proximity, the stack
 * total row, and keyboard navigation through the snap positions.
 */

import type { LineMark } from '@opendata-ai/openchart-core';
import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const multiLineSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2022-01-01', value: 60, country: 'US' },
    { date: '2020-01-01', value: 90, country: 'UK' },
    { date: '2021-01-01', value: 95, country: 'UK' },
    { date: '2022-01-01', value: 99, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  crosshair: true,
};

/**
 * happy-dom has no layout engine: make the SVG report a rect that matches its
 * viewBox so client coordinates and SVG user units are the same number.
 */
function mockSvgRect(container: HTMLElement, width = 600, height = 400): SVGElement {
  const svg = container.querySelector('svg') as SVGElement;
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  return svg;
}

function rowsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.oc-tooltip-row'));
}

describe('crosshair emphasis', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('raises only the series the pointer is within 18px of', () => {
    const chart = createChart(container, multiLineSpec);
    const svg = mockSvgRect(container);
    const overlay = svg.querySelector('[data-voronoi-overlay]')!;

    const us = chart.layout.marks.find(
      (m) => m.type === 'line' && m.seriesKey === 'US',
    ) as LineMark;
    const point = us.dataPoints![1];

    overlay.dispatchEvent(createMouseEvent('mousemove', point.x, point.y));
    const marks = Array.from(container.querySelectorAll('.oc-marks .oc-mark'));
    expect(marks.some((m) => m.classList.contains('oc-mark--dim'))).toBe(true);
    const emphasized = rowsOf(container).filter((r) =>
      r.classList.contains('oc-tooltip-row--emphasis'),
    );
    expect(emphasized.length).toBe(1);
    expect(emphasized[0].textContent).toContain('US');

    chart.destroy();
  });

  it('shows the slice with nothing dimmed when the pointer is far from every line', () => {
    const chart = createChart(container, multiLineSpec);
    const svg = mockSvgRect(container);
    const overlay = svg.querySelector('[data-voronoi-overlay]')!;

    const us = chart.layout.marks.find(
      (m) => m.type === 'line' && m.seriesKey === 'US',
    ) as LineMark;
    const uk = chart.layout.marks.find(
      (m) => m.type === 'line' && m.seriesKey === 'UK',
    ) as LineMark;
    // Halfway between the two series at the same x: >18px from both.
    const midY = (us.dataPoints![1].y + uk.dataPoints![1].y) / 2;
    expect(Math.abs(us.dataPoints![1].y - midY)).toBeGreaterThan(18);

    overlay.dispatchEvent(createMouseEvent('mousemove', us.dataPoints![1].x, midY));

    const marks = Array.from(container.querySelectorAll('.oc-marks .oc-mark'));
    expect(marks.some((m) => m.classList.contains('oc-mark--dim'))).toBe(false);
    expect(container.querySelector('.oc-tooltip-row--emphasis')).toBeNull();
    // The tooltip is still there; only the emphasis is withheld.
    expect(rowsOf(container).length).toBe(2);

    chart.destroy();
  });

  it('steps through snap positions with the arrow keys', () => {
    const chart = createChart(container, multiLineSpec);
    mockSvgRect(container);

    const crosshair = container.querySelector('[data-crosshair]') as SVGLineElement;
    expect(crosshair.style.display).toBe('none');

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(crosshair.style.display).toBe('');
    const firstX = crosshair.getAttribute('x1');

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(crosshair.getAttribute('x1')).not.toBe(firstX);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(crosshair.style.display).toBe('none');

    chart.destroy();
  });

  it('ArrowRight resumes from where the pointer left the chart', () => {
    const chart = createChart(container, multiLineSpec);
    const svg = mockSvgRect(container);
    const overlay = svg.querySelector('[data-voronoi-overlay]')!;
    const crosshair = container.querySelector('[data-crosshair]') as SVGLineElement;

    const us = chart.layout.marks.find(
      (m) => m.type === 'line' && m.seriesKey === 'US',
    ) as LineMark;
    const middle = us.dataPoints![1];
    const last = us.dataPoints![2];

    overlay.dispatchEvent(createMouseEvent('mousemove', middle.x, middle.y));
    expect(crosshair.getAttribute('x1')).toBe(String(Math.round(middle.x)));
    overlay.dispatchEvent(createMouseEvent('mouseleave', middle.x, middle.y));

    // Not back to the first x: the crosshair owns the index, so the keyboard
    // picks up one step past wherever the pointer was.
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(crosshair.getAttribute('x1')).toBe(String(Math.round(last.x)));

    chart.destroy();
  });

  it('hides the crosshair when the container loses focus', () => {
    const chart = createChart(container, multiLineSpec);
    mockSvgRect(container);
    const crosshair = container.querySelector('[data-crosshair]') as SVGLineElement;

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(crosshair.style.display).toBe('');

    container.dispatchEvent(new FocusEvent('blur'));
    expect(crosshair.style.display).toBe('none');

    // The index was reset with it, so the next ArrowRight starts over.
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const firstX = crosshair.getAttribute('x1');
    container.dispatchEvent(new FocusEvent('blur'));
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(crosshair.getAttribute('x1')).toBe(firstX);

    chart.destroy();
  });

  it('cycles the raised series at one x with ArrowDown', () => {
    const chart = createChart(container, multiLineSpec);
    mockSvgRect(container);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    const first = container.querySelector('.oc-tooltip-row--emphasis')!.textContent;
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const second = container.querySelector('.oc-tooltip-row--emphasis')!.textContent;
    expect(second).not.toBe(first);

    chart.destroy();
  });
});

describe('stacked area slice total', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const stackedAreaSpec: ChartSpec = {
    mark: 'area',
    data: [
      { date: '2020-01-01', value: 10, country: 'US' },
      { date: '2021-01-01', value: 40, country: 'US' },
      { date: '2020-01-01', value: 15, country: 'UK' },
      { date: '2021-01-01', value: 35, country: 'UK' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative', stack: 'zero' },
      color: { field: 'country', type: 'nominal' },
    },
  };

  it('ends the slice tooltip with a Total row', () => {
    const chart = createChart(container, stackedAreaSpec);
    const svg = mockSvgRect(container);
    const overlay = svg.querySelector('[data-voronoi-overlay]')!;

    const first = chart.layout.marks.find((m) => m.type === 'area')!;
    const point = (first as { dataPoints?: Array<{ x: number; y: number }> }).dataPoints![0];
    overlay.dispatchEvent(createMouseEvent('mousemove', point.x, point.y));

    const rows = rowsOf(container);
    const total = rows[rows.length - 1];
    expect(total.classList.contains('oc-tooltip-row--total')).toBe(true);
    expect(total.textContent).toContain('Total');
    expect(total.textContent).toContain('25');

    chart.destroy();
  });

  it('omits the Total row on a normalized stack', () => {
    const chart = createChart(container, {
      ...stackedAreaSpec,
      encoding: {
        ...stackedAreaSpec.encoding,
        y: { field: 'value', type: 'quantitative', stack: 'normalize' },
      },
    } as ChartSpec);
    const svg = mockSvgRect(container);
    const overlay = svg.querySelector('[data-voronoi-overlay]')!;

    const first = chart.layout.marks.find((m) => m.type === 'area')!;
    const point = (first as { dataPoints?: Array<{ x: number; y: number }> }).dataPoints![0];
    overlay.dispatchEvent(createMouseEvent('mousemove', point.x, point.y));

    expect(container.querySelector('.oc-tooltip-row--total')).toBeNull();

    chart.destroy();
  });
});
