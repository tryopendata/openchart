import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';
import { flattenLayers } from '../compiler/normalize';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sharedData = [
  { month: 'Jan', sales: 100, target: 80, region: 'West' },
  { month: 'Feb', sales: 150, target: 120, region: 'West' },
  { month: 'Mar', sales: 130, target: 140, region: 'East' },
  { month: 'Apr', sales: 200, target: 160, region: 'East' },
];

const compileOpts = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// flattenLayers
// ---------------------------------------------------------------------------

describe('flattenLayers', () => {
  it('flattens a simple two-layer spec into two ChartSpecs', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar',
          data: sharedData,
          encoding: {
            x: { field: 'sales', type: 'quantitative' },
            y: { field: 'month', type: 'nominal' },
          },
        },
        {
          mark: 'line',
          data: sharedData,
          encoding: {
            x: { field: 'month', type: 'nominal' },
            y: { field: 'target', type: 'quantitative' },
          },
        },
      ],
    };

    const leaves = flattenLayers(spec);
    expect(leaves).toHaveLength(2);
    expect(leaves[0].mark).toBe('bar');
    expect(leaves[1].mark).toBe('line');
  });

  it('inherits shared data from parent when child has none', () => {
    // When children have data: [], they keep it. But if data is undefined, parent is used.
    const specNoChildData: LayerSpec = {
      data: sharedData,
      layer: [
        {
          mark: 'bar',
          encoding: {
            x: { field: 'sales', type: 'quantitative' },
            y: { field: 'month', type: 'nominal' },
          },
        } as ChartSpec,
        {
          mark: 'line',
          encoding: {
            x: { field: 'month', type: 'nominal' },
            y: { field: 'target', type: 'quantitative' },
          },
        } as ChartSpec,
      ],
    };

    const leaves = flattenLayers(specNoChildData);
    expect(leaves).toHaveLength(2);
    expect(leaves[0].data).toEqual(sharedData);
    expect(leaves[1].data).toEqual(sharedData);
  });

  it('inherits shared encoding from parent, child channels override', () => {
    const spec: LayerSpec = {
      data: sharedData,
      encoding: {
        x: { field: 'month', type: 'nominal' },
        color: { field: 'region', type: 'nominal' },
      },
      layer: [
        {
          mark: 'bar',
          encoding: {
            y: { field: 'sales', type: 'quantitative' },
          },
        } as ChartSpec,
        {
          mark: 'line',
          encoding: {
            y: { field: 'target', type: 'quantitative' },
            // Override x from parent
            x: { field: 'month', type: 'ordinal' },
          },
        } as ChartSpec,
      ],
    };

    const leaves = flattenLayers(spec);
    expect(leaves).toHaveLength(2);

    // First leaf: inherits x and color from parent, has own y
    expect(leaves[0].encoding.x?.field).toBe('month');
    expect(leaves[0].encoding.x?.type).toBe('nominal');
    expect(leaves[0].encoding.y?.field).toBe('sales');
    expect(leaves[0].encoding.color).toEqual({ field: 'region', type: 'nominal' });

    // Second leaf: overrides x, inherits color from parent, has own y
    expect(leaves[1].encoding.x?.type).toBe('ordinal');
    expect(leaves[1].encoding.y?.field).toBe('target');
    expect(leaves[1].encoding.color).toEqual({ field: 'region', type: 'nominal' });
  });

  it('chains parent transforms before child transforms', () => {
    const spec: LayerSpec = {
      data: sharedData,
      transform: [{ filter: { field: 'region', equal: 'West' } }],
      layer: [
        {
          mark: 'bar',
          transform: [{ filter: { field: 'sales', gt: 100 } }],
          encoding: {
            x: { field: 'sales', type: 'quantitative' },
            y: { field: 'month', type: 'nominal' },
          },
        } as ChartSpec,
      ],
    };

    const leaves = flattenLayers(spec);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].transform).toHaveLength(2);
    // Parent transform first
    expect(leaves[0].transform![0]).toEqual({ filter: { field: 'region', equal: 'West' } });
    // Child transform second
    expect(leaves[0].transform![1]).toEqual({ filter: { field: 'sales', gt: 100 } });
  });

  it('handles nested layers recursively', () => {
    const spec: LayerSpec = {
      data: sharedData,
      layer: [
        {
          // Nested LayerSpec
          layer: [
            {
              mark: 'bar',
              encoding: {
                x: { field: 'sales', type: 'quantitative' },
                y: { field: 'month', type: 'nominal' },
              },
            } as ChartSpec,
            {
              mark: 'line',
              encoding: {
                x: { field: 'month', type: 'nominal' },
                y: { field: 'target', type: 'quantitative' },
              },
            } as ChartSpec,
          ],
        } as LayerSpec,
        {
          mark: 'point',
          encoding: {
            x: { field: 'month', type: 'nominal' },
            y: { field: 'sales', type: 'quantitative' },
          },
        } as ChartSpec,
      ],
    };

    const leaves = flattenLayers(spec);
    expect(leaves).toHaveLength(3);
    expect(leaves[0].mark).toBe('bar');
    expect(leaves[1].mark).toBe('line');
    expect(leaves[2].mark).toBe('point');
    // All should inherit data from the top-level parent
    for (const leaf of leaves) {
      expect(leaf.data).toEqual(sharedData);
    }
  });
});

