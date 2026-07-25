import type { SankeySpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Sankey } from '../Sankey';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: SankeySpec = {
  type: 'sankey',
  data: [
    { from: 'A', to: 'C', amount: 10 },
    { from: 'B', to: 'C', amount: 20 },
    { from: 'C', to: 'D', amount: 15 },
    { from: 'C', to: 'E', amount: 15 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'amount', type: 'quantitative' },
  },
  chrome: {
    title: 'Flow Diagram',
  },
};

const updatedSpec: SankeySpec = {
  type: 'sankey',
  data: [
    { from: 'X', to: 'Y', amount: 10 },
    { from: 'Y', to: 'Z', amount: 10 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'amount', type: 'quantitative' },
  },
  chrome: {
    title: 'Updated Flow',
  },
};

// ---------------------------------------------------------------------------
// Helper: mount Sankey and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountSankey(props: {
  spec: SankeySpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(Sankey, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sankey', () => {
  it('renders an SVG element with sankey nodes and links', async () => {
    const wrapper = await mountSankey({ spec: basicSpec });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);

    // A, B, C, D, E = 5 nodes
    const nodes = wrapper.findAll('.oc-sankey-node');
    expect(nodes.length).toBe(5);

    // A->C, B->C, C->D, C->E = 4 links
    const links = wrapper.findAll('.oc-sankey-link');
    expect(links.length).toBe(4);
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountSankey({ spec: basicSpec });

    const title = wrapper.find('.oc-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('Flow Diagram');
    wrapper.unmount();
  });

  it('spec changes trigger update on the underlying instance', async () => {
    const wrapper = await mountSankey({ spec: basicSpec });

    const titleBefore = wrapper.find('.oc-title');
    expect(titleBefore.text()).toBe('Flow Diagram');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.oc-title');
    expect(titleAfter.text()).toBe('Updated Flow');

    // X, Y, Z = 3 nodes after the update
    const nodes = wrapper.findAll('.oc-sankey-node');
    expect(nodes.length).toBe(3);
    wrapper.unmount();
  });

  it('unmounting cleans up the sankey instance', async () => {
    const wrapper = await mountSankey({ spec: basicSpec });

    const svgBefore = wrapper.find('svg');
    expect(svgBefore.exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountSankey({ spec: basicSpec, class: 'my-sankey' });

    expect(wrapper.classes()).toContain('oc-sankey-root');
    expect(wrapper.classes()).toContain('my-sankey');
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountSankey({
      spec: basicSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountSankey({ spec: basicSpec, darkMode: 'force' });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    wrapper.unmount();
  });
});
