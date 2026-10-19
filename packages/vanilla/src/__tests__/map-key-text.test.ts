import type { ContinuousLegendLayout } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { renderLegend } from '../renderers/legend';

it('paints engine-measured map caption rows once at their resolved positions', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const style = {
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 400,
    fill: '#222',
    lineHeight: 1.3,
  };
  const key: ContinuousLegendLayout = {
    type: 'continuous',
    mode: 'binned',
    position: 'top',
    bounds: { x: 20, y: 30, width: 350, height: 180 },
    labelStyle: style,
    bar: { x: 20, y: 110, width: 220, height: 32 },
    bins: [{ x: 20, width: 220, color: '#f7f7f7' }],
    colorStops: [],
    ticks: [],
    labelY: 170,
    title: 'Rate change',
    titleY: 54,
    textRows: [
      { text: 'Rate change', x: 20, y: 54, style, role: 'title' },
      { text: 'percentage points', x: 20, y: 88, style, role: 'unit' },
      { text: 'Near zero: −2.5 to <2.5', x: 20, y: 200, style, role: 'context' },
    ],
  };
  renderLegend(svg, key);
  expect(svg.querySelectorAll('.oc-legend-title')).toHaveLength(1);
  expect(svg.querySelector('.oc-legend-unit')?.textContent).toBe('percentage points');
  expect(svg.querySelector('.oc-legend-context')?.getAttribute('y')).toBe('200');
  expect(svg.textContent).toContain('Near zero: −2.5 to <2.5');
});
it('keeps vertical range text in the accessible legend name', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const style = {
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 400,
    fill: '#222',
    lineHeight: 1.3,
  };
  renderLegend(svg, {
    type: 'continuous',
    mode: 'binned',
    position: 'right',
    bounds: { x: 400, y: 20, width: 120, height: 100 },
    labelStyle: style,
    bar: { x: 400, y: 40, width: 14, height: 14 },
    rangeEntries: [{ index: 0, bounds: { x: 400, y: 40, width: 14, height: 14 } }],
    bins: [{ x: 400, width: 14, color: '#123' }],
    colorStops: [],
    ticks: [],
    labelY: 0,
    textRows: [
      { text: 'Rate', x: 400, y: 32, style, role: 'title' },
      { text: '< 20%', x: 422, y: 52, style, role: 'context' },
    ],
  });
  expect(svg.querySelector('.oc-legend')?.getAttribute('aria-label')).toContain('< 20%');
  expect(svg.querySelector('.oc-legend-bin')?.getAttribute('width')).toBe('14');
});

it('marks and names an active empty-string category without treating it as missing', async () => {
  const { compileGeoMap, buildGeoReaderIndex } = await import('@opendata-ai/openchart-engine');
  const { renderActiveGeoColorKeys } = await import('../map-color-key');
  const spec = {
    type: 'map' as const,
    geo: {
      projection: 'identity' as const,
      features: {
        type: 'Topology',
        objects: {
          regions: {
            type: 'GeometryCollection',
            geometries: [{ type: 'Polygon', id: 'a', arcs: [[0]] }],
          },
        },
        arcs: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
    },
    data: [{ id: 'a', category: '' }],
    encoding: { key: { field: 'id' }, color: { field: 'category', type: 'nominal' as const } },
    colorKey: { activeValue: true },
  };
  const layout = compileGeoMap(spec, { width: 600, height: 400 });
  const index = buildGeoReaderIndex(spec, layout);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  renderActiveGeoColorKeys(svg, layout, index, {
    preview: index.records[0].observation,
    pinned: [],
  });
  expect(svg.querySelector('rect[fill="none"]')).not.toBeNull();
  expect(svg.querySelector('[data-geo-active-value]')?.textContent).toBe('A: (empty)');
  expect(layout.colorKeys!.features!.missing).toBe(0);
});
