import type { ChartSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { Chart } from '../Chart';
import { VizThemeKey } from '../context';

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
// Helper: mount Chart and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountChart(props: {
  spec: ChartSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(Chart, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Chart', () => {
  it('renders an SVG element', async () => {
    const wrapper = await mountChart({ spec: lineSpec });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('class')).toBe('oc-chart');
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountChart({ spec: lineSpec });

    const title = wrapper.find('.oc-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('GDP Growth');

    const subtitle = wrapper.find('.oc-subtitle');
    expect(subtitle.text()).toBe('US vs UK over time');

    const source = wrapper.find('.oc-source');
    expect(source.text()).toBe('World Bank');
    wrapper.unmount();
  });

  it('spec changes trigger re-render', async () => {
    const wrapper = await mountChart({ spec: lineSpec });

    const titleBefore = wrapper.find('.oc-title');
    expect(titleBefore.text()).toBe('GDP Growth');

    await wrapper.setProps({ spec: barSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.oc-title');
    expect(titleAfter.text()).toBe('Updated Title');
    wrapper.unmount();
  });

  it('unmounting cleans up chart instance', async () => {
    const wrapper = await mountChart({ spec: lineSpec });

    const svgBefore = wrapper.find('svg');
    expect(svgBefore.exists()).toBe(true);

    wrapper.unmount();

    // After unmounting, the wrapper element should be empty
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountChart({ spec: lineSpec, class: 'my-chart' });

    expect(wrapper.classes()).toContain('my-chart');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountChart({ spec: lineSpec, darkMode: 'force' });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountChart({
      spec: lineSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
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
    const wrapper = mount(Chart, {
      props: {
        spec,
        interaction: 'edit' as const,
        autoResize: false,
        revision: 'one',
        onEdit: (tx: unknown) => transactions.push(tx),
      },
    });
    await flushPromises();
    await wrapper.setProps({ revision: 'two' });
    await flushPromises();
    await wrapper.find('[data-annotation-index="0"]').trigger('click');
    await wrapper.find('svg').trigger('keydown', { key: 'Delete' });
    expect(transactions).toMatchObject([
      {
        revision: 'two',
        ops: [{ op: 'remove', path: '/annotations/0', expect: { id: 'note', text: 'Note' } }],
      },
    ]);
    wrapper.unmount();
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
  const wrapper = mount(Chart, { props: { spec } });
  await flushPromises();
  const cursor = () =>
    (wrapper.find('[data-annotation-index="0"]').element as SVGElement).style.cursor;
  expect(cursor()).not.toBe('grab');
  await wrapper.setProps({ onEdit: (tx: unknown) => transactions.push(tx) });
  await flushPromises();
  expect(cursor()).toBe('grab');
  await wrapper.find('[data-annotation-index="0"]').trigger('click');
  await wrapper.find('svg').trigger('keydown', { key: 'Delete' });
  expect(transactions).toHaveLength(1);
  await wrapper.setProps({ onEdit: undefined });
  await flushPromises();
  expect(cursor()).not.toBe('grab');
  wrapper.unmount();
});

it('merges spec, provider, and prop themes at authored leaves', async () => {
  const wrapper = mount(Chart, {
    props: {
      spec: { ...lineSpec, theme: { fonts: { family: 'Georgia' } } },
      theme: { fonts: { sizes: { small: 15 } } },
    },
    global: { provide: { [VizThemeKey as symbol]: ref({ fonts: { sizes: { title: 33 } } }) } },
  });
  await flushPromises();
  const title = wrapper.element.querySelector<SVGElement>('.oc-title')!;
  expect(title.style.fontSize).toBe('33px');
  expect(title.style.fontFamily).toBe('Georgia');
  expect(wrapper.element.querySelector<SVGElement>('.oc-source')!.style.fontSize).toBe('15px');
  wrapper.unmount();
});

describe('interaction mode and listener parity', () => {
  const clickTitle = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find('[data-chrome-key="title"]').trigger('click');

  it('re-infers select mode when a select listener is added later', async () => {
    const selected: unknown[] = [];
    const wrapper = mount(Chart, { props: { spec: lineSpec, autoResize: false } });
    await flushPromises();
    await clickTitle(wrapper);
    await wrapper.setProps({ onSelect: (el: unknown) => selected.push(el) });
    await flushPromises();
    await clickTitle(wrapper);
    expect(selected).toEqual([{ type: 'chrome', key: 'title', path: '/chrome/title' }]);
    wrapper.unmount();
  });

  it("interaction='read' suppresses selection even with a select listener", async () => {
    const selected: unknown[] = [];
    const wrapper = mount(Chart, {
      props: {
        spec: lineSpec,
        autoResize: false,
        interaction: 'read' as const,
        onSelect: (el: unknown) => selected.push(el),
      },
    });
    await flushPromises();
    await clickTitle(wrapper);
    expect(selected).toHaveLength(0);
    await wrapper.setProps({ interaction: 'select' });
    await flushPromises();
    await clickTitle(wrapper);
    expect(selected).toHaveLength(1);
    wrapper.unmount();
  });

  it('emits reveal for youDrawIt charts', async () => {
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
    const wrapper = mount(Chart, { props: { spec, autoResize: false } });
    await flushPromises();
    (wrapper.vm as unknown as { instance: { revealDrawing(): void } }).instance.revealDrawing();
    expect(wrapper.emitted('reveal')).toHaveLength(1);
    wrapper.unmount();
  });

  it('emits highlight-change from the series search', async () => {
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
    const wrapper = mount(Chart, { props: { spec, autoResize: false }, attachTo: document.body });
    await flushPromises();
    const input = wrapper.element.querySelector('.oc-series-search-input') as HTMLInputElement;
    input.value = 'ger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(wrapper.emitted('highlight-change')).toEqual([[['Germany']]]);
    wrapper.unmount();
  });
});
it('forwards rowHover and removes it when toggled off', async () => {
  const wrapper = mount(Chart, {
    props: {
      spec: {
        mark: 'bar',
        animation: false,
        data: [{ name: 'A', value: 3 }],
        encoding: {
          y: { field: 'name', type: 'nominal' },
          x: { field: 'value', type: 'quantitative' },
        },
      } as ChartSpec,
      rowHover: true,
    },
  });
  await flushPromises();
  expect(wrapper.element.querySelector('.oc-row-hover')).not.toBeNull();
  await wrapper.setProps({ rowHover: false });
  await flushPromises();
  expect(wrapper.element.querySelector('.oc-row-hover')).toBeNull();
  wrapper.unmount();
});
