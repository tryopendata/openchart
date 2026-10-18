/**
 * Vue Graph wrapper: entrance suppression on recreation + full imperative API.
 *
 * Renders the real vanilla graph. Whether the entrance played is read off the
 * public camera: a played entrance opens pulled back from the fit and flies in,
 * a suppressed one opens on the fit. rAF and performance.now are driven by a
 * manual frame clock so that's deterministic.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import type { GraphCamera, GraphLegendData } from '@opendata-ai/openchart-vanilla';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FrameClock,
  installFrameClock,
  playsEntrance,
} from '../../../vanilla/src/__test-fixtures__/graph-frame-clock';
import { Graph } from '../Graph';

interface Handle {
  search: (q: string) => void;
  clearSearch: () => void;
  zoomToFit: (o?: unknown) => void;
  zoomToNode: (id: string, o?: unknown) => void;
  flyTo: (t: unknown, o?: unknown) => void;
  centerAt: (x: number, y: number, o?: unknown) => void;
  selectNode: (id: string, o?: unknown) => void;
  getSelectedNodes: () => string[];
  highlight: (t: unknown, o?: unknown) => void;
  clearHighlight: () => void;
  getCamera: () => GraphCamera;
  getSearchMatches: () => string[];
  getHighlight: () => string[] | null;
  getLegend: () => GraphLegendData | null;
  setActiveCategories: (values: string[]) => void;
  getActiveCategories: () => string[];
  instance: { getCamera: () => GraphCamera } | null;
}

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
let wrapper: VueWrapper | null = null;

function handle(): Handle {
  return wrapper!.vm as unknown as Handle;
}

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  clock.restore();
});

describe('Graph suppressEntrance', () => {
  it('plays the entrance on first mount', async () => {
    wrapper = mount(Graph, { props: { spec }, attachTo: document.body });
    expect(await playsEntrance(clock, () => handle().getCamera().k)).toBe(true);
  });

  it('a theme change recreates the graph without replaying the entrance', async () => {
    wrapper = mount(Graph, { props: { spec, darkMode: 'off' }, attachTo: document.body });
    expect(await playsEntrance(clock, () => handle().getCamera().k)).toBe(true);
    const first = wrapper.element.querySelector('.oc-graph-wrapper');

    await wrapper.setProps({ darkMode: 'force' });
    await flushPromises();
    // Recreated: a new wrapper, now dark.
    const second = wrapper.element.querySelector('.oc-graph-wrapper');
    expect(second).not.toBe(first);
    expect(second?.classList.contains('oc-dark')).toBe(true);
    expect(await playsEntrance(clock, () => handle().getCamera().k, 2000)).toBe(false);
  });

  it('hover tooltips use the latest formatter prop, not the one from mount', async () => {
    wrapper = mount(Graph, {
      props: { spec, tooltip: { formatter: () => 'one' } },
      attachTo: document.body,
    });
    await playsEntrance(clock, () => handle().getCamera().k);
    const graphWrapper = wrapper.element.querySelector('.oc-graph-wrapper');
    await wrapper.setProps({ tooltip: { formatter: () => 'two' } });
    await flushPromises();
    // Swapping the formatter does not recreate the graph.
    expect(wrapper.element.querySelector('.oc-graph-wrapper')).toBe(graphWrapper);

    // Center node `a` in the viewport, then hover the viewport center.
    handle().zoomToNode('a', { duration: 0 });
    clock.pump(2000);
    const canvas = wrapper.element.querySelector('canvas')!;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: width / 2, clientY: height / 2, bubbles: true }),
    );
    clock.pump(2050);

    expect(document.body.textContent).toContain('two');
    expect(document.body.textContent).not.toContain('one');
  });

  it('exposes the full instance API and drives the real graph', async () => {
    wrapper = mount(Graph, { props: { spec }, attachTo: document.body });
    await playsEntrance(clock, () => handle().getCamera().k);
    const h = handle();

    h.search('B');
    expect(h.getSearchMatches()).toEqual(['b']);
    h.clearSearch();
    expect(h.getSearchMatches()).toEqual([]);

    h.zoomToNode('a', { scale: 3, duration: 0 });
    const zoomed = h.getCamera();
    h.zoomToFit({ duration: 0 });
    expect(h.getCamera().k).toBeLessThan(zoomed.k);

    h.flyTo({ x: 1, y: 2, k: 3 }, { duration: 0 });
    expect(h.getCamera().k).toBeCloseTo(3);
    const before = h.getCamera();
    h.centerAt(5, 6, { duration: 0 });
    const centered = h.getCamera();
    expect(centered.k).toBeCloseTo(before.k);
    expect([centered.x, centered.y]).not.toEqual([before.x, before.y]);

    h.selectNode('a');
    expect(h.getSelectedNodes()).toEqual(['a']);

    h.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.1 });
    expect(h.getHighlight()).toEqual(['a']);
    h.clearHighlight();
    expect(h.getHighlight()).toBeNull();

    expect(h.getLegend()?.field).toBe('kind');
    expect(h.getLegend()?.nodes.map((n) => n.label)).toEqual(['x', 'y']);
    h.setActiveCategories(['y']);
    expect(h.getActiveCategories()).toEqual(['y']);

    expect(h.instance?.getCamera()).toEqual(h.getCamera());
  });
});
