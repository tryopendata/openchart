/**
 * Tests for the useGraph composable.
 *
 * useGraph is a ref-forwarding wrapper: it holds a template ref to a <Graph />
 * component and delegates imperative calls to the exposed GraphHandle, with
 * safe defaults when no graph is attached.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, type VNodeRef } from 'vue';
import { useGraph } from '../composables/useGraph';
import { Graph } from '../Graph';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const graphSpec: GraphSpec = {
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
};

// ---------------------------------------------------------------------------
// Test harness: binds the composable's graphRef to a real <Graph />
// ---------------------------------------------------------------------------

const GraphHarness = defineComponent({
  setup() {
    const api = useGraph();
    return { api };
  },
  render() {
    return h(Graph, {
      ref: this.api.graphRef as unknown as VNodeRef,
      spec: graphSpec,
    });
  },
});

async function mountHarness() {
  const wrapper = mount(GraphHarness);
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGraph', () => {
  it('returns safe defaults when no graph is attached', () => {
    const api = useGraph();

    expect(api.graphRef.value).toBeNull();
    expect(api.getCamera()).toEqual({ x: 0, y: 0, k: 1 });
    expect(api.getSearchMatches()).toEqual([]);
    expect(api.getSelectedNodes()).toEqual([]);
    expect(api.getHighlight()).toBeNull();
    expect(api.getLegend()).toBeNull();
    expect(api.getActiveCategories()).toEqual([]);

    // Void methods are no-ops (must not throw) with no graph attached
    expect(() => {
      api.search('query');
      api.clearSearch();
      api.zoomToFit();
      api.zoomToNode('a');
      api.flyTo({ x: 10, y: 20 });
      api.centerAt(5, 5);
      api.selectNode('a');
      api.highlight({ nodeIds: ['a'] });
      api.clearHighlight();
      api.setActiveCategories(['x']);
    }).not.toThrow();
  });

  it('attaches to a mounted Graph component', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    expect(api.graphRef.value).not.toBeNull();
    expect(wrapper.find('canvas').exists()).toBe(true);
    wrapper.unmount();
  });

  it('delegates camera reads to the graph instance', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    const camera = api.getCamera();
    expect(typeof camera.x).toBe('number');
    expect(typeof camera.y).toBe('number');
    expect(typeof camera.k).toBe('number');
    wrapper.unmount();
  });

  it('delegates selection to the graph instance', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    expect(api.getSelectedNodes()).toEqual([]);

    api.selectNode('a');
    await flushPromises();

    expect(api.getSelectedNodes()).toContain('a');
    wrapper.unmount();
  });

  it('delegates search to the graph instance', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    expect(() => {
      api.search('Node A');
      api.clearSearch();
    }).not.toThrow();
    expect(Array.isArray(api.getSearchMatches())).toBe(true);
    wrapper.unmount();
  });

  it('delegates highlight and category state to the graph instance', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    api.highlight({ nodeIds: ['a', 'b'] });
    await flushPromises();
    expect(api.getHighlight()).toEqual(['a', 'b']);

    api.clearHighlight();
    await flushPromises();
    expect(api.getHighlight()).toBeNull();

    expect(api.getActiveCategories()).toEqual([]);
    wrapper.unmount();
  });

  it('returns safe defaults again after the graph unmounts', async () => {
    const wrapper = await mountHarness();
    const { api } = wrapper.vm;

    expect(api.graphRef.value).not.toBeNull();

    wrapper.unmount();

    expect(api.graphRef.value).toBeNull();
    expect(api.getCamera()).toEqual({ x: 0, y: 0, k: 1 });
    expect(api.getSelectedNodes()).toEqual([]);
  });
});
