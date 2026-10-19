import type { ChartSpec, DesignDiagnostic, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

function area(names: string[]): ChartSpec {
  return {
    mark: 'area',
    data: names.flatMap((series, index) =>
      [1, 2, 3].map((x) => ({ x, series, value: 20 + index * 10 })),
    ),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
    endpointLabels: {
      placement: 'interior',
      anchor: 'band',
      ends: 'both',
      format: '.1f',
      showLeader: false,
    },
  };
}

const spec: LayerSpec = {
  layer: [area(['A', 'B']), area(['C', 'D'])],
  resolve: { scale: { y: 'independent' } },
};

describe('independent area identification', () => {
  it('keeps a solo area sparkline tight when no color grouping exists', () => {
    const layout = compileChart(
      {
        mark: 'area',
        display: 'sparkline',
        data: [
          { x: 1, value: 4000 },
          { x: 2, value: 4010 },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      { width: 300, height: 100 },
    );
    const mark = layout.marks.find((item) => item.type === 'area');
    expect(mark?.type).toBe('area');
    if (mark?.type !== 'area') return;
    const ys = mark.topPoints.map((point) => point.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(layout.area.height * 0.8);
  });
  it.each([
    undefined,
    'zero',
    'normalize',
    'center',
  ] as const)('retains the full stacked domain for %s offsets before anchoring labels', (stack) => {
    const input: LayerSpec = {
      ...spec,
      layer: [area(['A', 'B']), area(['C', 'D'])].map((leaf) => ({
        ...leaf,
        encoding: { ...leaf.encoding, y: { ...leaf.encoding!.y!, stack } },
      })),
    };
    const layout = compileLayer(input, { width: 1024, height: 500 });
    for (const mark of layout.marks) {
      if (mark.type !== 'area') continue;
      for (const point of [...mark.topPoints, ...mark.bottomPoints]) {
        expect(point.y).toBeGreaterThanOrEqual(layout.area.y - 1e-6);
        expect(point.y).toBeLessThanOrEqual(layout.area.y + layout.area.height + 1e-6);
      }
    }
    for (const entries of [layout.endpointLabels!.entries, layout.endpointLabels!.leading!]) {
      const sorted = [...entries].sort((a, b) => a.labelY - b.labelY);
      for (let index = 1; index < sorted.length; index++) {
        expect(sorted[index].labelY - sorted[index - 1].labelY).toBeGreaterThanOrEqual(35);
      }
    }
  });
  it('retains every name and authored value format when independent interiors cannot be combined', () => {
    const diagnostics: DesignDiagnostic[] = [];
    const layout = compileLayer(spec, {
      width: 1024,
      height: 500,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(layout.endpointLabels?.interior ?? []).toHaveLength(0);
    for (const entries of [layout.endpointLabels!.entries, layout.endpointLabels!.leading!]) {
      expect(entries.map((entry) => entry.seriesKey).sort()).toEqual(['A', 'B', 'C', 'D']);
      for (const entry of entries) {
        expect(entry.labelLines).toContain(entry.seriesKey);
        expect(entry.value).toMatch(/^(20|30)\.0$/);
        expect(entry.source?.observed).toBe(true);
      }
    }
    expect(
      diagnostics
        .filter((item) => item.code === 'LAYER_INTERIOR_LABEL_FALLBACK')
        .map((item) => item.path),
    ).toEqual(['/resolve/scale/y', '/resolve/scale/y']);
    expect(
      spec.layer.every(
        (leaf) =>
          'endpointLabels' in leaf &&
          typeof leaf.endpointLabels === 'object' &&
          leaf.endpointLabels?.placement === 'interior',
      ),
    ).toBe(true);
  });

  it('keeps required band leaders on both merged columns even when optional leaders are disabled', () => {
    const layout = compileLayer(spec, { width: 1024, height: 500 });
    for (const entries of [layout.endpointLabels!.entries, layout.endpointLabels!.leading!]) {
      expect(entries).toHaveLength(4);
      expect(entries.every((entry) => entry.showLeader)).toBe(true);
    }
  });

  it('applies the fallback after resolving root endpoint settings over leaf settings', () => {
    const rootAuthored: LayerSpec = {
      ...spec,
      layer: [area(['A', 'B']), area(['C', 'D'])].map((leaf) => ({
        ...leaf,
        endpointLabels: undefined,
      })),
      endpointLabels: { placement: 'interior', anchor: 'band', format: '.1f' },
    };
    const layout = compileLayer(rootAuthored, { width: 1024, height: 500 });
    expect(layout.endpointLabels?.interior ?? []).toHaveLength(0);
    expect(
      layout.endpointLabels!.entries.map((entry) => entry.labelLines.join(' ')).sort(),
    ).toEqual(['A', 'B', 'C', 'D']);
    expect(rootAuthored.endpointLabels).toEqual({
      placement: 'interior',
      anchor: 'band',
      format: '.1f',
    });
  });
});
