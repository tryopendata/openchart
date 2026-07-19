/**
 * Graph wrapper: suppressEntrance wiring + full imperative API exposure.
 *
 * These tests mock the vanilla createGraph so we can observe exactly what mount
 * options the wrapper passes and confirm the imperative handle forwards the full
 * GraphInstance API. Kept in a separate file so the module mock doesn't leak into
 * the real-render tests in Graph.test.tsx.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
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

const spec: GraphSpec = {
  type: 'graph',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
};

afterEach(() => {
  cleanup();
  createGraphMock.mockClear();
  for (const fn of Object.values(instanceStub)) fn.mockClear?.();
});

describe('<Graph /> suppressEntrance', () => {
  it('first mount passes suppressEntrance: false (entrance plays)', async () => {
    render(<Graph spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));
    const opts = createGraphMock.mock.calls[0][2] as { suppressEntrance?: boolean };
    expect(opts.suppressEntrance).toBe(false);
  });

  it('theme change recreates with suppressEntrance: true (no replay)', async () => {
    const { rerender } = render(<Graph spec={spec} darkMode="off" />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    rerender(<Graph spec={spec} darkMode="force" />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(2));

    const secondOpts = createGraphMock.mock.calls[1][2] as { suppressEntrance?: boolean };
    expect(secondOpts.suppressEntrance).toBe(true);
  });

  it('StrictMode dev remount still plays the entrance (identical deps, no suppression)', async () => {
    render(
      <StrictMode>
        <Graph spec={spec} />
      </StrictMode>,
    );
    // StrictMode runs mount → cleanup → mount; the REAL (second) mount must not
    // be mistaken for a theme-style recreation.
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(2));
    const lastOpts = createGraphMock.mock.calls.at(-1)?.[2] as { suppressEntrance?: boolean };
    expect(lastOpts.suppressEntrance).toBe(false);
  });

  it('tooltip formatter change does NOT recreate the graph (rides the trampoline)', async () => {
    const { rerender } = render(<Graph spec={spec} tooltip={{ formatter: () => 'one' }} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    // A brand-new formatter function every render must not recreate the graph.
    rerender(<Graph spec={spec} tooltip={{ formatter: () => 'two' }} />);
    // Give effects a tick; the count must stay at 1.
    await new Promise((r) => setTimeout(r, 0));
    expect(createGraphMock).toHaveBeenCalledTimes(1);
  });

  it('the mounted tooltip option carries a stable formatter wrapper (not the raw prop)', async () => {
    const raw = vi.fn(() => 'x');
    render(<Graph spec={spec} tooltip={{ formatter: raw }} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));
    const opts = createGraphMock.mock.calls[0][2] as {
      tooltip?: { formatter?: (...a: unknown[]) => unknown };
    };
    // It's an object with a formatter, and that formatter is NOT the raw prop
    // (it's the stable wrapper that reads the latest formatter off the ref).
    expect(typeof opts.tooltip).toBe('object');
    expect(opts.tooltip?.formatter).toBeTypeOf('function');
    expect(opts.tooltip?.formatter).not.toBe(raw);
  });
});

describe('useGraph full API', () => {
  it('exposes the full instance API on the handle and forwards to the instance', async () => {
    const ref = createRef<ReturnType<typeof useGraph>['ref']['current']>();
    render(<Graph ref={ref} spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    const handle = ref.current;
    expect(handle).not.toBeNull();
    if (!handle) return;

    // Every method exists and forwards opts to the underlying instance.
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

    handle.clearHighlight();
    expect(instanceStub.clearHighlight).toHaveBeenCalled();

    expect(handle.instance).toBe(instanceStub);
  });
});
