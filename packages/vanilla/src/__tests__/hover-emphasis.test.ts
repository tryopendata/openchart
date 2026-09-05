/**
 * Hover emphasis: the two-register hover language (dim-the-rest on
 * multi-series charts, outline-only on single-series ones), its legend mirror,
 * and the guarantee that nothing survives a re-render.
 */

import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const multiSeriesColumnSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', value: 10, series: 'A' },
    { month: 'Jan', value: 12, series: 'B' },
    { month: 'Jan', value: 8, series: 'C' },
    { month: 'Feb', value: 14, series: 'A' },
    { month: 'Feb', value: 9, series: 'B' },
    { month: 'Feb', value: 11, series: 'C' },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  legend: { position: 'bottom' },
};

const singleSeriesColumnSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', value: 10 },
    { month: 'Feb', value: 14 },
    { month: 'Mar', value: 9 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

function marksOf(container: HTMLElement): SVGElement[] {
  return Array.from(container.querySelectorAll('.oc-marks .oc-mark')) as SVGElement[];
}

describe('hover emphasis', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    container.remove();
  });

  it('dims the other series when a mark of a multi-series chart is hovered', () => {
    const chart = createChart(container, multiSeriesColumnSpec);

    const marks = marksOf(container);
    const b = marks.find((m) => m.getAttribute('data-series') === 'B');
    expect(b).toBeDefined();
    b!.dispatchEvent(createMouseEvent('mouseenter'));

    expect(container.querySelector('.oc-marks')!.classList.contains('oc-hover-active')).toBe(true);
    for (const mark of marksOf(container)) {
      const series = mark.getAttribute('data-series');
      if (series === 'B') {
        expect(mark.classList.contains('oc-mark--hover')).toBe(true);
        expect(mark.classList.contains('oc-mark--dim')).toBe(false);
      } else {
        expect(mark.classList.contains('oc-mark--dim')).toBe(true);
      }
    }

    b!.dispatchEvent(createMouseEvent('mouseleave'));
    for (const mark of marksOf(container)) {
      expect(mark.classList.contains('oc-mark--dim')).toBe(false);
      expect(mark.classList.contains('oc-mark--hover')).toBe(false);
    }

    chart.destroy();
  });

  it('mirrors the emphasis onto the legend swatches', () => {
    const chart = createChart(container, multiSeriesColumnSpec);

    const b = marksOf(container).find((m) => m.getAttribute('data-series') === 'B')!;
    b.dispatchEvent(createMouseEvent('mouseenter'));

    const entries = Array.from(container.querySelectorAll('[data-legend-label]'));
    expect(entries.length).toBeGreaterThan(1);
    for (const entry of entries) {
      const match = entry.getAttribute('data-legend-label') === 'B';
      expect(entry.classList.contains('oc-legend-entry--hover')).toBe(match);
      expect(entry.classList.contains('oc-legend-entry--dim')).toBe(!match);
    }

    chart.destroy();
  });

  it('leaves a toggled-off legend entry alone', () => {
    const chart = createChart(container, { ...multiSeriesColumnSpec, hiddenSeries: ['C'] });

    const hidden = container.querySelector('[data-legend-label="C"]')!;
    expect(hidden.getAttribute('data-legend-active')).toBe('false');
    expect(hidden.getAttribute('opacity')).toBe('0.3');

    const b = marksOf(container).find((m) => m.getAttribute('data-series') === 'B')!;
    b.dispatchEvent(createMouseEvent('mouseenter'));

    expect(hidden.classList.contains('oc-legend-entry--dim')).toBe(false);
    expect(hidden.classList.contains('oc-legend-entry--hover')).toBe(false);
    expect(hidden.getAttribute('opacity')).toBe('0.3');

    chart.destroy();
  });

  it('outlines the hovered column on a single-series chart and dims nothing', () => {
    const chart = createChart(container, singleSeriesColumnSpec);

    const marks = marksOf(container);
    expect(marks.length).toBe(3);
    marks[0].dispatchEvent(createMouseEvent('mouseenter'));

    expect(marks[0].classList.contains('oc-mark--hover')).toBe(true);
    for (const mark of marks) {
      expect(mark.classList.contains('oc-mark--dim')).toBe(false);
    }

    chart.destroy();
  });

  it('drops all emphasis across an update()', () => {
    const chart = createChart(container, multiSeriesColumnSpec);
    const b = marksOf(container).find((m) => m.getAttribute('data-series') === 'B')!;
    b.dispatchEvent(createMouseEvent('mouseenter'));
    expect(marksOf(container).some((m) => m.classList.contains('oc-mark--dim'))).toBe(true);

    chart.update({
      ...multiSeriesColumnSpec,
      data: multiSeriesColumnSpec.data!.map((d) => ({
        ...d,
        value: (d as { value: number }).value + 1,
      })),
    });

    for (const mark of marksOf(container)) {
      expect(mark.classList.contains('oc-mark--dim')).toBe(false);
      expect(mark.classList.contains('oc-mark--hover')).toBe(false);
    }
    expect(container.querySelector('.oc-marks')!.classList.contains('oc-hover-active')).toBe(false);

    chart.destroy();
  });

  it('applies nothing in canvas mark mode', () => {
    const points = Array.from({ length: 1200 }, (_, i) => ({ x: i, y: (i * 7) % 100 }));
    const chart = createChart(container, {
      mark: 'point',
      data: points,
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
      animation: false,
      renderer: 'canvas',
    } as ChartSpec);

    const marksGroup = container.querySelector('.oc-marks');
    expect(marksGroup?.classList.contains('oc-hover-active')).toBe(false);

    chart.destroy();
  });
});

