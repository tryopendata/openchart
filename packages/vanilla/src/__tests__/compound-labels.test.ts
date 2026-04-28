import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const albumData = [
  { album: 'Abbey Road', artist: 'The Beatles', sales: 31 },
  { album: 'Thriller', artist: 'Michael Jackson', sales: 66 },
  { album: 'Back in Black', artist: 'AC/DC', sales: 50 },
];

const barWithLabelField: ChartSpec = {
  mark: 'bar',
  data: albumData,
  encoding: {
    x: { field: 'sales', type: 'quantitative' },
    y: {
      field: 'album',
      type: 'nominal',
      axis: { labelField: 'artist' },
    },
  },
};

const barWithoutLabelField: ChartSpec = {
  mark: 'bar',
  data: albumData,
  encoding: {
    x: { field: 'sales', type: 'quantitative' },
    y: { field: 'album', type: 'nominal' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compound axis labels rendering', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders tspan elements when subtitle is present', () => {
    const chart = createChart(container, barWithLabelField);

    const yAxisTicks = container.querySelectorAll('.oc-axis-y .oc-axis-tick');
    expect(yAxisTicks.length).toBeGreaterThan(0);

    // At least one tick should have tspan children (compound label)
    let hasTspan = false;
    for (const tick of yAxisTicks) {
      const tspans = tick.querySelectorAll('tspan');
      if (tspans.length > 0) {
        hasTspan = true;
        break;
      }
    }
    expect(hasTspan).toBe(true);

    chart.destroy();
  });

  it('primary tspan has the tick label font-weight', () => {
    const chart = createChart(container, barWithLabelField);

    const yAxisTicks = container.querySelectorAll('.oc-axis-y .oc-axis-tick');
    for (const tick of yAxisTicks) {
      const tspans = tick.querySelectorAll('tspan');
      if (tspans.length >= 2) {
        const primarySpan = tspans[0];
        const fontWeight = primarySpan.getAttribute('font-weight');
        expect(fontWeight).not.toBeNull();
      }
    }

    chart.destroy();
  });

  it('secondary tspan has normal weight (400) and reduced opacity', () => {
    const chart = createChart(container, barWithLabelField);

    const yAxisTicks = container.querySelectorAll('.oc-axis-y .oc-axis-tick');
    for (const tick of yAxisTicks) {
      const tspans = tick.querySelectorAll('tspan');
      if (tspans.length >= 2) {
        const subtitleSpan = tspans[1];
        expect(subtitleSpan.getAttribute('font-weight')).toBe('400');
        expect(subtitleSpan.getAttribute('fill-opacity')).toBe('0.6');
        expect(subtitleSpan.getAttribute('dx')).toBe('0.5em');
      }
    }

    chart.destroy();
  });

  it('renders plain textContent without tspans when labelField is omitted', () => {
    const chart = createChart(container, barWithoutLabelField);

    const yAxisTicks = container.querySelectorAll('.oc-axis-y .oc-axis-tick');
    expect(yAxisTicks.length).toBeGreaterThan(0);

    for (const tick of yAxisTicks) {
      const tspans = tick.querySelectorAll('tspan');
      // No tspan elements when there's no subtitle
      expect(tspans.length).toBe(0);
      // Should have plain text content
      expect(tick.textContent).toBeTruthy();
    }

    chart.destroy();
  });
});
