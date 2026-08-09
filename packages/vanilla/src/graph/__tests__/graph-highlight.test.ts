/**
 * Phase 5 mount API: highlight state (no recompilation), the transient
 * highlight layered over the sticky category filter, interactive legend,
 * tooltip formatter safety, and the hover-event race-fix ordering.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import * as engine from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';

const catSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'A', kind: 'x' },
    { id: 'b', label: 'B', kind: 'x' },
    { id: 'c', label: 'C', kind: 'y' },
    { id: 'd', label: 'D', kind: 'y' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
  ],
  encoding: { nodeColor: { field: 'kind', type: 'nominal' } },
};

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

let container: HTMLElement;
afterEach(() => {
  container?.parentNode?.removeChild(container);
  vi.restoreAllMocks();
});

describe('highlight API', () => {
  it('highlight({nodeIds}) sets and getHighlight reflects it', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a', 'b'] });
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    graph.clearHighlight();
    expect(graph.getHighlight()).toBeNull();
    graph.destroy();
  });

  it('highlight({category}) resolves the matching node ids', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ category: { field: 'kind', value: 'y' } });
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);
    graph.destroy();
  });

  it('highlight({neighborsOf}) includes the node and its neighbors', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ neighborsOf: 'b' });
    // b + a + c
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b', 'c']);
    graph.destroy();
  });

  it('highlight() never recompiles the graph', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    const spy = vi.spyOn(engine, 'compileGraph');
    graph.highlight({ category: { field: 'kind', value: 'x' } });
    graph.clearHighlight();
    expect(spy).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('fires onHighlightChange for both set and clear', () => {
    container = makeContainer();
    const onHighlightChange = vi.fn();
    const graph = createGraph(container, catSpec, { onHighlightChange });
    graph.highlight({ nodeIds: ['a'] });
    expect(onHighlightChange).toHaveBeenLastCalledWith(['a']);
    graph.clearHighlight();
    expect(onHighlightChange).toHaveBeenLastCalledWith(null);
    graph.destroy();
  });
});

describe('interactive legend (sticky category filter)', () => {
  it('renders one button per category with counts', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    const buttons = container.querySelectorAll('button.oc-graph-legend-item');
    expect(buttons.length).toBe(2); // x, y
    const counts = container.querySelectorAll('.oc-graph-legend-count');
    expect(counts.length).toBe(2);
    graph.destroy();
  });

  it('clicking a legend category toggles emphasis and fires onLegendToggle', () => {
    container = makeContainer();
    const onLegendToggle = vi.fn();
    const graph = createGraph(container, catSpec, { onLegendToggle });
    const first = container.querySelector('button.oc-graph-legend-item') as HTMLButtonElement;
    first.click();
    expect(onLegendToggle).toHaveBeenCalled();
    // Toggling on 'x' highlights the x nodes.
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    graph.destroy();
  });

  it('legend toggle layers under a programmatic highlight instead of replacing it', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a'] });
    expect(graph.getHighlight()).toEqual(['a']);
    const first = container.querySelector('button.oc-graph-legend-item') as HTMLButtonElement;
    first.click();
    // Filter is now {x} = {a, b}; the transient ['a'] still narrows inside it.
    expect(graph.getActiveCategories()).toEqual(['x']);
    expect(graph.getHighlight()).toEqual(['a']);
    // Releasing the transient falls back to the filtered view, not everything.
    graph.clearHighlight();
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    graph.destroy();
  });

  it('legend hover fires onLegendHover with the category', () => {
    container = makeContainer();
    const onLegendHover = vi.fn();
    const graph = createGraph(container, catSpec, { onLegendHover });
    const first = container.querySelector('button.oc-graph-legend-item') as HTMLButtonElement;
    first.dispatchEvent(new Event('mouseenter'));
    expect(onLegendHover).toHaveBeenCalledWith({ field: 'kind', value: expect.any(String) });
    first.dispatchEvent(new Event('mouseleave'));
    expect(onLegendHover).toHaveBeenLastCalledWith(null);
    graph.destroy();
  });

  it('legend: false renders no legend', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec, { legend: false });
    expect(container.querySelector('.oc-graph-legend')).toBeNull();
    graph.destroy();
  });

  it('spec-level legend: false renders no legend', () => {
    container = makeContainer();
    const graph = createGraph(container, { ...catSpec, legend: false });
    expect(container.querySelector('.oc-graph-legend')).toBeNull();
    graph.destroy();
  });

  it('spec-level legend config drives the interactive/counts flags', () => {
    container = makeContainer();
    const graph = createGraph(container, { ...catSpec, legend: { interactive: false } });
    // Non-interactive legends render swatches, not buttons.
    expect(container.querySelector('.oc-graph-legend')).not.toBeNull();
    expect(container.querySelector('button.oc-graph-legend-item')).toBeNull();
    graph.destroy();
  });

  it('the mount option wins over the spec (host can override a spec it does not own)', () => {
    container = makeContainer();
    const graph = createGraph(container, { ...catSpec, legend: false }, { legend: true });
    expect(container.querySelector('.oc-graph-legend')).not.toBeNull();
    graph.destroy();
  });

  it('getLegend() mirrors the rendered legend headlessly', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    const legend = graph.getLegend();
    expect(legend.field).toBe('kind');
    expect(legend.nodes.map((n) => n.label).sort()).toEqual(['x', 'y']);
    expect(legend.nodes.every((n) => n.active)).toBe(true);
    graph.destroy();
  });
});

describe('setActiveCategories / getActiveCategories', () => {
  it('sets the category filter and getHighlight reflects it', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    graph.destroy();
  });

  it('getActiveCategories reflects the set', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    expect(graph.getActiveCategories()).toEqual(['x']);
    graph.destroy();
  });

  it('setActiveCategories([]) clears the filter', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.setActiveCategories([]);
    expect(graph.getHighlight()).toBeNull();
    expect(graph.getActiveCategories()).toEqual([]);
    graph.destroy();
  });

  it('fires onHighlightChange but NOT onLegendToggle', () => {
    container = makeContainer();
    const onHighlightChange = vi.fn();
    const onLegendToggle = vi.fn();
    const graph = createGraph(container, catSpec, { onHighlightChange, onLegendToggle });
    graph.setActiveCategories(['y']);
    expect(onHighlightChange).toHaveBeenCalledWith(expect.arrayContaining(['c', 'd']));
    expect(onLegendToggle).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('highlight() after setActiveCategories keeps the filter; a disjoint highlight wins', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.highlight({ nodeIds: ['c'] });
    // The filter stands...
    expect(graph.getActiveCategories()).toEqual(['x']);
    // ...but filter ∩ transient is empty, so the transient previews on its own.
    expect(graph.getHighlight()).toEqual(['c']);
    graph.destroy();
  });

  it('highlight() layers inside the filter as an intersection', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.highlight({ nodeIds: ['a', 'c'] });
    // {a, b} ∩ {a, c} = {a}.
    expect(graph.getHighlight()).toEqual(['a']);
    expect(graph.getActiveCategories()).toEqual(['x']);
    graph.destroy();
  });

  it('setActiveCategories after highlight() keeps the transient layered on top', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a'] });
    graph.setActiveCategories(['y']);
    // Disjoint ({c, d} vs {a}) → the transient wins.
    expect(graph.getHighlight()).toEqual(['a']);
    graph.setActiveCategories(['x']);
    // Overlapping → intersection.
    expect(graph.getHighlight()).toEqual(['a']);
    graph.destroy();
  });

  it('clearHighlight() returns to the filtered view, not to everything', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.highlight({ nodeIds: ['c'] });
    graph.clearHighlight();
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    graph.destroy();
  });

  it('getActiveCategories survives a highlight/clear round trip', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['y']);
    graph.highlight({ category: { field: 'kind', value: 'x' } });
    expect(graph.getActiveCategories()).toEqual(['y']);
    graph.clearHighlight();
    expect(graph.getActiveCategories()).toEqual(['y']);
    graph.destroy();
  });

  it('getLegend() active flags track the filter only, never the transient', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ category: { field: 'kind', value: 'y' } });
    // No filter set → every category stays active despite the highlight.
    expect(graph.getLegend().nodes.every((n) => n.active)).toBe(true);

    graph.setActiveCategories(['x']);
    graph.highlight({ category: { field: 'kind', value: 'y' } });
    const byLabel = new Map(graph.getLegend().nodes.map((n) => [n.label, n.active]));
    expect(byLabel.get('x')).toBe(true);
    expect(byLabel.get('y')).toBe(false);
    graph.destroy();
  });

  it('update() does not resurrect a removed node id from the transient highlight', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a', 'b'] });
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);

    graph.update({
      ...catSpec,
      nodes: catSpec.nodes.filter((n) => n.id !== 'a'),
      edges: [
        { source: 'b', target: 'c' },
        { source: 'c', target: 'd' },
      ],
    });
    expect(graph.getHighlight()).toEqual(['b']);

    // A later recompute (triggered by a filter write) must not bring 'a' back.
    graph.setActiveCategories(['x']);
    expect(graph.getHighlight()).toEqual(['b']);
    graph.destroy();
  });

  it('a highlight matching no nodes is a no-op layer, not a filter wipe', () => {
    container = makeContainer();
    const onHighlightChange = vi.fn();
    const graph = createGraph(container, catSpec, { onHighlightChange });
    graph.setActiveCategories(['x']);
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);

    // A category matching zero nodes resolves to an EMPTY set. Treating that as
    // a layer would intersect to nothing, fall back to the empty transient, and
    // silently drop the filter's dimming.
    graph.highlight({ category: { field: 'kind', value: 'zzz' } });
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);
    expect(onHighlightChange).toHaveBeenLastCalledWith(['a', 'b']);

    // Same for an explicitly empty id list.
    graph.highlight({ nodeIds: [] });
    expect(graph.getHighlight()?.sort()).toEqual(['a', 'b']);

    // With no filter standing, an empty target leaves nothing emphasized.
    graph.setActiveCategories([]);
    graph.highlight({ nodeIds: [] });
    expect(graph.getHighlight()).toBeNull();
    graph.destroy();
  });

  it('a custom dimOpacity does not outlive the transient that set it', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.highlight({ nodeIds: ['a'] }, { dimOpacity: 0.02 });

    // Removing the only highlighted node prunes the transient to null; the
    // filter that remains must dim at the compilation default, not at 0.02.
    graph.update({
      ...catSpec,
      nodes: catSpec.nodes.filter((n) => n.id !== 'a'),
      edges: [
        { source: 'b', target: 'c' },
        { source: 'c', target: 'd' },
      ],
    });
    expect(graph.getHighlight()).toEqual(['b']);
    graph.clearHighlight();
    expect(graph.getHighlight()).toEqual(['b']);
    graph.destroy();
  });

  it('a category-form transient re-resolves against new data on update()', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ category: { field: 'kind', value: 'y' } });
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);

    // 'b' joins category y; 'd' leaves it. A frozen id set would keep
    // emphasizing 'd' and miss 'b'.
    graph.update({
      ...catSpec,
      nodes: [
        { id: 'a', label: 'A', kind: 'x' },
        { id: 'b', label: 'B', kind: 'y' },
        { id: 'c', label: 'C', kind: 'y' },
        { id: 'd', label: 'D', kind: 'x' },
      ],
    });
    expect(graph.getHighlight()?.sort()).toEqual(['b', 'c']);
    graph.destroy();
  });

  it('highlight() and clearHighlight() are inert after destroy()', () => {
    container = makeContainer();
    const onHighlightChange = vi.fn();
    const graph = createGraph(container, catSpec, { onHighlightChange });
    graph.destroy();
    onHighlightChange.mockClear();

    graph.highlight({ nodeIds: ['a'] });
    graph.clearHighlight();
    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it('getLegend() active flags match the set categories', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    const legend = graph.getLegend();
    const xEntry = legend.nodes.find((n) => n.label === 'x');
    const yEntry = legend.nodes.find((n) => n.label === 'y');
    expect(xEntry?.active).toBe(true);
    expect(yEntry?.active).toBe(false);
    graph.destroy();
  });

  it('never recompiles the graph', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    const spy = vi.spyOn(engine, 'compileGraph');
    graph.setActiveCategories(['x']);
    graph.setActiveCategories([]);
    expect(spy).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('non-existent category values round-trip but match no nodes', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['nonexistent']);
    expect(graph.getActiveCategories()).toEqual(['nonexistent']);
    // No nodes match, but activeCategories is non-empty so highlightSet is
    // a non-null empty Set. composeStandingFocus treats size-0 highlight as
    // hasHighlight=false, so nothing dims.
    const legend = graph.getLegend();
    expect(legend.nodes.every((n) => !n.active)).toBe(true);
    graph.destroy();
  });
});

describe('initialHighlight', () => {
  it('applies nodeColor.highlight on mount', () => {
    container = makeContainer();
    const spec: GraphSpec = {
      ...catSpec,
      encoding: { nodeColor: { field: 'kind', type: 'nominal', highlight: ['y'] } },
    };
    const graph = createGraph(container, spec);
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);
    graph.destroy();
  });
});
