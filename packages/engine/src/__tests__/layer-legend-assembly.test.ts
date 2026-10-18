import type { ChartSpec, LayerSpec, LegendConfig } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileLayer } from '../compile';

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
    endpointLabels: { placement: 'interior', anchor: 'band', ends: 'both' },
  };
}
function input(legend: LegendConfig = {}, long = false): LayerSpec {
  const names = long
    ? [
        'Alpha comparison group',
        'Beta comparison group',
        'Gamma comparison group',
        'Delta comparison group',
      ]
    : ['A', 'B', 'C', 'D'];
  return {
    layer: [area(names.slice(0, 2)), area(names.slice(2))],
    resolve: { scale: { y: 'independent' } },
    legend,
    chrome: {
      title: 'Four independent series',
      subtitle: 'The full legend has one measured reservation',
      source: 'Source: fixture',
    },
  };
}

describe('independent layer categorical legend assembly', () => {
  it.each([
    'top',
    'bottom',
    'right',
    'bottom-right',
  ] as const)('places every merged %s entry within its reserved bounds', (position) => {
    const layout = compileLayer(input({ position }), { width: 390, height: 500 });
    const legend = layout.legend;
    if (!('entries' in legend)) throw new Error('Expected categorical legend');
    expect(legend.entries.map((entry) => entry.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(legend.entryPositions).toHaveLength(4);
    for (const entry of legend.entryPositions!) {
      expect(entry.x).toBeGreaterThanOrEqual(legend.bounds.x - 1e-6);
      expect(entry.x + entry.width).toBeLessThanOrEqual(
        legend.bounds.x + legend.bounds.width + 1e-6,
      );
      expect(entry.y).toBeGreaterThanOrEqual(legend.bounds.y - 1e-6);
      expect(entry.y + legend.swatchSize).toBeLessThanOrEqual(
        legend.bounds.y + legend.bounds.height + 1e-6,
      );
    }
    if (position === 'top')
      expect(legend.bounds.y + legend.bounds.height).toBeLessThanOrEqual(layout.area.y);
    if (position === 'bottom')
      expect(legend.bounds.y).toBeGreaterThanOrEqual(layout.area.y + layout.area.height);
    if (position === 'right' || position === 'bottom-right')
      expect(legend.bounds.x).toBeGreaterThanOrEqual(layout.area.x + layout.area.width);
  });

  it.each([
    390, 1280,
  ])('reserves complete wrapped top legend rows without invading chrome at %spx', (width) => {
    const layout = compileLayer(input({ position: 'top', maxRows: 4 }, true), {
      width,
      height: 600,
    });
    const legend = layout.legend;
    if (!('entries' in legend)) throw new Error('Expected categorical legend');
    expect(legend.entries).toHaveLength(4);
    expect(legend.entryPositions).toHaveLength(4);
    const last = Math.max(...legend.entryPositions!.map((entry) => entry.y + legend.swatchSize));
    expect(last).toBeLessThanOrEqual(legend.bounds.y + legend.bounds.height + 1e-6);
    expect(legend.bounds.y).toBeGreaterThanOrEqual(layout.chrome.topHeight);
    expect(legend.bounds.y + legend.bounds.height).toBeLessThanOrEqual(layout.area.y);
  });

  it('keeps authored hiding and applies limits to the complete merged set', () => {
    const hidden = compileLayer(input({ show: false }), { width: 390, height: 500 });
    expect('entries' in hidden.legend ? hidden.legend.entries : []).toHaveLength(0);
    const limited = compileLayer(input({ show: true, symbolLimit: 2 }), {
      width: 390,
      height: 500,
    });
    if (!('entries' in limited.legend)) throw new Error('Expected categorical legend');
    expect(limited.legend.entries).toHaveLength(3);
    expect(limited.legend.entries.slice(0, 2).map((entry) => entry.label)).toEqual(['A', 'B']);
    expect(limited.legend.entries.at(-1)?.label).toContain('more');
  });
});

it('collects transformed categories and does not invent an explicitly hidden leaf legend', () => {
  const source: LayerSpec = {
    ...input(),
    legend: undefined,
    layer: [
      { ...area(['A', 'B']), legend: { show: false } },
      {
        ...area(['C', 'D']),
        legend: { show: true, position: 'bottom' },
        transform: [{ filter: { field: 'series', equal: 'D' } }],
      },
    ],
  };
  const layout = compileLayer(source, { width: 390, height: 500 });
  if (!('entries' in layout.legend)) throw new Error('Expected categorical legend');
  expect(layout.legend.entries.map((entry) => entry.label)).toEqual(['D']);
  expect(layout.legend.position).toBe('bottom');
  expect(layout.legend.entryPositions).toHaveLength(1);
});

it('shares the complete legend frame when no endpoint columns are enabled', () => {
  const source = input({ position: 'top' });
  source.layer = [area(['A', 'B']), area(['C', 'D'])].map((leaf) => ({
    ...leaf,
    endpointLabels: false,
  }));
  const layout = compileLayer(source, { width: 390, height: 500 });
  if (!('entries' in layout.legend)) throw new Error('Expected categorical legend');
  expect(layout.legend.entries).toHaveLength(4);
  expect(layout.legend.entryPositions).toHaveLength(4);
  for (const mark of layout.marks) {
    if (mark.type !== 'area') continue;
    for (const point of [...mark.topPoints, ...mark.bottomPoints]) {
      expect(point.y).toBeGreaterThanOrEqual(layout.area.y - 1e-6);
      expect(point.y).toBeLessThanOrEqual(layout.area.y + layout.area.height + 1e-6);
    }
  }
});

it.each([390, 1280])('reserves wrapped bottom rows before source chrome at %spx', (width) => {
  const layout = compileLayer(input({ position: 'bottom', maxRows: 4 }, true), {
    width,
    height: 600,
  });
  const legend = layout.legend;
  if (!('entries' in legend)) throw new Error('Expected categorical legend');
  expect(legend.entryPositions).toHaveLength(4);
  expect(legend.bounds.y).toBeGreaterThanOrEqual(layout.area.y + layout.area.height);
  expect(legend.bounds.y + legend.bounds.height).toBeLessThanOrEqual(
    (layout.chrome.bottomAnchorY ?? layout.area.y + layout.area.height) +
      layout.chrome.source!.y +
      (layout.chrome.noteBandHeight ?? 0),
  );
});
