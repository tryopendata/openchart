import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chart } from '../Chart';
import { VizThemeProvider } from '../ThemeContext';

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

it.each([
  undefined,
  'subtract',
  'grow',
] as const)('mounts, updates and destroys note sizing mode %s', async (chromeLayout) => {
  const spec = {
    ...lineSpec,
    animation: false as const,
    chromeLayout,
    annotations: [
      {
        type: 'text' as const,
        x: '2020-01-01',
        y: 10,
        text: 'A wrapped note',
        maxWidth: 60,
        responsive: false as const,
      },
    ],
  };
  const { container, rerender, unmount } = await renderChart({ spec });
  const initial = container.querySelector('svg')!.getAttribute('viewBox');
  rerender(<Chart spec={{ ...spec, chrome: { ...spec.chrome, title: 'Changed' } }} />);
  await waitFor(() => expect(container.querySelector('.oc-title')?.textContent).toBe('Changed'));
  expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(initial);
  unmount();
  expect(container.querySelector('svg')).toBeNull();
});

it('merges spec, provider, and prop themes at authored leaves', async () => {
  const { container } = render(
    <VizThemeProvider theme={{ fonts: { sizes: { title: 33 } } }}>
      <Chart
        spec={{ ...lineSpec, theme: { fonts: { family: 'Georgia' } } }}
        theme={{ fonts: { sizes: { small: 15 } } }}
      />
    </VizThemeProvider>,
  );
  await waitFor(() => expect(container.querySelector('.oc-title')).not.toBeNull());
  const title = container.querySelector<SVGElement>('.oc-title')!;
  expect(title.style.fontSize).toBe('33px');
  expect(title.style.fontFamily).toBe('Georgia');
  expect(container.querySelector<SVGElement>('.oc-source')!.style.fontSize).toBe('15px');
});

describe('interaction prop', () => {
  afterEach(cleanup);
  const clickTitle = (container: HTMLElement) =>
    container
      .querySelector('[data-chrome-key="title"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  it("interaction='read' suppresses selection even with onSelect", async () => {
    const onSelect = vi.fn();
    const { container } = await renderChart({ spec: lineSpec, interaction: 'read', onSelect });
    clickTitle(container);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changing interaction recreates the chart in the new mode', async () => {
    const onSelect = vi.fn();
    const { container, rerender } = await renderChart({
      spec: lineSpec,
      interaction: 'read',
      onSelect,
    });
    rerender(<Chart spec={lineSpec} interaction="select" onSelect={onSelect} />);
    await waitFor(() => {
      clickTitle(container);
      expect(onSelect).toHaveBeenCalled();
    });
  });

  it('adding onSelect later re-infers select mode', async () => {
    const onSelect = vi.fn();
    const { container, rerender } = await renderChart({ spec: lineSpec });
    clickTitle(container);
    rerender(<Chart spec={lineSpec} onSelect={onSelect} />);
    await waitFor(() => {
      clickTitle(container);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ path: '/chrome/title' }));
    });
  });
});
it('forwards rowHover and removes its runtime treatment when toggled off', async () => {
  const { container, rerender } = await renderChart({ spec: barSpec, rowHover: true });
  expect(container.querySelector('.oc-row-hover')).not.toBeNull();
  rerender(<Chart spec={barSpec} rowHover={false} />);
  await waitFor(() => expect(container.querySelector('.oc-row-hover')).toBeNull());
});
it('keeps slice pins through host, callback and theme changes without controlled echoes in StrictMode', async () => {
  const { StrictMode } = await import('react');
  const first = document.createElement('aside'),
    second = document.createElement('aside');
  const before = vi.fn(),
    after = vi.fn();
  const reader = { mode: 'slices' as const, panel: { container: first } };
  const result = render(
    <StrictMode>
      <Chart spec={lineSpec} reader={reader} onReaderChange={before} />
    </StrictMode>,
  );
  const root = () => result.container.querySelector('.oc-root')!;
  root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const state = before.mock.calls.at(
    -1,
  )![0] as import('@opendata-ai/openchart-core').ReaderSliceSelection;
  expect(state.pinned).toHaveLength(1);
  const svg = result.container.querySelector('svg');
  result.rerender(
    <StrictMode>
      <Chart
        spec={lineSpec}
        reader={{ mode: 'slices', panel: { container: second } }}
        readerSelection={state}
        onReaderChange={after}
      />
    </StrictMode>,
  );
  await waitFor(() => expect(second.querySelector('.oc-reader-panel')).not.toBeNull());
  expect(first.querySelector('.oc-reader-panel')).toBeNull();
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(after).not.toHaveBeenCalled();
  expect(second.textContent).toContain('A:');
  result.rerender(
    <StrictMode>
      <Chart
        spec={lineSpec}
        reader={{ mode: 'slices', panel: { container: second } }}
        readerSelection={state}
        onReaderChange={after}
        theme={{ fonts: { sizes: { small: 14 } } }}
      />
    </StrictMode>,
  );
  await waitFor(() => expect(second.textContent).toContain('A:'));
  expect(result.container.querySelectorAll('.oc-reader-guides')).toHaveLength(1);
  result.unmount();
  expect(second.querySelector('.oc-reader-panel')).toBeNull();
});
