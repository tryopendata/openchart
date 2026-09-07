/**
 * Vue Graph wrapper: a `dimensions` change is a remount, not an update().
 *
 * 2D and 3D are different renderers and the renderer is chosen once, at mount,
 * so vanilla `update()` refuses a dimension change and the wrapper has to
 * destroy and recreate instead.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const instanceStub = {
  update: vi.fn(),
  updateVisuals: vi.fn(),
  search: vi.fn(),
  clearSearch: vi.fn(),
  getSearchMatches: vi.fn(() => []),
  zoomToFit: vi.fn(),
  zoomToNode: vi.fn(),
  flyTo: vi.fn(),
  centerAt: vi.fn(),
  getCamera: vi.fn(() => ({ x: 0, y: 0, k: 1 })),
  selectNode: vi.fn(),
  getSelectedNodes: vi.fn(() => []),
  highlight: vi.fn(),
  clearHighlight: vi.fn(),
  getHighlight: vi.fn(() => null),
  getLegend: vi.fn(() => null),
  setActiveCategories: vi.fn(),
  getActiveCategories: vi.fn(() => []),
  resize: vi.fn(),
  destroy: vi.fn(),
};

const createGraphMock = vi.fn(() => instanceStub);

vi.mock('@opendata-ai/openchart-vanilla', () => ({
  createGraph: createGraphMock,
}));

const { Graph } = await import('../Graph');

const spec: GraphSpec = {
  type: 'graph',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
};

afterEach(() => {
  createGraphMock.mockClear();
  for (const fn of Object.values(instanceStub)) fn.mockClear?.();
});

describe('Graph dimensions', () => {
  it('recreates the instance when dimensions change and plays the entrance', async () => {
    const wrapper = mount(Graph, { props: { spec } });
    await flushPromises();
    expect(createGraphMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ spec: { ...spec, dimensions: 3 } });
    await flushPromises();

    expect(createGraphMock).toHaveBeenCalledTimes(2);
    expect(instanceStub.destroy).toHaveBeenCalledTimes(1);
    // The remount carries the new spec, so update() has nothing left to apply.
    expect(instanceStub.update).not.toHaveBeenCalled();
    expect(createGraphMock.mock.calls[1][1]).toMatchObject({ dimensions: 3 });
    const opts = createGraphMock.mock.calls[1][2] as { suppressEntrance?: boolean };
    expect(opts.suppressEntrance).toBe(false);

    wrapper.unmount();
  });

  it('updates in place when the spec changes at the same dimensions', async () => {
    const wrapper = mount(Graph, { props: { spec } });
    await flushPromises();

    await wrapper.setProps({ spec: { ...spec, nodes: [{ id: 'a' }, { id: 'b' }] } });
    await flushPromises();

    expect(createGraphMock).toHaveBeenCalledTimes(1);
    expect(instanceStub.update).toHaveBeenCalledTimes(1);
    expect(instanceStub.destroy).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
