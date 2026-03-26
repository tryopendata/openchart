import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';

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

const communitySpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A', group: 'x' },
    { id: 'b', label: 'Node B', group: 'x' },
    { id: 'c', label: 'Node C', group: 'y' },
    { id: 'd', label: 'Node D', group: 'y' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'c', target: 'd' },
    { source: 'a', target: 'c' },
  ],
  layout: {
    clustering: { field: 'group' },
  },
  chrome: {
    title: 'Community Graph',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  // happy-dom doesn't auto-size elements; we need to provide dimensions
  // for getBoundingClientRect to return useful values
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  });
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

let container: HTMLElement;

afterEach(() => {
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGraph', () => {
  it('creates expected DOM structure (wrapper, canvas, chrome, legend)', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    // Wrapper
    const wrapper = container.querySelector('.oc-graph-wrapper');
    expect(wrapper).not.toBeNull();

    // Canvas
    const canvas = container.querySelector('.oc-graph-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName.toLowerCase()).toBe('canvas');

    // Chrome
    const chrome = container.querySelector('.oc-graph-chrome');
    expect(chrome).not.toBeNull();

    // Title
    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Test Graph');

    // Subtitle
    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toBe('A simple test graph');

    // Legend exists (even if hidden for non-community graphs)
    const legend = container.querySelector('.oc-graph-legend');
    expect(legend).not.toBeNull();

    graph.destroy();
  });

  it('destroy cleans up DOM and does not error on subsequent calls', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    expect(container.querySelector('.oc-graph-wrapper')).not.toBeNull();

    graph.destroy();

    expect(container.querySelector('.oc-graph-wrapper')).toBeNull();
    expect(container.querySelector('.oc-graph-canvas')).toBeNull();

    // Calling destroy again should not throw
    expect(() => graph.destroy()).not.toThrow();

    // Calling methods after destroy should not throw
    expect(() => graph.update(basicSpec)).not.toThrow();
    expect(() => graph.search('test')).not.toThrow();
    expect(() => graph.zoomToFit()).not.toThrow();
    expect(() => graph.resize()).not.toThrow();
    expect(graph.getSelectedNodes()).toEqual([]);
  });

  it('update re-initializes with new spec', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('Test Graph');

    graph.update(communitySpec);

    const titleAfter = container.querySelector('.oc-title');
    expect(titleAfter?.textContent).toBe('Community Graph');

    graph.destroy();
  });

  it('shows legend for community graphs', () => {
    container = makeContainer();
    const graph = createGraph(container, communitySpec);

    const legend = container.querySelector('.oc-graph-legend');
    expect(legend).not.toBeNull();
    // Community graph should have visible legend items
    const items = container.querySelectorAll('.oc-graph-legend-item');
    expect(items.length).toBeGreaterThan(0);

    graph.destroy();
  });

  it('search and clearSearch update without errors', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    expect(() => graph.search('Node')).not.toThrow();
    expect(() => graph.clearSearch()).not.toThrow();

    graph.destroy();
  });

  it('selectNode and getSelectedNodes work', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    graph.selectNode('a');
    expect(graph.getSelectedNodes()).toEqual(['a']);

    graph.destroy();
  });

  it('applies oc-dark class in dark mode', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec, { darkMode: 'force' });

    expect(container.classList.contains('oc-dark')).toBe(true);

    graph.destroy();
    expect(container.classList.contains('oc-dark')).toBe(false);
  });

  it('onSelectionChange callback fires on selectNode', () => {
    container = makeContainer();
    const onSelectionChange = vi.fn();
    const graph = createGraph(container, basicSpec, { onSelectionChange });

    graph.selectNode('b');
    expect(onSelectionChange).toHaveBeenCalledWith(['b']);

    graph.destroy();
  });
});
