import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Graph from '../Graph.svelte';

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
// Helper: render Graph and wait for canvas to mount ($effect is deferred)
// ---------------------------------------------------------------------------

async function renderGraph(props: { spec: GraphSpec; [key: string]: unknown }) {
  const result = render(Graph, { props });
  await waitFor(() => {
    expect(result.container.querySelector('canvas')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('<Graph />', () => {
  it('renders a container div', async () => {
    const { container } = await renderGraph({ spec: basicSpec });
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.tagName.toLowerCase()).toBe('div');
  });

  it('mounts graph instance with canvas element', async () => {
    const { container } = await renderGraph({ spec: basicSpec });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('renders chrome text elements', async () => {
    const { container } = await renderGraph({ spec: basicSpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Test Graph');

    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle?.textContent).toBe('A simple test graph');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderGraph({ spec: basicSpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('Test Graph');

    await rerender({ spec: updatedSpec });
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Graph');
    });
  });

  it('unmounting cleans up graph instance', async () => {
    const { container, unmount } = await renderGraph({ spec: basicSpec });

    const canvasBefore = container.querySelector('canvas');
    expect(canvasBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('canvas')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderGraph({ spec: basicSpec, class: 'my-graph' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('my-graph');
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderGraph({
      spec: basicSpec,
      style: 'border: 1px solid red',
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderGraph({ spec: basicSpec, darkMode: 'force' });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('exposes the full imperative API and forwards calls without throwing', async () => {
    const result = await renderGraph({ spec: basicSpec });
    // Svelte 5 exposes component exports on the returned component instance.
    const api = result.component as unknown as Record<string, (...args: unknown[]) => unknown>;

    for (const name of [
      'search',
      'clearSearch',
      'getSearchMatches',
      'zoomToFit',
      'zoomToNode',
      'flyTo',
      'centerAt',
      'getCamera',
      'selectNode',
      'getSelectedNodes',
      'highlight',
      'clearHighlight',
      'getHighlight',
      'getLegend',
      'updateVisuals',
    ]) {
      expect(typeof api[name]).toBe('function');
    }

    // Readback methods return sensible defaults from the live instance.
    expect(api.getSelectedNodes()).toEqual([]);
    expect(api.getSearchMatches()).toEqual([]);
    expect(api.getHighlight()).toBeNull();
    const cam = api.getCamera() as { k: number };
    expect(cam.k).toBeGreaterThan(0);

    // Opt-forwarding methods don't throw.
    expect(() => api.zoomToFit({ duration: 0 })).not.toThrow();
    expect(() => api.zoomToNode('a', { scale: 2 })).not.toThrow();
    expect(() => api.flyTo({ x: 0, y: 0, k: 1 }, { duration: 0 })).not.toThrow();
    expect(() => api.centerAt(0, 0, { duration: 0 })).not.toThrow();
    expect(() => api.highlight({ nodeIds: ['a'] })).not.toThrow();
    expect(() => api.clearHighlight()).not.toThrow();
  });

  it('renders with new option props (tooltip formatter, legend object, events)', async () => {
    const { container } = await renderGraph({
      spec: basicSpec,
      tooltip: { formatter: () => 'custom' },
      legend: { interactive: false, counts: false },
      fitOnLoad: true,
      onlegendhover: () => {},
      onhighlightchange: () => {},
      oncamerachange: () => {},
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
