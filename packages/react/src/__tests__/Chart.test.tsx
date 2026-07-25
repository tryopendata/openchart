import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Chart } from '../Chart';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
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
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
    { name: 'C', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'Updated Title',
  },
};

// ---------------------------------------------------------------------------
// Helper: render Chart and wait for SVG to appear (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderChart(props: React.ComponentProps<typeof Chart>) {
  const result = render(<Chart {...props} />);
  await waitFor(() => {
    expect(result.container.querySelector('svg')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('<Chart />', () => {
  it('renders an SVG element', async () => {
    const { container } = await renderChart({ spec: lineSpec });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toBe('oc-chart');
  });

  it('renders chrome text elements', async () => {
    const { container } = await renderChart({ spec: lineSpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('GDP Growth');

    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle?.textContent).toBe('US vs UK over time');

    const source = container.querySelector('.oc-source');
    expect(source?.textContent).toBe('World Bank');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderChart({ spec: lineSpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('GDP Growth');

    rerender(<Chart spec={barSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Title');
    });
  });

  it('unmounting cleans up chart instance', async () => {
    const { container, unmount } = await renderChart({ spec: lineSpec });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderChart({ spec: lineSpec, className: 'my-chart' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('my-chart');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderChart({ spec: lineSpec, darkMode: 'force' });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderChart({
      spec: lineSpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });
});

describe('<Chart /> renderer prop', () => {
  afterEach(cleanup);

  const scatterSpec: ChartSpec = {
    animation: false,
    mark: 'point',
    data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, x: i, y: i * 2 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      key: { field: 'id', type: 'nominal' },
    },
  };

  it('renderer="canvas" mounts the canvas mark layer instead of SVG circles', async () => {
    const { container } = await renderChart({ spec: scatterSpec, renderer: 'canvas' });

    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();
    expect(container.querySelector('circle.oc-mark-point')).toBeNull();
  });

  it('changing renderer recreates the chart on the new backend', async () => {
    const { container, rerender } = await renderChart({ spec: scatterSpec, renderer: 'canvas' });
    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();

    rerender(<Chart spec={scatterSpec} renderer="svg" />);
    await waitFor(() => {
      expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();
      expect(container.querySelector('circle.oc-mark-point')).not.toBeNull();
    });
  });
});
