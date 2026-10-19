import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileGeoMap } from '../compile-geo-map';
import { buildGeoReaderIndex } from '../reader-index';

const topo = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: 'a', properties: { name: 'Region A' }, arcs: [[0]] },
        { type: 'Polygon', id: 'b', properties: { name: 'Region B' }, arcs: [[0]] },
      ],
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
  type: 'map' as const,
  geo: { features: topo, projection: 'identity' as const },
  data: [{ id: 'a', rate: 0 }],
  encoding: {
    key: { field: 'id', type: 'nominal' as const },
    color: { field: 'rate', type: 'quantitative' as const, format: '.1f' },
  },
  fields: {
    rate: { label: 'Rate', unit: '%', measure: 'rate', representation: 'percent' as const },
  },
};
describe('map reader index', () => {
  it('binds destination joined rows and keeps unjoined places searchable', () => {
    const index = buildGeoReaderIndex(base, compileGeoMap(base, { width: 600, height: 400 }));
    expect(index.records.map((record) => record.name)).toEqual(['Region A', 'Region B']);
    expect(index.records[0].primary?.value).toBe(0);
    expect(index.records[0].valueLabel).toBe('0.0');
    expect(index.records[1].valueLabel).toBe('No data');
    expect(index.records[1].observation.datum).toBeNull();
  });
  it('distinguishes feature/point IDs and ephemeral/ambiguous point identity', () => {
    const spec = {
      ...base,
      points: {
        data: [{ x: 5, y: 5, value: 10 }],
        longitude: { field: 'x' },
        latitude: { field: 'y' },
        size: { field: 'value', type: 'quantitative' },
      },
    };
    const index = buildGeoReaderIndex(spec, compileGeoMap(spec, { width: 600, height: 400 }));
    expect(index.records.at(-1)?.identityStatus).toBe('ephemeral');
    expect(index.records.at(-1)?.observation.persistent).toBe(false);
    const duplicate = {
      ...spec,
      points: {
        ...spec.points,
        key: { field: 'id' },
        data: [
          { id: 1, x: 3, y: 5, value: 10 },
          { id: '1', x: 8, y: 5, value: 20 },
        ],
      },
    };
    const ambiguous = buildGeoReaderIndex(
      duplicate,
      compileGeoMap(duplicate, { width: 600, height: 400 }),
    );
    expect(
      ambiguous.records.filter((record) => record.identityStatus === 'ambiguous'),
    ).toHaveLength(2);
    expect(new Set(ambiguous.records.map((record) => record.observation.observation)).size).toBe(4);
  });
});

it('counts duplicated view representations once while preserving one persistent identity', () => {
  const layout = compileGeoMap(base, { width: 600, height: 400 });
  const view = (viewId: string) => ({
    viewId,
    frame: layout.area,
    viewport: layout.area,
    mapSize: layout.mapSize,
    features: layout.features,
    borders: layout.borders,
    pointMarks: layout.pointMarks,
    focus: null,
    detailLayers: [],
    projectionContext: { projection: 'identity' as const, space: 'source' as const },
  });
  const index = buildGeoReaderIndex(base, { ...layout, views: [view('root'), view('island')] });
  expect(index.records).toHaveLength(layout.features.length);
  expect(index.records[0].observation.persistent).toBe(true);
  expect(index.records[0].viewIds).toEqual(['root', 'island']);
  expect(index.diagnostics).toHaveLength(0);
});

it('retains all source places outside an Albers USA projection without inventing visible geometry', () => {
  const states = JSON.parse(
    readFileSync(
      new URL('../../../../../node_modules/us-atlas/states-10m.json', import.meta.url),
      'utf8',
    ),
  );
  const spec = {
    ...base,
    geo: { features: states, projection: 'albersUsa' as const },
    data: [{ id: '72', rate: 0 }],
  };
  const layout = compileGeoMap(spec, { width: 600, height: 400 });
  expect(layout.features).toHaveLength(51);
  const index = buildGeoReaderIndex(spec, layout);
  expect(index.records).toHaveLength(56);
  const puertoRico = index.byObservation.get('feature:72')!;
  expect(puertoRico.name).toBe('Puerto Rico');
  expect(puertoRico.primary?.value).toBe(0);
  expect(puertoRico.primary?.metadata).toEqual(base.fields.rate);
  expect(puertoRico.observation.datum).toBe(spec.data[0]);
  expect(puertoRico.observation.persistent).toBe(true);
  expect(puertoRico.viewIds).toEqual([]);
  const guam = index.byObservation.get('feature:66')!;
  expect(guam.name).toBe('Guam');
  expect(guam.valueLabel).toBe('No data');
  expect(guam.observation.datum).toBeNull();
  expect(guam.viewIds).toEqual([]);
  expect(layout.features.some((feature) => String(feature.id) === '72')).toBe(false);
});
it('preserves duplicate point observations when view representation copies are deduplicated', () => {
  const spec = {
    ...base,
    points: {
      key: { field: 'id' },
      longitude: { field: 'x' },
      latitude: { field: 'y' },
      size: { field: 'v', type: 'quantitative' },
      data: [
        { id: 1, x: 3, y: 5, v: 10 },
        { id: '1', x: 8, y: 5, v: 20 },
      ],
    },
  };
  const legacy = buildGeoReaderIndex(spec, compileGeoMap(spec, { width: 600, height: 400 }));
  const scoped = { ...spec, geo: { ...spec.geo, objectKey: 'regions' } };
  const layout = compileGeoMap(scoped, { width: 600, height: 400 });
  expect(layout.views![0].pointMarks).toHaveLength(2);
  const index = buildGeoReaderIndex(scoped, layout);
  expect(
    index.records
      .filter((record) => record.observation.entity.kind === 'point')
      .map((record) => ({
        value: record.primary?.value,
        status: record.identityStatus,
        id: record.observation.observation,
      })),
  ).toEqual(
    legacy.records
      .filter((record) => record.observation.entity.kind === 'point')
      .map((record) => ({
        value: record.primary?.value,
        status: record.identityStatus,
        id: record.observation.observation,
      })),
  );
});
it('preserves same-ID feature observations within a view instead of collapsing them to one representative', () => {
  const duplicate = {
    ...topo,
    objects: {
      regions: {
        ...topo.objects.regions,
        geometries: topo.objects.regions.geometries.map((geometry) => ({ ...geometry, id: 'a' })),
      },
    },
  };
  const spec = { ...base, geo: { ...base.geo, features: duplicate, objectKey: 'regions' } };
  const layout = compileGeoMap(spec, { width: 600, height: 400 });
  expect(layout.views![0].features).toHaveLength(2);
  const index = buildGeoReaderIndex(spec, layout);
  expect(index.records).toHaveLength(2);
  expect(index.records.every((record) => record.identityStatus === 'ambiguous')).toBe(true);
  expect(new Set(index.records.map((record) => record.observation.observation)).size).toBe(2);
});