describe('legend entries as toggle buttons', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    container.remove();
  });

  it('toggles a series on Enter', () => {
    const chart = createChart(container, multiSeriesColumnSpec);

    const entry = container.querySelector('[data-legend-label="B"]')!;
    expect(entry.getAttribute('aria-pressed')).toBe('true');
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const after = container.querySelector('[data-legend-label="B"]')!;
    expect(after.getAttribute('aria-pressed')).toBe('false');

    chart.destroy();
  });

  it('dims the rest while a legend entry is hovered', () => {
    const chart = createChart(container, multiSeriesColumnSpec);

    const entry = container.querySelector('[data-legend-label="A"]')!;
    entry.dispatchEvent(createMouseEvent('mouseenter'));

    for (const mark of marksOf(container)) {
      const dim = mark.getAttribute('data-series') !== 'A';
      expect(mark.classList.contains('oc-mark--dim')).toBe(dim);
    }

    entry.dispatchEvent(createMouseEvent('mouseleave'));
    expect(marksOf(container).some((m) => m.classList.contains('oc-mark--dim'))).toBe(false);

    chart.destroy();
  });
});

describe('touch emphasis', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    container.remove();
  });

  it('lifts the emphasis when the tap ends', () => {
    const chart = createChart(container, multiSeriesColumnSpec);

    const marks = marksOf(container);
    const b = marks.find((m) => m.getAttribute('data-series') === 'B')!;
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y }) as Touch;

    b.dispatchEvent(
      new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch(50, 50)] }),
    );
    expect(container.querySelector('.oc-marks')!.classList.contains('oc-hover-active')).toBe(true);

    // There is no mouseleave on touch, so without a touchend handler every
    // other series stays dimmed for the rest of the session.
    b.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));

    expect(container.querySelector('.oc-marks')!.classList.contains('oc-hover-active')).toBe(false);
    for (const mark of marksOf(container)) {
      expect(mark.classList.contains('oc-mark--dim')).toBe(false);
      expect(mark.classList.contains('oc-mark--hover')).toBe(false);
    }

    chart.destroy();
  });
});
