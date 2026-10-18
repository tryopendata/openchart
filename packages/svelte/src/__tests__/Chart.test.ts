import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Chart from '../Chart.svelte';

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
// Helper: render Chart and wait for SVG to appear ($effect is deferred)
// ---------------------------------------------------------------------------

async function renderChart(props: { spec: ChartSpec; [key: string]: unknown }) {
  const result = render(Chart, { props });
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

    await rerender({ spec: barSpec });
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
    const { container } = await renderChart({ spec: lineSpec, class: 'my-chart' });

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
      style: 'border: 1px solid red',
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });
});

describe('annotation transactions', () => {
  it('emits the current revision after a prop-only update', async () => {
    const spec = {
      ...lineSpec,
      annotations: [
        {
          type: 'text' as const,
          x: '2020-01-01',
          y: 10,
          text: 'Note',
          id: 'note',
          responsive: false,
        },
      ],
    };
    const transactions: unknown[] = [];
    const { container, rerender } = await renderChart({
      spec,
      interaction: 'edit' as const,
      autoResize: false,
      revision: 'one',
      onedit: (tx: unknown) => transactions.push(tx),
    });
    await rerender({
      spec,
      interaction: 'edit' as const,
      autoResize: false,
      revision: 'two',
      onedit: (tx: unknown) => transactions.push(tx),
    });
    container
      .querySelector('[data-annotation-index="0"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container
      .querySelector('svg')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(transactions).toMatchObject([
      {
        revision: 'two',
        ops: [{ op: 'remove', path: '/annotations/0', expect: { id: 'note', text: 'Note' } }],
      },
    ]);
  });
});

it('reacts to transaction listener presence without enabling all charts for editing', async () => {
  const spec = {
    ...lineSpec,
    annotations: [
      {
        type: 'text' as const,
        x: '2020-01-01',
        y: 10,
        text: 'Note',
        id: 'note',
        responsive: false,
      },
    ],
  };
  const transactions: unknown[] = [];
  const { container, rerender } = await renderChart({ spec });
  const cursor = () =>
    (container.querySelector('[data-annotation-index="0"]') as SVGElement).style.cursor;
  expect(cursor()).not.toBe('grab');
  await rerender({ spec, onedit: (tx: unknown) => transactions.push(tx) });
  expect(cursor()).toBe('grab');
  container
    .querySelector('[data-annotation-index="0"]')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  container
    .querySelector('svg')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  expect(transactions).toHaveLength(1);
  await rerender({ spec, onedit: undefined });
  expect(cursor()).not.toBe('grab');
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
  await rerender({ spec: { ...spec, chrome: { ...spec.chrome, title: 'Changed' } } });
  await waitFor(() => expect(container.querySelector('.oc-title')?.textContent).toBe('Changed'));
  expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(initial);
  unmount();
  expect(container.querySelector('svg')).toBeNull();
});

describe('interaction mode and listener parity', () => {
  const clickTitle = (container: HTMLElement) =>
    container
      .querySelector('[data-chrome-key="title"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  it('re-infers select mode when onselect is added later', async () => {
    const onselect = vi.fn();
    const { container, rerender } = await renderChart({ spec: lineSpec, autoResize: false });
    clickTitle(container);
    await rerender({ spec: lineSpec, autoResize: false, onselect });
    clickTitle(container);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect.mock.calls[0][0]).toMatchObject({ type: 'chrome', path: '/chrome/title' });
  });

  it("interaction='read' suppresses selection; switching to 'select' recreates", async () => {
    const onselect = vi.fn();
    const { container, rerender } = await renderChart({
      spec: lineSpec,
      autoResize: false,
      interaction: 'read' as const,
      onselect,
    });
    clickTitle(container);
    expect(onselect).not.toHaveBeenCalled();
    await rerender({ spec: lineSpec, autoResize: false, interaction: 'select' as const, onselect });
    clickTitle(container);
    expect(onselect).toHaveBeenCalledTimes(1);
  });

  it('forwards onreveal and exposes the instance via getInstance()', async () => {
    const onreveal = vi.fn();
    const spec = {
      mark: 'line',
      data: [2000, 2005, 2010, 2015, 2020].map((year, i) => ({ year: `${year}`, value: i })),
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
      youDrawIt: { from: '2010' },
      animation: false,
    } as ChartSpec;
    const { component } = await renderChart({ spec, autoResize: false, onreveal });
    const instance = (
      component as unknown as { getInstance(): { revealDrawing(): void } | null }
    ).getInstance();
    expect(instance).not.toBeNull();
    instance!.revealDrawing();
    expect(onreveal).toHaveBeenCalledTimes(1);
  });

  it('forwards onhighlightchange from the series search', async () => {
    const onhighlightchange = vi.fn();
    const spec = {
      mark: 'line',
      data: ['Germany', 'France'].flatMap((country, i) => [
        { year: '2020-01-01', value: i, country },
        { year: '2021-01-01', value: i + 1, country },
      ]),
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
      seriesSearch: true,
    } as ChartSpec;
    const { container } = await renderChart({ spec, autoResize: false, onhighlightchange });
    const input = container.querySelector('.oc-series-search-input') as HTMLInputElement;
    input.value = 'ger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onhighlightchange).toHaveBeenCalledWith(['Germany']);
  });
});
