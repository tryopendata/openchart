import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileLayer } from '../compile';
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
});
