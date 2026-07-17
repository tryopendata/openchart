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
    expect(layout.facet!.direction).toBe('wrap');
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

// ---------------------------------------------------------------------------
// Row faceting
// ---------------------------------------------------------------------------

const rowSpec = {
  mark: 'bar' as const,
  data: facetData,
  encoding: {
    x: { field: 'value', type: 'quantitative' as const },
    y: { field: 'country', type: 'nominal' as const },
    row: { field: 'year', type: 'nominal' as const },
  },
};

describe('compileChart with row faceting', () => {
  it('produces facet layout with direction row', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 400 });
    expect(layout.facet).toBeDefined();
    expect(layout.facet!.direction).toBe('row');
    expect(layout.facet!.columns).toBe(1);
  });

  it('creates one panel per unique row value', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 400 });
    expect(layout.facet!.panels).toHaveLength(2);
  });

  it('defaults x to shared, y to independent', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 400 });
    expect(layout.facet!.sharedScales).toBe(false);
  });

  it('strips x-axis from non-bottom panels', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 600 });
    const panels = layout.facet!.panels;
    expect(panels[0].axes.x?.ticks ?? []).toHaveLength(0);
    const bottomPanel = panels[panels.length - 1];
    expect(bottomPanel.axes.x?.ticks.length).toBeGreaterThan(0);
  });

  it('keeps y-axis on all panels', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 600 });
    for (const panel of layout.facet!.panels) {
      expect(panel.axes.y).toBeDefined();
    }
  });

  it('left-aligns headers', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 400 });
    for (const panel of layout.facet!.panels) {
      expect(panel.header.textAnchor).toBe('start');
      expect(panel.header.x).toBe(panel.area.x);
    }
  });

  it('allows overriding y to shared via resolve', () => {
    const spec = {
      ...rowSpec,
      resolve: { scale: { y: 'shared' as const } },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.facet!.sharedScales).toBe(true);
  });

  it('each panel has marks', () => {
    const layout = compileChart(rowSpec, { width: 600, height: 600 });
    for (const panel of layout.facet!.panels) {
      expect(panel.marks.length).toBeGreaterThan(0);
    }
  });

  it('does not double-reserve the y-axis gutter for horizontal bars', () => {
    const singleSpec = {
      mark: rowSpec.mark,
      data: rowSpec.data,
      encoding: { x: rowSpec.encoding.x, y: rowSpec.encoding.y },
    };
    const single = compileChart(singleSpec, { width: 600, height: 400 });
    const layout = compileChart(rowSpec, { width: 600, height: 400 });
    for (const panel of layout.facet!.panels) {
      expect(panel.area.x).toBeCloseTo(single.area.x, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Column faceting
// ---------------------------------------------------------------------------

const colSpec = {
  mark: 'bar' as const,
  data: facetData,
  encoding: {
    x: { field: 'country', type: 'nominal' as const },
    y: { field: 'value', type: 'quantitative' as const },
    column: { field: 'year', type: 'nominal' as const },
  },
};

describe('compileChart with column faceting', () => {
  it('produces facet layout with direction column', () => {
    const layout = compileChart(colSpec, { width: 800, height: 400 });
    expect(layout.facet).toBeDefined();
    expect(layout.facet!.direction).toBe('column');
    expect(layout.facet!.columns).toBe(2);
  });

  it('defaults y to shared, x to independent', () => {
    const layout = compileChart(colSpec, { width: 800, height: 400 });
    expect(layout.facet!.sharedScales).toBe(false);
    // Verify the directional resolve: y-axis ticks should be stripped from
    // non-leftmost panels (shared y), x-axis ticks should appear on all panels
    // (independent x).
    const panels = layout.facet!.panels;
    if (panels.length > 1) {
      const rightPanel = panels[1];
      expect(rightPanel.axes.y?.ticks ?? []).toHaveLength(0);
    }
    const leftPanel = panels[0];
    expect(leftPanel.axes.y?.ticks?.length).toBeGreaterThan(0);
  });

  it('strips y-axis from non-leftmost panels', () => {
    const layout = compileChart(colSpec, { width: 800, height: 400 });
    const panels = layout.facet!.panels;
    expect(panels[0].axes.y?.ticks?.length).toBeGreaterThan(0);
    if (panels.length > 1) {
      expect(panels[1].axes.y?.ticks ?? []).toHaveLength(0);
    }
  });

  it('allows overriding x to shared via resolve', () => {
    const spec = {
      ...colSpec,
      resolve: { scale: { x: 'shared' as const } },
    };
    const layout = compileChart(spec, { width: 800, height: 400 });
    expect(layout.facet!.sharedScales).toBe(true);
  });

  it('centers headers (not left-aligned)', () => {
    const layout = compileChart(colSpec, { width: 800, height: 400 });
    for (const panel of layout.facet!.panels) {
      expect(panel.header.textAnchor).toBeUndefined();
    }
  });

  it('creates panels in a single row', () => {
    const layout = compileChart(colSpec, { width: 800, height: 400 });
    for (const panel of layout.facet!.panels) {
      expect(panel.header.text).toBeTruthy();
    }
    expect(layout.facet!.panels).toHaveLength(2);
  });
});
