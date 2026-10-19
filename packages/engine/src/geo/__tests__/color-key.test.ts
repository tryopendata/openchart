import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { geoColorKeyPosition } from '../color-key';
import { compileGeoMap } from '../compile-geo-map';

const topo = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: ['a', 'b', 'c'].map((id) => ({ type: 'Polygon', id, arcs: [[0]] })),
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
};
const base = {
  type: 'map',
  geo: { features: topo, projection: 'identity' },
  data: [
    { id: 'a', v: 0 },
    { id: 'b', v: 10 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'v', type: 'quantitative', scale: { type: 'threshold', domain: [2, 8] } },
  },
};
it('keeps false controls byte equivalent and counts existing finite joined feature classes including zero', () => {
  const baseline = compileGeoMap(base, { width: 600, height: 500 });
  expect(
    JSON.stringify(
      compileGeoMap(
        { ...base, colorKey: { activeValue: false, distribution: false } },
        { width: 600, height: 500 },
      ),
    ),
  ).toBe(JSON.stringify(baseline));
  const layout = compileGeoMap(
    { ...base, colorKey: { activeValue: true, distribution: true } },
    { width: 600, height: 500 },
  );
  const key = layout.colorKeys!.features!;
  expect(key.classes.map((bin) => bin.count)).toEqual([1, 0, 1]);
  expect(key.missing).toBe(1);
  expect(key.activeRows).toHaveLength(2);
  expect(layout.area.height).toBeLessThan(baseline.area.height);
  expect(
    layout.continuousLegend!.bounds.y + layout.continuousLegend!.bounds.height,
  ).toBeLessThanOrEqual(layout.area.y);
});
it('follows actual discrete range blocks, and raw linear position for gradient keys', () => {
  const layout = compileGeoMap(
    { ...base, colorKey: { activeValue: true } },
    { width: 600, height: 500 },
  );
  const key = layout.colorKeys!.features!;
  expect(geoColorKeyPosition(key, 7).x).toBe(key.classes[1].x + key.classes[1].width / 2);
  const gradient = {
    ...key,
    kind: 'gradient' as const,
    domain: [0, 100] as [number, number],
    bar: { x: 20, y: 40, width: 200, height: 10 },
  };
  expect(geoColorKeyPosition(gradient, 25).x).toBe(70);
  expect(geoColorKeyPosition({ ...gradient, clampDomain: [0, 100] }, 150)).toEqual({
    x: 220,
    outside: true,
    missing: false,
  });
  expect(geoColorKeyPosition(key, null).missing).toBe(true);
});

it('measures complete active values before fitting at 200% type and maps vertical classes to their own rows', () => {
  const layout = compileGeoMap(
    {
      ...base,
      legend: { position: 'right' },
      theme: { fonts: { sizes: { small: 24 } } },
      encoding: { ...base.encoding, color: { ...base.encoding.color, format: '.18f' } },
      colorKey: { activeValue: true, distribution: true },
    },
    {
      width: 1280,
      height: 800,
      measureText: (text, size) => ({ width: text.length * size * 0.6, height: size }),
    },
  );
  const key = layout.colorKeys!.features!;
  const labels = key.activeLabels!['number:10'];
  expect(labels.length).toBeGreaterThan(1);
  expect(key.activeRows[0].height).toBeGreaterThanOrEqual(labels.length * Math.ceil(24 * 1.4));
  expect(geoColorKeyPosition(key, 10).y).toBe(key.classes[2].y! + key.classes[2].height! / 2);
  expect(key.activeRows[1].y + key.activeRows[1].height).toBeLessThanOrEqual(
    key.distributionBounds!.y,
  );
  expect(labels.join('')).toContain('10.000000000000000000');
});
it('never counts duplicate canonical feature identities by first match', () => {
  const duplicate = {
    ...topo,
    objects: {
      regions: {
        ...topo.objects.regions,
        geometries: [...topo.objects.regions.geometries, { ...topo.objects.regions.geometries[0] }],
      },
    },
  };
  const diagnostics: Array<{ code: string }> = [];
  const layout = compileGeoMap(
    { ...base, geo: { ...base.geo, features: duplicate }, colorKey: { distribution: true } },
    { width: 600, height: 500, onDiagnostic: (d) => diagnostics.push(d) },
  );
  expect(layout.colorKeys!.features!.classes.map((bin) => bin.count)).toEqual([0, 0, 1]);
  expect(diagnostics.some((d) => d.code === 'GEO_COLOR_KEY_AMBIGUOUS_ID')).toBe(true);
});

it('counts only displayed root/inset features and counts a duplicated inset representation once', () => {
  const states = JSON.parse(
    readFileSync(
      new URL('../../../../../node_modules/us-atlas/states-10m.json', import.meta.url),
      'utf8',
    ),
  );
  const spec = {
    ...base,
    geo: { features: states, projection: 'albersUsa' },
    data: [
      { id: '06', v: 0 },
      { id: '72', v: 100 },
    ],
    colorKey: { distribution: true },
  };
  const layout = compileGeoMap(spec, { width: 800, height: 700 });
  expect(layout.features).toHaveLength(51);
  expect(layout.colorKeys!.features!.classes.map((bin) => bin.count)).toEqual([1, 0, 0]);
  expect(layout.colorKeys!.features!.missing).toBe(50);
  const duplicated = compileGeoMap(
    {
      ...spec,
      geo: {
        ...spec.geo,
        insets: [
          {
            id: 'california',
            label: 'California',
            featureIds: ['06'],
            placement: 'bottom-left',
            width: 160,
            removeFromMain: false,
            projection: 'mercator',
          },
        ],
      },
    },
    { width: 800, height: 700 },
  );
  expect(duplicated.views!.reduce((sum, view) => sum + view.features.length, 0)).toBe(52);
  expect(duplicated.colorKeys!.features!.classes.map((bin) => bin.count)).toEqual([1, 0, 0]);
  expect(duplicated.colorKeys!.features!.missing).toBe(50);
  const visibleTerritory = compileGeoMap(
    {
      ...spec,
      geo: {
        ...spec.geo,
        insets: [
          {
            id: 'puerto-rico',
            label: 'Puerto Rico',
            featureIds: ['72'],
            placement: 'bottom-right',
            width: 160,
            projection: 'mercator',
          },
        ],
      },
    },
    { width: 800, height: 700 },
  );
  expect(visibleTerritory.colorKeys!.features!.classes.map((bin) => bin.count)).toEqual([1, 0, 1]);
  expect(visibleTerritory.colorKeys!.features!.missing).toBe(50);
});