// ---------------------------------------------------------------------------
// compileLayer
// ---------------------------------------------------------------------------

describe('compileLayer', () => {
  it('compiles a basic two-layer spec into a single ChartLayout', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 10 },
            { name: 'B', value: 30 },
            { name: 'C', value: 20 },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 15 },
            { name: 'B', value: 25 },
            { name: 'C', value: 18 },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);

    // Should have a valid chart area
    expect(layout.area.width).toBeGreaterThan(0);
    expect(layout.area.height).toBeGreaterThan(0);

    // Should have marks from both layers
    expect(layout.marks.length).toBeGreaterThan(0);
  });

  it('produces combined marks from all layers', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 10 },
            { name: 'B', value: 20 },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 5 },
            { name: 'B', value: 15 },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    // Two layers each with 2 data points should produce marks from both
    expect(layout.marks.length).toBeGreaterThanOrEqual(4);
  });

  it('uses layer-level chrome over leaf chrome', () => {
    const spec: LayerSpec = {
      chrome: {
        title: 'Layer Title',
        subtitle: 'Combined view',
      },
      layer: [
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 10 }],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
          chrome: {
            title: 'Bar Title',
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    // The layer-level chrome should be used
    expect(layout.chrome.title?.text).toBe('Layer Title');
    expect(layout.chrome.subtitle?.text).toBe('Combined view');
  });

  it('unions scale domains across layers for shared scales', () => {
    // Layer 1 has values 0-50, layer 2 has values 0-100.
    // The shared scale should encompass 0-100.
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 50 }],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 100 }],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    // Layout should compile without error and have marks
    expect(layout.marks.length).toBeGreaterThan(0);
    expect(layout.area.width).toBeGreaterThan(0);
  });

  it('unions the y domain even when x is nominal', () => {
    // The channel loop used to `return` on the first channel that couldn't take
    // part. x is visited first, so a nominal x abandoned y as well: each leaf
    // then re-fit y to its own rows and every bar rendered full-height,
    // regardless of value. Bars-plus-labels is the most common layered shape
    // there is, so the function missed its own headline case.
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [{ n: 'A', v: 50 }],
          encoding: {
            x: { field: 'n', type: 'nominal' as const },
            y: { field: 'v', type: 'quantitative' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [{ n: 'B', v: 100 }],
          encoding: {
            x: { field: 'n', type: 'nominal' as const },
            y: { field: 'v', type: 'quantitative' as const },
          },
        },
      ],
    };

    const rects = compileLayer(spec, compileOpts).marks.filter((m) => m.type === 'rect');
    expect(rects).toHaveLength(2);

    // Sharing a zero-based domain, the 50-bar is exactly half the 100-bar.
    const [half, full] = rects.map((r) => (r as { height: number }).height);
    expect(half).toBeCloseTo(full / 2, 1);
  });

  it('gives layered bars the same geometry as the equivalent single chart', () => {
    // The shared domain is pinned onto each leaf as `scale.domain`, and an
    // explicit domain skips the `zero !== false` baselining a normal scale
    // applies. Without folding zero back in, the union lands as a literal
    // [50, 100] and the 50-bar collapses to a 1px sliver against its baseline.
    const encoding = {
      x: { field: 'n', type: 'nominal' as const },
      y: { field: 'v', type: 'quantitative' as const },
    };
    const heights = (layout: { marks: Array<{ type: string }> }) =>
      layout.marks
        .filter((m) => m.type === 'rect')
        .map((r) => Number((r as unknown as { height: number }).height.toFixed(1)));

    const single = compileChart(
      {
        mark: 'bar',
        data: [
          { n: 'A', v: 50 },
          { n: 'B', v: 100 },
        ],
        encoding,
      },
      compileOpts,
    );
    const layered = compileLayer(
      {
        layer: [
          { mark: 'bar' as const, data: [{ n: 'A', v: 50 }], encoding },
          { mark: 'bar' as const, data: [{ n: 'B', v: 100 }], encoding },
        ],
      },
      compileOpts,
    );

    expect(heights(layered)).toEqual(heights(single));
  });

  it('compiles a single-layer LayerSpec identically to a ChartSpec', () => {
    const chartData = [
      { name: 'A', value: 10 },
      { name: 'B', value: 30 },
    ];

    const layerSpec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: chartData,
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(layerSpec, compileOpts);
    expect(layout.area.width).toBeGreaterThan(0);
    expect(layout.marks.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Independent y-scales (dual-axis)
  // -------------------------------------------------------------------------

  it('produces a y2 axis when resolve.scale.y is independent', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { year: '2025', revenue: 10_000_000 },
            { year: '2026', revenue: 15_000_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const, axis: { title: 'Revenue ($)' } },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { year: '2025', enrollment: 30_000 },
            { year: '2026', enrollment: 40_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: {
              field: 'enrollment',
              type: 'quantitative' as const,
              axis: { title: 'Enrollment' },
            },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);

    expect(layout.axes.y2).toBeDefined();
    expect(layout.axes.y2!.orient).toBe('right');
    expect(layout.axes.y).toBeDefined();
    expect(layout.axes.x).toBeDefined();
  });

  it('positions y2 axis title on the right side of the chart', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { year: '2025', revenue: 10_000_000 },
            { year: '2026', revenue: 15_000_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const, axis: { title: 'Revenue ($)' } },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { year: '2025', enrollment: 30_000 },
            { year: '2026', enrollment: 40_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: {
              field: 'enrollment',
              type: 'quantitative' as const,
              axis: { title: 'Enrollment' },
            },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const y1Title = layout.axes.y!.titlePosition;
    const y2Title = layout.axes.y2!.titlePosition;

    expect(y1Title).toBeDefined();
    expect(y2Title).toBeDefined();

    // y1 title should be left of chart area, y2 title should be right
    expect(y1Title!.x).toBeLessThan(layout.area.x);
    expect(y2Title!.x).toBeGreaterThan(layout.area.x + layout.area.width);

    // y2 title should rotate clockwise (90), y1 counter-clockwise (-90)
    expect(y1Title!.angle).toBe(-90);
    expect(y2Title!.angle).toBe(90);
  });

  it('tags layer-1 marks with yScale y2', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [{ year: '2025', revenue: 10_000_000 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [{ year: '2025', enrollment: 30_000 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'enrollment', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const y2Marks = layout.marks.filter((m) => m.yScale === 'y2');
    expect(y2Marks.length).toBeGreaterThan(0);
  });

  it('strips gridlines from y2 axis', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [{ year: '2025', revenue: 10_000_000 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [{ year: '2025', enrollment: 30_000 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'enrollment', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    expect(layout.axes.y2!.gridlines).toEqual([]);
  });

  it('produces no y2 axis when resolve is absent', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 10 }],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 20 }],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    expect(layout.axes.y2).toBeUndefined();
  });

  it('produces mixed mark types from bar + line layers', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { year: '2025', revenue: 10_000_000 },
            { year: '2026', revenue: 15_000_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { year: '2025', enrollment: 30_000 },
            { year: '2026', enrollment: 40_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'enrollment', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const markTypes = new Set(layout.marks.map((m) => m.type));
    expect(markTypes.has('rect')).toBe(true);
    expect(markTypes.has('line')).toBe(true);
  });

  it('throws on >2 layers with independent y-scales', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [{ year: '2025', a: 10 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'a', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [{ year: '2025', b: 20 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'b', type: 'quantitative' as const },
          },
        },
        {
          mark: 'area' as const,
          data: [{ year: '2025', c: 30 }],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'c', type: 'quantitative' as const },
          },
        },
      ],
    };

    expect(() => compileLayer(spec, compileOpts)).toThrow(/at most 2 layers/);
  });

  it('throws on mismatched x-field types across layers', () => {
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [{ year: '2025', a: 10 }],
          encoding: {
            x: { field: 'year', type: 'nominal' as const },
            y: { field: 'a', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [{ year: '2025-01-01', b: 20 }],
          encoding: {
            x: { field: 'year', type: 'temporal' as const },
            y: { field: 'b', type: 'quantitative' as const },
          },
        },
      ],
    };

    expect(() => compileLayer(spec, compileOpts)).toThrow(/matching x-field types/);
  });

  it('deduplicates legend entries when layers share a color field', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 10, cat: 'X' },
            { name: 'B', value: 20, cat: 'Y' },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
            color: { field: 'cat', type: 'nominal' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [
            { name: 'A', value: 5, cat: 'X' },
            { name: 'B', value: 15, cat: 'Y' },
          ],
          encoding: {
            x: { field: 'value', type: 'quantitative' as const },
            y: { field: 'name', type: 'nominal' as const },
            color: { field: 'cat', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    // Should have exactly 2 legend entries (X, Y), not 4
    const uniqueLabels = new Set(layout.legend.entries.map((e) => e.label));
    expect(uniqueLabels.size).toBe(2);
    expect(uniqueLabels.has('X')).toBe(true);
    expect(uniqueLabels.has('Y')).toBe(true);
  });

  /**
   * `legends` is the slot the renderer iterates; `legend` is the back-compat
   * alias. The merge used to rebuild only `legend`, leaving `legends[0]` as the
   * primary leaf's *pre-merge* legend -- so the second layer's series silently
   * vanished from the drawn key while `layout.legend` still listed it.
   *
   * The leaves must color on DIFFERENT fields to exercise this: sharing one field
   * makes the primary spec's concatenated data yield both entries on its own, and
   * the merge becomes a no-op that proves nothing.
   */
  it('merges layer legend entries into `legends`, not just `legend`', () => {
    const spec: LayerSpec = {
      layer: [
        {
          mark: 'bar' as const,
          data: [{ name: 'A', value: 10, cat: 'Bars' }],
          encoding: {
            x: { field: 'name', type: 'ordinal' as const },
            y: { field: 'value', type: 'quantitative' as const },
            color: { field: 'cat', type: 'nominal' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [{ name: 'A', value: 8, series: 'Trend' }],
          encoding: {
            x: { field: 'name', type: 'ordinal' as const },
            y: { field: 'value', type: 'quantitative' as const },
            color: { field: 'series', type: 'nominal' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const rendered = layout.legends[0];
    expect('entries' in rendered).toBe(true);
    if (!('entries' in rendered)) return;

    const labels = rendered.entries.map((e) => e.label);
    expect(labels).toContain('Bars');
    expect(labels).toContain('Trend');
    // What renders is what `legend` advertises.
    expect(labels).toEqual(layout.legend.entries.map((e) => e.label));
  });

  it('remaps x-coordinates when area is layer 0 and bars are layer 1', () => {
    // Inverse ordering: area/line on left axis, bars on right. The x-remapping
    // logic must detect that layer 1 has bars and remap layer 0's area mark instead.
    const years = ['2020', '2021', '2022', '2023'];
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'area' as const,
          data: years.map((y, i) => ({ year: y, temp: 60 + i * 3 })),
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'temp', type: 'quantitative' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: years.map((y, i) => ({ year: y, precip: i * 0.5 })),
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'precip', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);

    // y2 axis belongs to the bar layer (layer 1)
    expect(layout.axes.y2).toBeDefined();
    expect(layout.axes.y2!.orient).toBe('right');

    // Area marks come from layer 0 (left axis, no yScale tag)
    const areaMarks = layout.marks.filter((m) => m.type === 'area');
    expect(areaMarks.length).toBeGreaterThan(0);
    for (const m of areaMarks) {
      expect(m.yScale).toBeUndefined();
    }

    // Rect marks come from layer 1 (right axis, yScale: 'y2')
    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    expect(rectMarks.length).toBeGreaterThan(0);
    for (const m of rectMarks) {
      expect(m.yScale).toBe('y2');
    }
  });

  it('offsets layer-1 discrete mark tooltip keys by layer-0 mark count', () => {
    // Bars in layer 0 and layer 1. Each bar layer has 2 bars.
    // Layer 0 bar at index 0 -> key 'rect-0', layer 1 bar at index 0 -> key 'rect-2'
    // (offset by 2, the number of marks in layer 0).
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { year: '2020', a: 10 },
            { year: '2021', a: 20 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'a', type: 'quantitative' as const },
          },
        },
        {
          mark: 'bar' as const,
          data: [
            { year: '2020', b: 5 },
            { year: '2021', b: 15 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'b', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const l0RectCount = layout.marks
      .slice(0, layout.marks.length)
      .filter((m, i) => m.type === 'rect' && i < layout.marks.length / 2).length;

    // Every rect mark in the combined array should have a tooltip descriptor
    // under its actual combined-array index key.
    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    for (let i = 0; i < rectMarks.length; i++) {
      const globalIndex = layout.marks.indexOf(rectMarks[i]);
      expect(layout.tooltipDescriptors.has(`rect-${globalIndex}`)).toBe(true);
    }

    // No stale 'l1-rect-N' prefixed keys should exist
    for (const key of layout.tooltipDescriptors.keys()) {
      expect(key).not.toMatch(/^l1-/);
    }

    void l0RectCount; // used for conceptual clarity above
  });

  it('positions leaf-layer marks in the primary layout coordinate space', () => {
    // Regression: leaves were compiled without the layer-level chrome, legend,
    // and theme that buildPrimarySpec merges into the primary spec, so their
    // marks landed in a different chart area than the rendered axes. A scatter
    // with a title + top legend drew every bubble up-and-left of where the
    // axis said it should be.
    const spec: LayerSpec = {
      chrome: { title: 'Scatter with diagonal', subtitle: 'primary vs leaf areas' },
      legend: { position: 'top' },
      layer: [
        {
          mark: { type: 'point', filled: true },
          data: [
            { x: 10, y: 10, group: 'a' },
            { x: 50, y: 50, group: 'b' },
            { x: 90, y: 90, group: 'a' },
          ],
          encoding: {
            x: {
              field: 'x',
              type: 'quantitative' as const,
              scale: { domain: [0, 100], nice: false },
            },
            y: {
              field: 'y',
              type: 'quantitative' as const,
              scale: { domain: [0, 100], nice: false },
            },
            color: { field: 'group', type: 'nominal' as const },
          },
        },
        {
          mark: { type: 'rule', stroke: '#888', strokeWidth: 1 },
          data: [{ x: 0, y: 0, x2: 100, y2: 100 }],
          encoding: {
            x: {
              field: 'x',
              type: 'quantitative' as const,
              scale: { domain: [0, 100], nice: false },
            },
            y: {
              field: 'y',
              type: 'quantitative' as const,
              scale: { domain: [0, 100], nice: false },
            },
            x2: { field: 'x2' },
            y2: { field: 'y2' },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);

    // Axis-implied pixel position for a data value, derived from rendered ticks.
    const xTicks = layout.axes.x?.ticks ?? [];
    const yTicks = layout.axes.y?.ticks ?? [];
    expect(xTicks.length).toBeGreaterThanOrEqual(2);
    expect(yTicks.length).toBeGreaterThanOrEqual(2);
    const xFirst = xTicks[0];
    const xLast = xTicks[xTicks.length - 1];
    const yFirst = yTicks[0];
    const yLast = yTicks[yTicks.length - 1];
    const axisX = (v: number) =>
      xFirst.position +
      ((v - (xFirst.value as number)) / ((xLast.value as number) - (xFirst.value as number))) *
        (xLast.position - xFirst.position);
    const axisY = (v: number) =>
      yFirst.position +
      ((v - (yFirst.value as number)) / ((yLast.value as number) - (yFirst.value as number))) *
        (yLast.position - yFirst.position);

    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBe(3);
    const expected = [10, 50, 90];
    points.forEach((mark, i) => {
      const pm = mark as unknown as { cx: number; cy: number };
      expect(Math.abs(pm.cx - axisX(expected[i]))).toBeLessThan(1.5);
      expect(Math.abs(pm.cy - axisY(expected[i]))).toBeLessThan(1.5);
    });

    // The diagonal rule from the second leaf must span the same coordinate space.
    const rule = layout.marks.find((m) => m.type === 'rule') as unknown as
      | { x1: number; y1: number; x2: number; y2: number }
      | undefined;
    expect(rule).toBeDefined();
    if (rule) {
      expect(Math.abs(rule.x1 - axisX(0))).toBeLessThan(1.5);
      expect(Math.abs(rule.x2 - axisX(100))).toBeLessThan(1.5);
      expect(Math.abs(rule.y1 - axisY(0))).toBeLessThan(1.5);
      expect(Math.abs(rule.y2 - axisY(100))).toBeLessThan(1.5);
    }
  });

  it('shares one temporal x-domain across dual-axis layers with disjoint ranges', () => {
    // Regression guard: compileLayerIndependent unions the x-domain so both
    // layers render against ONE shared x-scale (see feat 70cf379). If a layer's
    // x-domain were derived only from its own rows, two series covering different
    // date ranges would each stretch to the full plot width and draw on top of
    // each other, with an x-axis labelled from only one layer — visually broken.
    //
    // Here layer A spans Jan–Feb and layer B spans Mar–Apr. On a shared domain
    // (Jan–Apr) A must sit in the LEFT half and B in the RIGHT half, strictly
    // separated. This is exactly the case a "skip x-union for continuous scales"
    // change breaks, so it must stay covered.
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'line' as const,
          data: [
            { d: '2024-01-01', a: 10 },
            { d: '2024-02-01', a: 20 },
          ],
          encoding: {
            x: { field: 'd', type: 'temporal' as const },
            y: { field: 'a', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { d: '2024-03-01', b: 5 },
            { d: '2024-04-01', b: 8 },
          ],
          encoding: {
            x: { field: 'd', type: 'temporal' as const },
            y: { field: 'b', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const lines = layout.marks.filter((m) => m.type === 'line') as unknown as {
      points: { x: number }[];
    }[];
    expect(lines).toHaveLength(2);

    const areaMidX = layout.area.x + layout.area.width / 2;
    const layerAXs = lines[0].points.map((p) => p.x);
    const layerBXs = lines[1].points.map((p) => p.x);

    // Shared domain ⇒ Jan–Feb (layer A) sits left of centre, Mar–Apr (layer B)
    // sits right of centre, and the two ranges don't overlap.
    expect(Math.max(...layerAXs)).toBeLessThan(areaMidX);
    expect(Math.min(...layerBXs)).toBeGreaterThan(areaMidX);
    expect(Math.max(...layerAXs)).toBeLessThan(Math.min(...layerBXs));
  });

  it('keeps dual-axis lines continuous when the two layers have interleaved x-values', () => {
    // Regression guard for the "line drawn with gaps" bug. The shared x-domain
    // used to be achieved by injecting the OTHER layer's x-values as placeholder
    // rows with no y-field. Those became null-y points, which line compute treats
    // as line breaks — so two temporal series with interleaved dates each drew as
    // disconnected segments. The fix pins an explicit union domain instead of
    // touching mark data, so each series stays a single unbroken path.
    //
    // Layer A: Jan, Mar, May. Layer B: Feb, Apr, Jun. Sorted together the dates
    // interleave, which is exactly the arrangement that produced mid-line breaks.
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'line' as const,
          data: [
            { d: '2024-01-01', a: 10 },
            { d: '2024-03-01', a: 20 },
            { d: '2024-05-01', a: 15 },
          ],
          encoding: {
            x: { field: 'd', type: 'temporal' as const },
            y: { field: 'a', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { d: '2024-02-01', b: 5 },
            { d: '2024-04-01', b: 8 },
            { d: '2024-06-01', b: 6 },
          ],
          encoding: {
            x: { field: 'd', type: 'temporal' as const },
            y: { field: 'b', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);
    const lines = layout.marks.filter((m) => m.type === 'line') as unknown as {
      path: string;
      points: { x: number }[];
      data: unknown[];
    }[];
    expect(lines).toHaveLength(2);

    for (const line of lines) {
      // Exactly one `M` command ⇒ one unbroken subpath (no injected null breaks).
      expect((line.path.match(/M/g) ?? []).length).toBe(1);
      // No placeholder rows leaked into the mark: 3 real points per series.
      expect(line.points).toHaveLength(3);
      expect(line.data).toHaveLength(3);
    }
  });

  it('remaps a dual-axis line onto all bar band centres across a category union', () => {
    // The bar+line dual-axis path reads band centres for every category from the
    // bar layer's axis ticks. With the union pinned as an explicit discrete
    // domain on both leaves, the band scale must still enumerate categories from
    // BOTH layers so the line's points remap onto real centres.
    const spec: LayerSpec = {
      resolve: { scale: { y: 'independent' } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { yr: '2024', bars: 100 },
            { yr: '2025', bars: 120 },
          ],
          encoding: {
            x: { field: 'yr', type: 'ordinal' as const },
            y: { field: 'bars', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { yr: '2025', ln: 3 },
            { yr: '2026', ln: 5 },
          ],
          encoding: {
            x: { field: 'yr', type: 'ordinal' as const },
            y: { field: 'ln', type: 'quantitative' as const },
          },
        },
      ],
    };

    const layout = compileLayer(spec, compileOpts);

    // The x-axis enumerates the ordered union of both layers' categories.
    const tickLabels = (layout.axes.x?.ticks ?? []).map((t) => String(t.label));
    expect(tickLabels).toEqual(['2024', '2025', '2026']);

    const line = layout.marks.find((m) => m.type === 'line') as unknown as {
      points: { x: number }[];
    };
    expect(line).toBeDefined();
    // Every line point remapped to a finite band centre inside the plot area.
    for (const p of line.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(layout.area.x);
      expect(p.x).toBeLessThanOrEqual(layout.area.x + layout.area.width);
    }
  });
});
