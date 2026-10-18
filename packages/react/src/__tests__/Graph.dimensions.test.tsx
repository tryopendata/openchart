/**
 * Graph wrapper: a `dimensions` change is a remount, not an update().
 *
 * 2D and 3D are different renderers and the renderer is chosen once, at mount,
 * so vanilla `update()` refuses a dimension change. The wrapper has to destroy
 * and recreate instead. This renders the real vanilla graph and the real 3D
 * renderer; only the WebGL libraries underneath it are faked.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// happy-dom has no WebGL, so three.js and 3d-force-graph can't run; swap in the
// vanilla package's recording fakes for those third-party libraries.
vi.mock('three', async () => await import('../../../vanilla/src/graph-3d/__tests__/three-fake'));
vi.mock(
  'three-spritetext',
  async () => await import('../../../vanilla/src/graph-3d/__tests__/spritetext-fake'),
);
vi.mock('3d-force-graph', async () => {
  const mod = await import('../../../vanilla/src/graph-3d/__tests__/force-graph-fake');
  return { default: mod.FakeForceGraph3D };
});

// Registers the 3D renderer, as an app importing the graph-3d subpath would.
await import('../../../vanilla/src/graph-3d/index');
const { forceGraphInstances, resetForceGraphFakes } = await import(
  '../../../vanilla/src/graph-3d/__tests__/force-graph-fake'
);
const { Graph } = await import('../Graph');
type GraphHandle = import('../hooks/useGraph').GraphHandle;

const spec: GraphSpec = {
  type: 'graph',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
};

function wrapperEl(container: HTMLElement): Element | null {
  return container.querySelector('.oc-graph-wrapper');
}

/** Opacity of a 3D node's material: 0 while its entrance is still to play. */
function node3DOpacity(id: string): number {
  const fake = forceGraphInstances.at(-1);
  if (!fake) throw new Error('no 3D graph mounted');
  fake.flush();
  const datum = fake.graph.nodes.find((n) => (n as { id: string }).id === id);
  const accessor = fake.props.nodeThreeObject as (d: unknown) => {
    children: Array<{ material: { opacity: number } }>;
  };
  return accessor(datum).children[0].material.opacity;
}

beforeEach(() => {
  resetForceGraphFakes();
});

afterEach(() => {
  cleanup();
});

describe('<Graph /> dimensions', () => {
  it('recreates the graph with the 3D renderer when dimensions change', () => {
    const { container, rerender } = render(<Graph spec={spec} />);
    const first = wrapperEl(container);
    expect(first?.querySelector('canvas.oc-graph-canvas')).not.toBeNull();

    rerender(<Graph spec={{ ...spec, dimensions: 3 }} />);

    // The 2D graph was torn down and a single 3D graph mounted from the new spec.
    expect(first?.isConnected).toBe(false);
    expect(container.querySelectorAll('.oc-graph-wrapper')).toHaveLength(1);
    expect(wrapperEl(container)?.querySelector('.oc-graph-3d')).not.toBeNull();
    expect(container.querySelector('canvas.oc-graph-canvas')).toBeNull();
  });

  it('lets the new renderer play its entrance', () => {
    const { rerender } = render(<Graph spec={spec} />);
    rerender(<Graph spec={{ ...spec, dimensions: 3 }} />);

    // A suppressed entrance would have snapped the node to full opacity.
    expect(node3DOpacity('a')).toBe(0);
  });

  it('updates in place when the spec changes at the same dimensions', () => {
    const ref = createRef<GraphHandle>();
    const { container, rerender } = render(<Graph ref={ref} spec={spec} />);
    const wrapper = wrapperEl(container);
    const instance = ref.current?.instance;

    rerender(<Graph ref={ref} spec={{ ...spec, nodes: [{ id: 'a' }, { id: 'b' }] }} />);

    expect(wrapperEl(container)).toBe(wrapper);
    expect(ref.current?.instance).toBe(instance);
    // The update reached the live graph: the new node is searchable.
    ref.current?.search('b');
    expect(ref.current?.getSearchMatches()).toEqual(['b']);
  });

  it('treats an explicit dimensions: 2 as unchanged from omitted', () => {
    const ref = createRef<GraphHandle>();
    const { container, rerender } = render(<Graph ref={ref} spec={spec} />);
    const wrapper = wrapperEl(container);
    const instance = ref.current?.instance;

    rerender(<Graph ref={ref} spec={{ ...spec, dimensions: 2 }} />);

    expect(wrapperEl(container)).toBe(wrapper);
    expect(ref.current?.instance).toBe(instance);
    expect(container.querySelector('.oc-graph-3d')).toBeNull();
  });
});
