import type { GraphSpec } from '@opendata-ai/openchart-core';
import { compileGraph, MAX_3D_NODES } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraph, type GraphInstance } from '../../graph-mount';
import {
  GRAPH_3D_NOT_REGISTERED_ERROR,
  type GraphRendererContext,
  registerGraphRenderer,
  resetGraphRendererRegistry,
} from '../renderer-registry';
import { createGraphShell } from '../shell';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
  ],
  edges: [{ source: 'a', target: 'b' }],
  chrome: { title: 'Test Graph' },
};

const spec3d: GraphSpec = { ...basicSpec, dimensions: 3 };

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
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

/** A GraphInstance whose every verb is a spy-free no-op. */
function fakeInstance(): GraphInstance {
  return {
    update: () => {},
    updateVisuals: () => {},
    search: () => {},
    clearSearch: () => {},
    getSearchMatches: () => [],
    zoomToFit: () => {},
    zoomToNode: () => {},
    flyTo: () => {},
    centerAt: () => {},
    getCamera: () => ({ x: 0, y: 0, k: 1 }),
    selectNode: () => {},
    getSelectedNodes: () => [],
    highlight: () => {},
    clearHighlight: () => {},
    getHighlight: () => null,
    getLegend: () => null,
    setActiveCategories: () => {},
    getActiveCategories: () => [],
    resize: () => {},
    destroy: () => {},
  };
}

let container: HTMLElement;

beforeEach(() => {
  resetGraphRendererRegistry();
});

afterEach(() => {
  resetGraphRendererRegistry();
  if (container?.parentNode) container.parentNode.removeChild(container);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGraph dimension dispatch', () => {
  it('throws the subpath-import error when no 3D renderer is registered', () => {
    container = makeContainer();

    expect(() => createGraph(container, spec3d)).toThrow(GRAPH_3D_NOT_REGISTERED_ERROR);
    // Nothing half-built is left behind.
    expect(container.children.length).toBe(0);
    expect(container.classList.contains('oc-dark')).toBe(false);
  });

  it('hands a mounted shell to the registered 3D factory and returns its instance', () => {
    container = makeContainer();
    const instance = fakeInstance();
    let received: GraphRendererContext | null = null;
    registerGraphRenderer(3, (ctx) => {
      received = ctx;
      return instance;
    });

    const returned = createGraph(container, spec3d);

    expect(returned).toBe(instance);

    const ctx = received as unknown as GraphRendererContext;
    expect(ctx).not.toBeNull();
    expect(ctx.compilation.numDimensions).toBe(3);
    expect(ctx.spec).toBe(spec3d);

    // The shell is mounted with chrome and legend, but no surface yet.
    const wrapper = container.querySelector('.oc-graph-wrapper');
    expect(wrapper).not.toBeNull();
    expect(ctx.shell.wrapper).toBe(wrapper);
    expect(wrapper?.querySelector('.oc-graph-chrome')).not.toBeNull();
    expect(wrapper?.querySelector('.oc-title')?.textContent).toBe('Test Graph');
    expect(wrapper?.querySelector('.oc-graph-legend')).not.toBeNull();
    expect(wrapper?.querySelector('canvas')).toBeNull();
  });

  it('never consults the registry for 2D or an omitted dimensions', () => {
    container = makeContainer();
    registerGraphRenderer(3, () => {
      throw new Error('2D must not reach the 3D renderer');
    });

    const a = createGraph(container, basicSpec);
    expect(container.querySelector('.oc-graph-canvas')).not.toBeNull();
    a.destroy();

    const b = createGraph(container, { ...basicSpec, dimensions: 2 });
    expect(container.querySelector('.oc-graph-canvas')).not.toBeNull();
    b.destroy();
  });

  it('falls back to 2D with a warning above the node gate', () => {
    container = makeContainer();
    registerGraphRenderer(3, () => {
      throw new Error('the gate should have sent this to 2D');
    });
    const warnings: string[] = [];

    const graph = createGraph(
      container,
      {
        type: 'graph',
        nodes: Array.from({ length: MAX_3D_NODES + 1 }, (_, i) => ({ id: `n${i}` })),
        edges: [{ source: 'n0', target: 'n1' }],
        dimensions: 3,
      },
      { onWarn: (m) => warnings.push(m) },
    );

    expect(container.querySelector('.oc-graph-canvas')).not.toBeNull();
    expect(warnings.some((w) => w.includes(String(MAX_3D_NODES)))).toBe(true);
    graph.destroy();
  });
});

describe('update() across a dimension change', () => {
  it('warns and leaves the instance intact', () => {
    container = makeContainer();
    const warnings: string[] = [];
    const graph = createGraph(container, basicSpec, { onWarn: (m) => warnings.push(m) });

    const canvasBefore = container.querySelector('.oc-graph-canvas');
    const titleBefore = container.querySelector('.oc-title')?.textContent;

    graph.update({ ...basicSpec, dimensions: 3, chrome: { title: 'Changed' } });

    expect(warnings).toContain('createGraph: update() cannot change dimensions; remount the graph');
    // No DOM churn, and the chrome from the rejected spec was not applied.
    expect(container.querySelector('.oc-graph-canvas')).toBe(canvasBefore);
    expect(container.querySelector('.oc-title')?.textContent).toBe(titleBefore);

    graph.destroy();
  });

  it('still applies an update that keeps the same dimensions', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    graph.update({ ...basicSpec, chrome: { title: 'Changed' } });

    expect(container.querySelector('.oc-title')?.textContent).toBe('Changed');
    graph.destroy();
  });
});

describe('createGraphShell', () => {
  function shellFor(options?: Parameters<typeof createGraphShell>[3]) {
    container = makeContainer();
    // createGraph would mount the 2D renderer, so compile the spec directly.
    const compilation = compileGraph(basicSpec, { width: 800, height: 600 });
    return createGraphShell(container, basicSpec, compilation, options, () => {});
  }

  it('omits the legend element when legend is false', () => {
    const shell = shellFor({ legend: false });

    expect(shell.legendEl).toBeNull();
    expect(container.querySelector('.oc-graph-legend')).toBeNull();
    shell.destroy();
  });

  it('omits the tooltip manager when tooltip is false', () => {
    const shell = shellFor({ tooltip: false });

    expect(shell.tooltipManager).toBeNull();
    shell.destroy();
  });

  it('mounts the surface between the chrome and the legend', () => {
    const shell = shellFor();
    const surface = document.createElement('canvas');
    shell.mountSurface(surface);

    const classes = [...shell.wrapper.children].map((c) => c.className);
    expect(classes.slice(0, 3)).toEqual(['oc-graph-chrome', '', 'oc-graph-legend']);
    shell.destroy();
  });

  it('does not observe resizes when responsive is false', () => {
    const shell = shellFor({ responsive: false });
    const callback = vi.fn();

    const disconnect = shell.observeResize(callback);
    expect(callback).not.toHaveBeenCalled();
    disconnect();
    shell.destroy();
  });

  it('destroy removes the wrapper and the container dark class', () => {
    const shell = shellFor({ darkMode: 'force' });
    expect(container.classList.contains('oc-dark')).toBe(true);

    shell.destroy();

    expect(container.querySelector('.oc-graph-wrapper')).toBeNull();
    expect(container.classList.contains('oc-dark')).toBe(false);
  });
});
