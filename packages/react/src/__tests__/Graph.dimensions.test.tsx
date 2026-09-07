/**
 * Graph wrapper: a `dimensions` change is a remount, not an update().
 *
 * 2D and 3D are different renderers and the renderer is chosen once, at mount,
 * so vanilla `update()` refuses a dimension change. The wrapper has to destroy
 * and recreate instead. Mocks createGraph so create/destroy/update are
 * observable; kept in its own file so the module mock doesn't leak.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
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
  cleanup();
  createGraphMock.mockClear();
  for (const fn of Object.values(instanceStub)) fn.mockClear?.();
});

describe('<Graph /> dimensions', () => {
  it('recreates the instance when dimensions change', async () => {
    const { rerender } = render(<Graph spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    rerender(<Graph spec={{ ...spec, dimensions: 3 }} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(2));

    expect(instanceStub.destroy).toHaveBeenCalledTimes(1);
    // The remount carries the new spec, so update() has nothing left to apply.
    expect(instanceStub.update).not.toHaveBeenCalled();
    expect(createGraphMock.mock.calls[1][1]).toMatchObject({ dimensions: 3 });
  });

  it('lets the new renderer play its entrance', async () => {
    const { rerender } = render(<Graph spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    rerender(<Graph spec={{ ...spec, dimensions: 3 }} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(2));

    const opts = createGraphMock.mock.calls[1][2] as { suppressEntrance?: boolean };
    expect(opts.suppressEntrance).toBe(false);
  });

  it('updates in place when the spec changes at the same dimensions', async () => {
    const { rerender } = render(<Graph spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    rerender(<Graph spec={{ ...spec, nodes: [{ id: 'a' }, { id: 'b' }] }} />);
    await waitFor(() => expect(instanceStub.update).toHaveBeenCalledTimes(1));

    expect(createGraphMock).toHaveBeenCalledTimes(1);
    expect(instanceStub.destroy).not.toHaveBeenCalled();
  });

  it('treats an explicit dimensions: 2 as unchanged from omitted', async () => {
    const { rerender } = render(<Graph spec={spec} />);
    await waitFor(() => expect(createGraphMock).toHaveBeenCalledTimes(1));

    rerender(<Graph spec={{ ...spec, dimensions: 2 }} />);
    await waitFor(() => expect(instanceStub.update).toHaveBeenCalledTimes(1));

    expect(createGraphMock).toHaveBeenCalledTimes(1);
  });
});
