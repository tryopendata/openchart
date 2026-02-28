import type { GraphSpec } from '@openchart/core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Graph } from '../Graph';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
    { id: 'c', label: 'Node C' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
  chrome: {
    title: 'Test Graph',
    subtitle: 'A simple test graph',
  },
};

const updatedSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'x', label: 'Node X' },
    { id: 'y', label: 'Node Y' },
  ],
  edges: [{ source: 'x', target: 'y' }],
  chrome: {
    title: 'Updated Graph',
  },
};

// ---------------------------------------------------------------------------
// Helper: mount Graph and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountGraph(props: {
  spec: GraphSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(Graph, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Graph', () => {
  it('renders a container div', async () => {
    const wrapper = await mountGraph({ spec: basicSpec });
    expect(wrapper.element.tagName.toLowerCase()).toBe('div');
    wrapper.unmount();
  });

  it('mounts graph instance with canvas element', async () => {
    const wrapper = await mountGraph({ spec: basicSpec });
    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountGraph({ spec: basicSpec });

    const title = wrapper.find('.viz-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('Test Graph');

    const subtitle = wrapper.find('.viz-subtitle');
    expect(subtitle.text()).toBe('A simple test graph');
    wrapper.unmount();
  });

  it('spec changes trigger re-render', async () => {
    const wrapper = await mountGraph({ spec: basicSpec });

    const titleBefore = wrapper.find('.viz-title');
    expect(titleBefore.text()).toBe('Test Graph');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.viz-title');
    expect(titleAfter.text()).toBe('Updated Graph');
    wrapper.unmount();
  });

  it('unmounting cleans up graph instance', async () => {
    const wrapper = await mountGraph({ spec: basicSpec });

    const canvasBefore = wrapper.find('canvas');
    expect(canvasBefore.exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('canvas').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountGraph({ spec: basicSpec, class: 'my-graph' });

    expect(wrapper.classes()).toContain('my-graph');
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountGraph({
      spec: basicSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountGraph({ spec: basicSpec, darkMode: 'force' });

    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
    wrapper.unmount();
  });
});
