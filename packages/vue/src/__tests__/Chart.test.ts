import type { ChartSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
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
