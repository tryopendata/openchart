/**
 * Graph wrapper: entrance suppression on recreation + full imperative API.
 *
 * Renders the real vanilla graph. Whether the entrance played is read off the
 * public camera: a played entrance opens pulled back from the fit and flies in,
 * a suppressed one opens on the fit. rAF and performance.now are driven by a
 * manual frame clock so that's deterministic.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FrameClock,
  installFrameClock,
  playsEntrance,
} from '../../../vanilla/src/__test-fixtures__/graph-frame-clock';
import { Graph } from '../Graph';
import type { GraphHandle } from '../hooks/useGraph';

// Warmed so the first delivered tick is near-settled and starts the entrance.
const spec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'A', kind: 'x' },
    { id: 'b', label: 'B', kind: 'y' },
    { id: 'c', label: 'C', kind: 'y' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
  encoding: { nodeColor: { field: 'kind', type: 'nominal' } },
  layout: { type: 'force', warmup: 30 },
};

let clock: FrameClock;

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  cleanup();
  clock.restore();
});

function wrapperEl(container: HTMLElement): Element | null {
  return container.querySelector('.oc-graph-wrapper');
}

describe('<Graph /> suppressEntrance', () => {
  it('plays the entrance on first mount', async () => {
    const ref = createRef<GraphHandle>();
    render(<Graph ref={ref} spec={spec} />);
    expect(await playsEntrance(clock, () => ref.current!.getCamera().k)).toBe(true);
  });

  it('a theme change recreates the graph without replaying the entrance', async () => {
    const ref = createRef<GraphHandle>();
    const { container, rerender } = render(<Graph ref={ref} spec={spec} darkMode="off" />);
    expect(await playsEntrance(clock, () => ref.current!.getCamera().k)).toBe(true);
    const first = wrapperEl(container);

    rerender(<Graph ref={ref} spec={spec} darkMode="force" />);
    // Recreated: a new wrapper, now dark.
    expect(wrapperEl(container)).not.toBe(first);
    expect(wrapperEl(container)?.classList.contains('oc-dark')).toBe(true);
    expect(await playsEntrance(clock, () => ref.current!.getCamera().k, 2000)).toBe(false);
  });

  it('StrictMode dev remount still plays the entrance (identical deps, no suppression)', async () => {
    const ref = createRef<GraphHandle>();
    const { container } = render(
      <StrictMode>
        <Graph ref={ref} spec={spec} />
      </StrictMode>,
    );
    // StrictMode runs mount, cleanup, mount; only the second graph is live and
    // it must not be mistaken for a theme-style recreation.
    expect(container.querySelectorAll('.oc-graph-wrapper')).toHaveLength(1);
    expect(await playsEntrance(clock, () => ref.current!.getCamera().k)).toBe(true);
  });

  it('a tooltip formatter change does not recreate the graph', async () => {
    const ref = createRef<GraphHandle>();
    const { container, rerender } = render(
      <Graph ref={ref} spec={spec} tooltip={{ formatter: () => 'one' }} />,
    );
    const wrapper = wrapperEl(container);
    const instance = ref.current?.instance;

    // A brand-new formatter function every render must not recreate the graph.
    rerender(<Graph ref={ref} spec={spec} tooltip={{ formatter: () => 'two' }} />);
    await act(async () => {});
    expect(wrapperEl(container)).toBe(wrapper);
    expect(ref.current?.instance).toBe(instance);
  });

  it('hover tooltips use the latest formatter prop, not the one from mount', async () => {
    const ref = createRef<GraphHandle>();
    const { container, rerender } = render(
      <Graph ref={ref} spec={spec} tooltip={{ formatter: () => 'one' }} />,
    );
    await playsEntrance(clock, () => ref.current!.getCamera().k);
    rerender(<Graph ref={ref} spec={spec} tooltip={{ formatter: () => 'two' }} />);

    // Center node `a` in the viewport, then hover the viewport center.
    ref.current!.zoomToNode('a', { duration: 0 });
    clock.pump(2000);
    const canvas = container.querySelector('canvas')!;
    const { width, height } = canvas.getBoundingClientRect();
    fireEvent.mouseMove(canvas, { clientX: width / 2, clientY: height / 2 });
    clock.pump(2050);

    await waitFor(() => expect(container.ownerDocument.body.textContent).toContain('two'));
    expect(container.ownerDocument.body.textContent).not.toContain('one');
  });
});

describe('useGraph full API', () => {
  it('exposes the full instance API on the handle and drives the real graph', async () => {
    const ref = createRef<GraphHandle>();
    render(<Graph ref={ref} spec={spec} />);
    await playsEntrance(clock, () => ref.current!.getCamera().k);
    const handle = ref.current!;

    handle.search('B');
    expect(handle.getSearchMatches()).toEqual(['b']);
    handle.clearSearch();
    expect(handle.getSearchMatches()).toEqual([]);

    handle.zoomToNode('a', { scale: 3, duration: 0 });
    const zoomed = handle.getCamera();
    handle.zoomToFit({ duration: 0 });
    expect(handle.getCamera().k).toBeLessThan(zoomed.k);

    handle.flyTo({ x: 1, y: 2, k: 3 }, { duration: 0 });
    expect(handle.getCamera().k).toBeCloseTo(3);
    const before = handle.getCamera();
    handle.centerAt(5, 6, { duration: 0 });
    const centered = handle.getCamera();
    expect(centered.k).toBeCloseTo(before.k);
    expect([centered.x, centered.y]).not.toEqual([before.x, before.y]);

    handle.selectNode('a');
    expect(handle.getSelectedNodes()).toEqual(['a']);

    handle.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.1 });
    expect(handle.getHighlight()).toEqual(['a']);
    handle.clearHighlight();
    expect(handle.getHighlight()).toBeNull();

    expect(handle.getLegend()?.field).toBe('kind');
    expect(handle.getLegend()?.nodes.map((n) => n.label)).toEqual(['x', 'y']);
    handle.setActiveCategories(['y']);
    expect(handle.getActiveCategories()).toEqual(['y']);
    expect(handle.instance?.getCamera()).toEqual(handle.getCamera());
  });
});
