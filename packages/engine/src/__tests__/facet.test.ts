import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import { autoColumns, computeFacetGrid } from '../layout/facet';

const facetData = [
  { year: '2020', country: 'US', value: 100 },
  { year: '2021', country: 'US', value: 120 },
  { year: '2020', country: 'UK', value: 80 },
  { year: '2021', country: 'UK', value: 90 },
  { year: '2020', country: 'DE', value: 70 },
  { year: '2021', country: 'DE', value: 85 },
];

const facetSpec = {
  mark: 'line' as const,
  data: facetData,
  encoding: {
    x: { field: 'year', type: 'ordinal' as const },
    y: { field: 'value', type: 'quantitative' as const },
    facet: { field: 'country', type: 'nominal' as const },
  },
};

describe('autoColumns', () => {
  it('returns sqrt-based columns for moderate panel counts', () => {
    expect(autoColumns(4, 800)).toBe(2);
    expect(autoColumns(9, 1200)).toBe(3);
  });

  it('caps columns by available width', () => {
    expect(autoColumns(9, 400)).toBe(2);
  });

  it('returns 1 for single panel', () => {
    expect(autoColumns(1, 800)).toBe(1);
  });

  it('does not exceed panel count', () => {
    expect(autoColumns(2, 2000)).toBe(2);
  });
});

describe('computeFacetGrid', () => {
  it('returns empty result for 0 panels', () => {
    const result = computeFacetGrid(
      [],
      undefined,
      { x: 0, y: 0, width: 600, height: 400 },
      {
        left: 40,
        bottom: 30,
      },
    );
    expect(result.panels).toEqual([]);
    expect(result.columns).toBe(0);
    expect(result.rows).toBe(0);
  });

  it('computes correct number of panels', () => {
    const result = computeFacetGrid(
      ['A', 'B', 'C', 'D'],
      2,
      { x: 0, y: 0, width: 600, height: 400 },
      { left: 40, bottom: 30 },
    );
    expect(result.panels).toHaveLength(4);
    expect(result.columns).toBe(2);
    expect(result.rows).toBe(2);
  });

  it('assigns correct row and col indices', () => {
    const result = computeFacetGrid(
      ['A', 'B', 'C'],
      2,
      { x: 0, y: 0, width: 600, height: 400 },
      { left: 40, bottom: 30 },
    );
    expect(result.panels[0]).toMatchObject({ key: 'A', row: 0, col: 0 });
    expect(result.panels[1]).toMatchObject({ key: 'B', row: 0, col: 1 });
    expect(result.panels[2]).toMatchObject({ key: 'C', row: 1, col: 0 });
  });

  it('panels do not overlap', () => {
    const result = computeFacetGrid(
      ['A', 'B', 'C', 'D', 'E', 'F'],
      3,
      { x: 0, y: 0, width: 800, height: 600 },
      { left: 40, bottom: 30 },
    );
    for (let i = 0; i < result.panels.length; i++) {
      for (let j = i + 1; j < result.panels.length; j++) {
        const a = result.panels[i].area;
        const b = result.panels[j].area;
        const xOverlap = a.x < b.x + b.width && a.x + a.width > b.x;
        const yOverlap = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(xOverlap && yOverlap).toBe(false);
      }
    }
  });

  it('degrades columns when panels would be too narrow', () => {
    const result = computeFacetGrid(
      ['A', 'B', 'C', 'D'],
      4,
      { x: 0, y: 0, width: 400, height: 400 },
      { left: 40, bottom: 30 },
    );
    expect(result.columns).toBeLessThan(4);
    for (const panel of result.panels) {
      expect(panel.area.width).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps panel height to zero for tiny containers', () => {
    const result = computeFacetGrid(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      1,
      { x: 0, y: 0, width: 400, height: 100 },
      { left: 40, bottom: 30 },
    );
    for (const panel of result.panels) {
      expect(panel.area.height).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('compileChart with facet', () => {
  it('populates layout.facet with correct panel count', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    expect(layout.facet).toBeDefined();
    expect(layout.facet!.panels).toHaveLength(3);
    expect(layout.facet!.facetField).toBe('country');
  });

  it('sorts panels ascending by default', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    const keys = layout.facet!.panels.map((p) => p.key);
    expect(keys).toEqual(['DE', 'UK', 'US']);
  });

  it('respects descending sort', () => {
    const spec = {
      ...facetSpec,
      encoding: {
        ...facetSpec.encoding,
        facet: { ...facetSpec.encoding.facet, sort: 'descending' as const },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    const keys = layout.facet!.panels.map((p) => p.key);
    expect(keys).toEqual(['US', 'UK', 'DE']);
  });

  it('preserves data order with sort: null', () => {
    const spec = {
      ...facetSpec,
      encoding: {
        ...facetSpec.encoding,
        facet: { ...facetSpec.encoding.facet, sort: null },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    const keys = layout.facet!.panels.map((p) => p.key);
    expect(keys).toEqual(['US', 'UK', 'DE']);
  });

  it('uses shared scales by default', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    expect(layout.facet!.sharedScales).toBe(true);
  });

  it('supports independent y scales via resolve', () => {
    const spec = {
      ...facetSpec,
      resolve: { scale: { y: 'independent' as const } },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.facet!.sharedScales).toBe(false);
  });

  it('each panel has marks and axes', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    for (const panel of layout.facet!.panels) {
      expect(panel.marks.length).toBeGreaterThan(0);
      expect(panel.area.width).toBeGreaterThan(0);
      expect(panel.area.height).toBeGreaterThan(0);
      expect(panel.header.text).toBeTruthy();
    }
  });

  it('figure-level axes are undefined when faceted', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    expect(layout.axes.x).toBeUndefined();
    expect(layout.axes.y).toBeUndefined();
  });

  it('marks union includes all panel marks', () => {
    const layout = compileChart(facetSpec, { width: 600, height: 400 });
    const panelMarkCount = layout.facet!.panels.reduce((sum, p) => sum + p.marks.length, 0);
    expect(layout.marks.length).toBe(panelMarkCount);
  });

  it('non-faceted spec produces no facet layout', () => {
    const spec = {
      mark: 'line' as const,
      data: facetData,
      encoding: {
        x: { field: 'year', type: 'ordinal' as const },
        y: { field: 'value', type: 'quantitative' as const },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.facet).toBeUndefined();
  });
});
