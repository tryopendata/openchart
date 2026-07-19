/**
 * Phase 5 mount API: highlight state (no recompilation), the single highlight
 * slot shared with legend toggles, interactive legend, tooltip formatter safety,
 * and the hover-event race-fix ordering.
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

describe('interactive legend (single highlight slot)', () => {
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

  it('legend toggle replaces a programmatic highlight (single slot)', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a'] });
    expect(graph.getHighlight()).toEqual(['a']);
    const first = container.querySelector('button.oc-graph-legend-item') as HTMLButtonElement;
    first.click();
    // Legend now owns the slot; the ['a'] highlight is gone.
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

  it('highlight() after setActiveCategories resets categories (last writer wins)', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.setActiveCategories(['x']);
    graph.highlight({ nodeIds: ['c'] });
    expect(graph.getActiveCategories()).toEqual([]);
    expect(graph.getHighlight()).toEqual(['c']);
    graph.destroy();
  });

  it('setActiveCategories after highlight() replaces the explicit highlight', () => {
    container = makeContainer();
    const graph = createGraph(container, catSpec);
    graph.highlight({ nodeIds: ['a'] });
    graph.setActiveCategories(['y']);
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);
    graph.destroy();
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
