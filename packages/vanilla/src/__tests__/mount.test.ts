import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createChart', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates an SVG element in the container', () => {
    const chart = createChart(container, lineSpec);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toBe('viz-chart');

    chart.destroy();
  });

  it('SVG has correct viewBox dimensions', () => {
    const chart = createChart(container, lineSpec);

    const svg = container.querySelector('svg');
    const viewBox = svg?.getAttribute('viewBox');
    expect(viewBox).toBe('0 0 600 400');

    chart.destroy();
  });

  it('chrome text elements are present with correct content', () => {
    const chart = createChart(container, lineSpec);

    const title = container.querySelector('.viz-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('GDP Growth');

    const subtitle = container.querySelector('.viz-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toBe('US vs UK over time');

    const source = container.querySelector('.viz-source');
    expect(source).not.toBeNull();
    expect(source?.textContent).toBe('World Bank');

    chart.destroy();
  });

  it('update() re-renders with new data', () => {
    const chart = createChart(container, lineSpec);

    const titleBefore = container.querySelector('.viz-title');
    expect(titleBefore?.textContent).toBe('GDP Growth');

    chart.update(barSpec);

    const titleAfter = container.querySelector('.viz-title');
    expect(titleAfter?.textContent).toBe('Updated Chart');

    chart.destroy();
  });

  it('destroy() removes all DOM elements and disconnects observer', () => {
    const chart = createChart(container, lineSpec);

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    chart.destroy();

    const svgAfter = container.querySelector('svg');
    expect(svgAfter).toBeNull();

    // Tooltip div should also be removed
    const tooltip = container.querySelector('.viz-tooltip');
    expect(tooltip).toBeNull();
  });

  it('has accessible ARIA attributes on the SVG', () => {
    const chart = createChart(container, lineSpec);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('Line chart');

    chart.destroy();
  });

  it('layout property returns the compiled layout', () => {
    const chart = createChart(container, lineSpec);

    expect(chart.layout).toBeDefined();
    expect(chart.layout.dimensions.width).toBe(600);
    expect(chart.layout.dimensions.height).toBe(400);
    expect(chart.layout.chrome.title?.text).toBe('GDP Growth');

    chart.destroy();
  });

  it('export("svg") returns a valid SVG string', () => {
    const chart = createChart(container, lineSpec);

    const svgString = chart.export('svg');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('viewBox');
    expect(svgString).toContain('GDP Growth');

    chart.destroy();
  });

  it('export("csv") returns CSV data', () => {
    const chart = createChart(container, lineSpec);

    const csv = chart.export('csv');
    expect(csv).toContain('date');
    expect(csv).toContain('value');
    expect(csv).toContain('country');

    chart.destroy();
  });

  it('renders axis elements', () => {
    const chart = createChart(container, lineSpec);

    const xAxis = container.querySelector('.viz-axis-x');
    const yAxis = container.querySelector('.viz-axis-y');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();

    chart.destroy();
  });

  it('renders chrome wrapper group', () => {
    const chart = createChart(container, lineSpec);

    const chromeGroup = container.querySelector('.viz-chrome');
    expect(chromeGroup).not.toBeNull();

    chart.destroy();
  });

  it('passes responsive option to skip resize observer', () => {
    // Should not throw with responsive: false
    const chart = createChart(container, lineSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    chart.destroy();
  });

  it('renders marks with data-mark-id attributes for data points', () => {
    const chart = createChart(container, barSpec);

    const marks = container.querySelectorAll('[data-mark-id]');
    // barSpec has 3 data points, each should produce a mark
    expect(marks.length).toBe(3);

    for (const mark of marks) {
      const id = mark.getAttribute('data-mark-id');
      expect(id).toMatch(/^rect-\d+$/);
    }

    chart.destroy();
  });

  it('multi-series marks have data-series attributes', () => {
    const chart = createChart(container, lineSpec);

    const marks = container.querySelectorAll('[data-series]');
    expect(marks.length).toBeGreaterThan(0);

    const seriesNames = new Set<string>();
    for (const mark of marks) {
      const series = mark.getAttribute('data-series');
      expect(series).not.toBeNull();
      seriesNames.add(series!);
    }
    // lineSpec has US and UK series
    expect(seriesNames.has('US')).toBe(true);
    expect(seriesNames.has('UK')).toBe(true);

    chart.destroy();
  });
});

describe('resize observer integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resize() re-renders the chart', () => {
    const chart = createChart(container, lineSpec);

    // Should not throw
    chart.resize();

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    chart.destroy();
  });
});
