import type { ChartLayout } from '@opendata-ai/openchart-core';
import { legendGap } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAutoHeightContainer, createContainer } from '../__test-fixtures__/dom';
import {
  barSpec,
  lineSpec,
  longChromeLineSpec,
  singleSeriesLineSpec,
} from '../__test-fixtures__/specs';
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
    expect(svg?.getAttribute('class')).toBe('oc-chart');

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

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('GDP Growth');

    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toBe('US vs UK over time');

    const source = container.querySelector('.oc-source');
    expect(source).not.toBeNull();
    expect(source?.textContent).toBe('World Bank');

    chart.destroy();
  });

  it('update() re-renders with new data', () => {
    const chart = createChart(container, lineSpec);

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('GDP Growth');

    chart.update(barSpec);

    const titleAfter = container.querySelector('.oc-title');
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
    const tooltip = container.querySelector('.oc-tooltip');
    expect(tooltip).toBeNull();
  });

  it('has accessible ARIA attributes on the SVG', () => {
    const chart = createChart(container, lineSpec);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('Line chart');

    chart.destroy();
  });

  it('a11y.description overrides the SVG aria-label', () => {
    const chart = createChart(container, {
      ...lineSpec,
      a11y: { description: 'GDP growth for US and UK.' },
    });

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('GDP growth for US and UK.');

    chart.destroy();
  });

  it('a11y.hidden removes the chart from the accessibility tree', () => {
    const chart = createChart(container, { ...lineSpec, a11y: { hidden: true } });

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBeNull();
    // No screen-reader table, no keyboard tab stop
    expect(container.querySelector('.oc-sr-only')).toBeNull();
    expect(container.getAttribute('tabindex')).toBeNull();

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

    const xAxis = container.querySelector('.oc-axis-x');
    const yAxis = container.querySelector('.oc-axis-y');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();

    chart.destroy();
  });

  it('renders chrome wrapper group', () => {
    const chart = createChart(container, lineSpec);

    const chromeGroup = container.querySelector('.oc-chrome');
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

  it('does NOT stamp data-display on default (full) charts', () => {
    const chart = createChart(container, lineSpec);
    const svg = container.querySelector('svg');
    expect(svg?.hasAttribute('data-display')).toBe(false);
    chart.destroy();
  });

  it('stamps data-display="sparkline" when display is sparkline', () => {
    const chart = createChart(container, {
      mark: 'line',
      data: lineSpec.data,
      encoding: lineSpec.encoding,
      display: 'sparkline',
    });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-display')).toBe('sparkline');
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

describe('auto-height container growth', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** The chrome/legend/metrics blocks the mount grows the figure by. */
  function overheadsOf(layout: ChartLayout, width: number): number {
    const topLegendBlock =
      layout.legend.position === 'top' &&
      'entries' in layout.legend &&
      layout.legend.entries.length > 0
        ? layout.legend.bounds.height + legendGap(width)
        : 0;
    return (
      layout.chrome.topHeight +
      layout.chrome.bottomHeight +
      topLegendBlock +
      (layout.metrics?.height ?? 0)
    );
  }

  it('grows the figure beyond the 400px budget by the measured overheads', () => {
    const container = createAutoHeightContainer(390);
    const chart = createChart(container, longChromeLineSpec);

    const height = chart.layout.dimensions.height;
    expect(height).toBeGreaterThan(400);
    expect(height).toBeCloseTo(400 + overheadsOf(chart.layout, 390), 5);

    // The rendered SVG is sized to the grown figure, not the 400 fallback.
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 390 ${height}`);
    expect((svg as SVGElement).style.height).toBe(`${height}px`);

    chart.destroy();
  });

  it('keeps explicit-height containers at the host height', () => {
    const container = createContainer(390, 500);
    const chart = createChart(container, longChromeLineSpec);

    // Host constrains the box; chrome must fit inside it, not grow it.
    expect(chart.layout.dimensions.height).toBe(500);

    chart.destroy();
  });

  it('re-renders against the 400 budget, not the grown height (no re-pin)', () => {
    const container = createAutoHeightContainer(390);
    const chart = createChart(container, longChromeLineSpec);

    const grownHeight = chart.layout.dimensions.height;
    expect(grownHeight).toBeGreaterThan(400);

    // Same spec again: the container now measures at the grown SVG height,
    // but the latched-auto mount keeps compiling against the 400 budget, so
    // the figure height is stable.
    chart.update(longChromeLineSpec);
    expect(chart.layout.dimensions.height).toBe(grownHeight);

    // Shorter chrome: the figure must shrink toward the budget instead of
    // staying pinned at the previously grown container height.
    chart.update(singleSeriesLineSpec);
    const shrunkHeight = chart.layout.dimensions.height;
    expect(shrunkHeight).toBeLessThan(grownHeight);
    expect(shrunkHeight).toBeCloseTo(400 + overheadsOf(chart.layout, 390), 5);

    chart.destroy();
  });

  it('does not grow sparkline mounts', () => {
    const container = createAutoHeightContainer(200);
    const chart = createChart(container, {
      mark: 'line',
      data: lineSpec.data,
      encoding: lineSpec.encoding,
      display: 'sparkline',
    });

    // Sparkline auto-height fallback stays at the tiny 40px default.
    expect(chart.layout.dimensions.height).toBe(40);

    chart.destroy();
  });
});
