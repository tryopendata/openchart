/**
 * Tests for the useGraph hook against the real vanilla graph.
 *
 * Search, selection, highlight and legend state are synchronous on the graph
 * instance, so they're asserted through the hook's getters. Camera methods run
 * with `duration: 0` so they land immediately; rAF and performance.now are
 * driven by a manual frame clock so the mount's entrance settles
 * deterministically.
 *
 * renderHook is broken by bun's React dual-instance issue, so a thin harness
 * component captures the hook's return value instead.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FrameClock,
  installFrameClock,
  playsEntrance,
} from '../../../vanilla/src/__test-fixtures__/graph-frame-clock';
import { Graph } from '../Graph';
import { useGraph } from '../hooks/useGraph';

type UseGraphReturn = ReturnType<typeof useGraph>;

const spec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A', kind: 'cat' },
    { id: 'b', label: 'Node B', kind: 'dog' },
  ],
  edges: [{ source: 'a', target: 'b' }],
  encoding: {
    nodeColor: { field: 'kind', type: 'nominal' },
    nodeLabel: { field: 'label' },
  },
  layout: { type: 'force', warmup: 30 },
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
  expect(api).not.toBeNull();
  const hook = api as unknown as UseGraphReturn;
  if (withGraph) {
    expect(result.container.querySelector('.oc-graph-wrapper')).not.toBeNull();
    // Let the mount's first tick frame the nodes so camera reads are real.
    await playsEntrance(clock, () => hook.getCamera().k);
  }
  return { ...result, api: hook };
}

let clock: FrameClock;

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  cleanup();
  clock.restore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

  it('search and clearSearch drive the graph search', async () => {
    const { api } = await renderHarness();

    api.search('Node A');
    expect(api.getSearchMatches()).toEqual(['a']);

    api.clearSearch();
    expect(api.getSearchMatches()).toEqual([]);
  });

  it('camera methods move the graph camera', async () => {
    const { api } = await renderHarness();

    api.flyTo({ x: 5, y: 6, k: 2 }, { duration: 0 });
    expect(api.getCamera().k).toBeCloseTo(2);

    api.zoomToNode('a', { scale: 4, duration: 0 });
    const onNode = api.getCamera();
    expect(onNode.k).toBeGreaterThan(2);

    const before = api.getCamera();
    api.centerAt(7, 8, { duration: 0 });
    const centered = api.getCamera();
    expect(centered.k).toBeCloseTo(before.k);
    expect([centered.x, centered.y]).not.toEqual([before.x, before.y]);

    api.zoomToFit({ duration: 0, padding: 10 });
    expect(api.getCamera().k).toBeLessThan(onNode.k);
  });

  it('selection methods drive the graph selection', async () => {
    const { api } = await renderHarness();

    api.selectNode('a', { fly: true, duration: 0 });
    expect(api.getSelectedNodes()).toEqual(['a']);
  });

  it('highlight methods drive the graph highlight', async () => {
    const { api } = await renderHarness();

    api.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.2 });
    expect(api.getHighlight()).toEqual(['a']);

    api.clearHighlight();
    expect(api.getHighlight()).toBeNull();
  });

  it('legend and category methods drive the graph legend', async () => {
    const { api } = await renderHarness();

    const legend = api.getLegend();
    expect(legend?.field).toBe('kind');
    expect(legend?.nodes.map((n) => n.label)).toEqual(['cat', 'dog']);

    api.setActiveCategories(['cat']);
    expect(api.getActiveCategories()).toEqual(['cat']);
  });

  it('unmounting the Graph removes it and restores safe default getters', async () => {
    const { api, unmount, container } = await renderHarness();

    api.search('Node A');
    expect(api.getSearchMatches()).toEqual(['a']);

    unmount();
    expect(container.querySelector('.oc-graph-wrapper')).toBeNull();

    // React clears the forwarded ref on unmount; getters fall back to defaults.
    expect(api.getSearchMatches()).toEqual([]);
    expect(api.getCamera()).toEqual({ x: 0, y: 0, k: 1 });
    expect(api.getHighlight()).toBeNull();
  });
});
