/**
 * Vue Graph wrapper: suppressEntrance wiring + full imperative API exposure.
 *
 * Mocks the vanilla createGraph so we can observe the mount options the wrapper
 * passes and confirm the exposed handle forwards the full GraphInstance API.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const instanceStub = {
  update: vi.fn(),
  updateVisuals: vi.fn(),
  search: vi.fn(),
  clearSearch: vi.fn(),
  getSearchMatches: vi.fn(() => ['a']),
  zoomToFit: vi.fn(),
  zoomToNode: vi.fn(),
  flyTo: vi.fn(),
  centerAt: vi.fn(),
  getCamera: vi.fn(() => ({ x: 1, y: 2, k: 3 })),
  selectNode: vi.fn(),
  getSelectedNodes: vi.fn(() => ['a']),
  highlight: vi.fn(),
  clearHighlight: vi.fn(),
  getHighlight: vi.fn(() => ['a']),
  getLegend: vi.fn(() => ({ field: null, nodes: [], edges: [] })),
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

describe('Graph suppressEntrance', () => {
  it('first mount passes suppressEntrance: false (entrance plays)', async () => {
    const wrapper = mount(Graph, { props: { spec } });
    await flushPromises();
    expect(createGraphMock).toHaveBeenCalledTimes(1);
    const opts = createGraphMock.mock.calls[0][2] as { suppressEntrance?: boolean };
    expect(opts.suppressEntrance).toBe(false);
    wrapper.unmount();
  });

  it('theme change recreates with suppressEntrance: true (no replay)', async () => {
    const wrapper = mount(Graph, { props: { spec, darkMode: 'off' } });
    await flushPromises();
    expect(createGraphMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ darkMode: 'force' });
    await flushPromises();
    expect(createGraphMock).toHaveBeenCalledTimes(2);

    const secondOpts = createGraphMock.mock.calls[1][2] as { suppressEntrance?: boolean };
    expect(secondOpts.suppressEntrance).toBe(true);
    wrapper.unmount();
  });

  it('the mounted tooltip option carries a stable formatter wrapper (not the raw prop)', async () => {
    const raw = vi.fn(() => 'x');
    const wrapper = mount(Graph, { props: { spec, tooltip: { formatter: raw } } });
    await flushPromises();
    const opts = createGraphMock.mock.calls[0][2] as {
      tooltip?: { formatter?: (...a: unknown[]) => unknown };
    };
    expect(typeof opts.tooltip).toBe('object');
    expect(opts.tooltip?.formatter).toBeTypeOf('function');
    expect(opts.tooltip?.formatter).not.toBe(raw);
    wrapper.unmount();
  });

  it('exposes the full instance API and forwards opts to the instance', async () => {
    const wrapper = mount(Graph, { props: { spec } });
    await flushPromises();

    const handle = wrapper.vm as unknown as {
      search: (q: string) => void;
      zoomToFit: (o?: unknown) => void;
      zoomToNode: (id: string, o?: unknown) => void;
      flyTo: (t: unknown, o?: unknown) => void;
      centerAt: (x: number, y: number, o?: unknown) => void;
      selectNode: (id: string, o?: unknown) => void;
      highlight: (t: unknown, o?: unknown) => void;
      clearHighlight: () => void;
      getCamera: () => unknown;
      getSearchMatches: () => string[];
      getHighlight: () => string[] | null;
      getLegend: () => unknown;
      instance: unknown;
    };

    handle.search('q');
    expect(instanceStub.search).toHaveBeenCalledWith('q');

    handle.zoomToFit({ duration: 0 });
    expect(instanceStub.zoomToFit).toHaveBeenCalledWith({ duration: 0 });

    handle.zoomToNode('a', { scale: 3 });
    expect(instanceStub.zoomToNode).toHaveBeenCalledWith('a', { scale: 3 });

    handle.flyTo({ x: 1, y: 2, k: 3 }, { ease: 'smooth' });
    expect(instanceStub.flyTo).toHaveBeenCalledWith({ x: 1, y: 2, k: 3 }, { ease: 'smooth' });

    handle.centerAt(5, 6, { duration: 200 });
    expect(instanceStub.centerAt).toHaveBeenCalledWith(5, 6, { duration: 200 });

    handle.selectNode('a', { fly: true });
    expect(instanceStub.selectNode).toHaveBeenCalledWith('a', { fly: true });

    handle.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.1 });
    expect(instanceStub.highlight).toHaveBeenCalledWith({ nodeIds: ['a'] }, { dimOpacity: 0.1 });

    expect(handle.getCamera()).toEqual({ x: 1, y: 2, k: 3 });
    expect(handle.getSearchMatches()).toEqual(['a']);
    expect(handle.getHighlight()).toEqual(['a']);
    expect(handle.getLegend()).toEqual({ field: null, nodes: [], edges: [] });
    expect(handle.instance).toBe(instanceStub);

    wrapper.unmount();
  });
});
