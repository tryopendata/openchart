import type { BarListSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { BarList } from '../BarList';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: BarListSpec = {
  type: 'barlist',
  data: [
    { name: 'Alpha', value: 30 },
    { name: 'Beta', value: 20 },
    { name: 'Gamma', value: 10 },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Top Items',
  },
};

const updatedSpec: BarListSpec = {
  type: 'barlist',
  data: [
    { name: 'One', value: 5 },
    { name: 'Two', value: 3 },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Updated Items',
  },
};

// ---------------------------------------------------------------------------
// Helper: mount BarList and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountBarList(props: {
  spec: BarListSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(BarList, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BarList', () => {
  it('renders an SVG element with one row per data item', async () => {
    const wrapper = await mountBarList({ spec: basicSpec });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);

    const rows = wrapper.findAll('.oc-barlist-row');
    expect(rows.length).toBe(3);
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountBarList({ spec: basicSpec });

    const title = wrapper.find('.oc-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('Top Items');
    wrapper.unmount();
  });

  it('spec changes trigger update on the underlying instance', async () => {
    const wrapper = await mountBarList({ spec: basicSpec });

    const titleBefore = wrapper.find('.oc-title');
    expect(titleBefore.text()).toBe('Top Items');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.oc-title');
    expect(titleAfter.text()).toBe('Updated Items');

    const rows = wrapper.findAll('.oc-barlist-row');
    expect(rows.length).toBe(2);
    wrapper.unmount();
  });

  it('unmounting cleans up the barlist instance', async () => {
    const wrapper = await mountBarList({ spec: basicSpec });

    const svgBefore = wrapper.find('svg');
    expect(svgBefore.exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountBarList({ spec: basicSpec, class: 'my-barlist' });

    expect(wrapper.classes()).toContain('oc-barlist-root');
    expect(wrapper.classes()).toContain('my-barlist');
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountBarList({
      spec: basicSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountBarList({ spec: basicSpec, darkMode: 'force' });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    wrapper.unmount();
  });
});
