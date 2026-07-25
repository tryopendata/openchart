/**
 * Tests for the useGraph hook.
 *
 * Mirrors the Graph.suppress-entrance.test.tsx approach: the vanilla
 * createGraph is mocked with an instance stub so the hook's delegation can be
 * asserted deterministically. The real graph simulation streams node
 * positions asynchronously via rAF/worker ticks, which never settle under
 * happy-dom, so real-render assertions on search/selection state are not
 * viable here (real-render smoke coverage lives in Graph.test.tsx).
 *
 * renderHook is broken by bun's React dual-instance issue, so a thin harness
 * component captures the hook's return value instead.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A stub GraphInstance whose methods we can assert against.
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
  setActiveCategories: vi.fn(),
  getActiveCategories: vi.fn(() => ['cat']),
  resize: vi.fn(),
  destroy: vi.fn(),
};

const createGraphMock = vi.fn(() => instanceStub);

vi.mock('@opendata-ai/openchart-vanilla', () => ({
  createGraph: createGraphMock,
}));

// Import AFTER the mock is registered.
const { Graph } = await import('../Graph');
const { useGraph } = await import('../hooks/useGraph');
type UseGraphReturn = ReturnType<typeof useGraph>;

const spec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
  ],
  edges: [{ source: 'a', target: 'b' }],
};

// ---------------------------------------------------------------------------
// Harness: captures the hook return so tests can call its methods directly
// ---------------------------------------------------------------------------

function GraphHookHarness({
  spec: graphSpec,
  withGraph,
  onApi,
}: {
  spec: GraphSpec;
  withGraph: boolean;
  onApi: (api: UseGraphReturn) => void;
}) {
  const api = useGraph();
  onApi(api);
  return withGraph ? <Graph ref={api.ref} spec={graphSpec} /> : <div />;
}

async function renderHarness(withGraph = true) {
  let api: UseGraphReturn | null = null;
  const result = render(
    <GraphHookHarness
      spec={spec}
      withGraph={withGraph}
      onApi={(a) => {
        api = a;
      }}
    />,
  );
  if (withGraph) {
    await waitFor(() => expect(createGraphMock).toHaveBeenCalled());
  }
  expect(api).not.toBeNull();
  return { ...result, api: api as unknown as UseGraphReturn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  createGraphMock.mockClear();
  for (const fn of Object.values(instanceStub)) fn.mockClear?.();
});

describe('useGraph', () => {
  it('returns safe defaults when no Graph is attached', async () => {
    const { api } = await renderHarness(false);

    expect(api.getCamera()).toEqual({ x: 0, y: 0, k: 1 });
    expect(api.getSearchMatches()).toEqual([]);
    expect(api.getSelectedNodes()).toEqual([]);
    expect(api.getHighlight()).toBeNull();
    expect(api.getLegend()).toBeNull();
    expect(api.getActiveCategories()).toEqual([]);

    // Imperative methods are no-ops (must not throw) without a Graph.
    api.search('x');
    api.clearSearch();
    api.zoomToFit();
    api.zoomToNode('a');
    api.flyTo({ x: 0, y: 0 });
    api.centerAt(0, 0);
    api.selectNode('a');
    api.highlight({ nodeIds: ['a'] });
    api.clearHighlight();
    api.setActiveCategories(['cat']);
  });

  it('search and clearSearch forward to the graph instance', async () => {
    const { api } = await renderHarness();

    api.search('Node A');
    expect(instanceStub.search).toHaveBeenCalledWith('Node A');
    expect(api.getSearchMatches()).toEqual(['a']);

    api.clearSearch();
    expect(instanceStub.clearSearch).toHaveBeenCalled();
  });

  it('camera methods forward to the graph instance', async () => {
    const { api } = await renderHarness();

    api.zoomToFit({ duration: 0, padding: 10 });
    expect(instanceStub.zoomToFit).toHaveBeenCalledWith({ duration: 0, padding: 10 });

    api.zoomToNode('a', { scale: 2 });
    expect(instanceStub.zoomToNode).toHaveBeenCalledWith('a', { scale: 2 });

    api.flyTo({ x: 5, y: 6, k: 2 }, { duration: 0 });
    expect(instanceStub.flyTo).toHaveBeenCalledWith({ x: 5, y: 6, k: 2 }, { duration: 0 });

    api.centerAt(7, 8, { duration: 0 });
    expect(instanceStub.centerAt).toHaveBeenCalledWith(7, 8, { duration: 0 });

    expect(api.getCamera()).toEqual({ x: 1, y: 2, k: 3 });
  });

  it('selection methods forward to the graph instance', async () => {
    const { api } = await renderHarness();

    api.selectNode('a', { fly: true });
    expect(instanceStub.selectNode).toHaveBeenCalledWith('a', { fly: true });
    expect(api.getSelectedNodes()).toEqual(['a']);
  });

  it('highlight methods forward to the graph instance', async () => {
    const { api } = await renderHarness();

    api.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.2 });
    expect(instanceStub.highlight).toHaveBeenCalledWith({ nodeIds: ['a'] }, { dimOpacity: 0.2 });
    expect(api.getHighlight()).toEqual(['a']);

    api.clearHighlight();
    expect(instanceStub.clearHighlight).toHaveBeenCalled();
  });

  it('legend and category methods forward to the graph instance', async () => {
    const { api } = await renderHarness();

    expect(api.getLegend()).toEqual({ field: null, nodes: [], edges: [] });

    api.setActiveCategories(['cat']);
    expect(instanceStub.setActiveCategories).toHaveBeenCalledWith(['cat']);
    expect(api.getActiveCategories()).toEqual(['cat']);
  });

  it('unmounting the Graph restores safe default getters', async () => {
    const { api, unmount } = await renderHarness();

    expect(api.getSearchMatches()).toEqual(['a']);

    unmount();
    expect(instanceStub.destroy).toHaveBeenCalled();

    // React clears the forwarded ref on unmount; getters fall back to defaults.
    expect(api.getSearchMatches()).toEqual([]);
    expect(api.getCamera()).toEqual({ x: 0, y: 0, k: 1 });
    expect(api.getHighlight()).toBeNull();
  });
});
