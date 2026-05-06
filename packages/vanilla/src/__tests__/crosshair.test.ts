import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const lineSpecWithCrosshair: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  crosshair: true,
};

const lineSpecNoCrosshair: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('crosshair', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a crosshair line element when crosshair: true on a line chart', () => {
    const chart = createChart(container, lineSpecWithCrosshair);

    const crosshair = container.querySelector('[data-crosshair]');
    expect(crosshair).not.toBeNull();
    expect(crosshair?.tagName.toLowerCase()).toBe('line');
    expect(crosshair?.getAttribute('class')).toBe('oc-crosshair');

    chart.destroy();
  });

  it('crosshair is hidden initially (display: none)', () => {
    const chart = createChart(container, lineSpecWithCrosshair);

    const crosshair = container.querySelector('[data-crosshair]') as SVGLineElement;
    expect(crosshair).not.toBeNull();
    expect(crosshair.style.display).toBe('none');

    chart.destroy();
  });

  it('crosshair defaults to on for line charts (omitted spec)', () => {
    const chart = createChart(container, lineSpecNoCrosshair);

    const crosshair = container.querySelector('[data-crosshair]');
    expect(crosshair).not.toBeNull();

    chart.destroy();
  });

  it('does not create crosshair when explicitly disabled', () => {
    const chart = createChart(container, { ...lineSpecNoCrosshair, crosshair: false });

    const crosshair = container.querySelector('[data-crosshair]');
    expect(crosshair).toBeNull();

    chart.destroy();
  });

  it('does not create crosshair on bar chart (no voronoi overlay)', () => {
    const barWithCrosshair: ChartSpec = {
      ...barSpec,
      crosshair: true,
    };
    const chart = createChart(container, barWithCrosshair);

    const crosshair = container.querySelector('[data-crosshair]');
    expect(crosshair).toBeNull();

    chart.destroy();
  });

  it('crosshair has correct stroke attributes', () => {
    const chart = createChart(container, lineSpecWithCrosshair);

    const crosshair = container.querySelector('[data-crosshair]') as SVGLineElement;
    expect(crosshair).not.toBeNull();
    expect(crosshair.getAttribute('stroke-dasharray')).toBe('3,3');
    expect(crosshair.getAttribute('stroke-width')).toBe('1');
    expect(crosshair.getAttribute('pointer-events')).toBe('none');

    chart.destroy();
  });

  it('cleanup removes crosshair on destroy', () => {
    const chart = createChart(container, lineSpecWithCrosshair);

    expect(container.querySelector('[data-crosshair]')).not.toBeNull();

    chart.destroy();

    expect(container.querySelector('[data-crosshair]')).toBeNull();
  });
});
