/**
 * Svelte Graph wrapper: a `dimensions` change is a remount, not an update().
 *
 * 2D and 3D are different renderers and the renderer is chosen once, at mount,
 * so vanilla `update()` refuses a dimension change and the wrapper has to
 * destroy and recreate instead. This renders the real vanilla graph and the
 * real 3D renderer; only the WebGL libraries underneath it are faked.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
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
const Harness = (await import('./GraphSpecHarness.svelte')).default;

const spec: GraphSpec = {
  type: 'graph',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  chrome: { title: 'First' },
};

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

describe('Graph dimensions', () => {
  it('recreates the graph with the 3D renderer when dimensions change and plays the entrance', async () => {
    const controller: { setSpec?: (next: GraphSpec) => void } = {};
    const { container } = render(Harness, { props: { initialSpec: spec, controller } });
    await waitFor(() => expect(container.querySelector('canvas.oc-graph-canvas')).not.toBeNull());
    const first = container.querySelector('.oc-graph-wrapper');

    controller.setSpec?.({ ...spec, dimensions: 3 });
    await waitFor(() => expect(container.querySelector('.oc-graph-3d')).not.toBeNull());

    // The 2D graph was torn down and a single 3D graph mounted from the new spec.
    expect(first?.isConnected).toBe(false);
    expect(container.querySelectorAll('.oc-graph-wrapper')).toHaveLength(1);
    expect(container.querySelector('canvas.oc-graph-canvas')).toBeNull();
    // A suppressed entrance would have snapped the node to full opacity.
    expect(node3DOpacity('a')).toBe(0);
  });

  it('updates in place when the spec changes at the same dimensions', async () => {
    const controller: { setSpec?: (next: GraphSpec) => void } = {};
    const { container } = render(Harness, { props: { initialSpec: spec, controller } });
    await waitFor(() => expect(container.querySelector('.oc-graph-wrapper')).not.toBeNull());
    const graphWrapper = container.querySelector('.oc-graph-wrapper');

    controller.setSpec?.({
      ...spec,
      nodes: [{ id: 'a' }, { id: 'b' }],
      chrome: { title: 'Second' },
    });
    // The update reached the live graph, in the same wrapper it mounted.
    await waitFor(() => expect(container.querySelector('.oc-title')?.textContent).toBe('Second'));
    expect(container.querySelector('.oc-graph-wrapper')).toBe(graphWrapper);
    expect(container.querySelectorAll('.oc-graph-wrapper')).toHaveLength(1);
  });
});
