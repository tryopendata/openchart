import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createProjection } from '../projections';
import {
  decodeGeoViewSource,
  planGeoInsetViewports,
  projectGeoDetailLayers,
  resolveGeoInsetProjection,
  resolveGeoViewSources,
  selectGeoInsetFeatures,
  selectGeoInsetPoints,
} from '../view-geometry';

const polygon = (id: string, x = 0) => ({
  type: 'Feature' as const,
  id,
  properties: {},
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [x, 0],
        [x + 10, 0],
        [x + 10, 10],
        [x, 10],
        [x, 0],
      ],
    ],
  },
});
const collection = {
  type: 'FeatureCollection' as const,
  features: [polygon('a'), polygon('b', 20)],
};
const inset = (id: string, width = 100) => ({
  id,
  label: id,
  featureIds: ['a'],
  placement: 'bottom-left' as const,
  width,
});
it('selects explicit primary and fit topology objects and keeps first-object default', () => {
  const topology = {
    type: 'Topology',
    objects: {
      first: { type: 'GeometryCollection', geometries: [] },
      second: { type: 'GeometryCollection', geometries: [] },
    },
    arcs: [],
  };
  expect(decodeGeoViewSource(topology).objectKey).toBe('first');
  const result = resolveGeoViewSources({
    features: topology,
    objectKey: 'second',
    fitObjectKey: 'first',
    projection: 'identity',
  });
  expect(result.primary.objectKey).toBe('second');
  expect(result.fit.objectKey).toBe('first');
  expect(() => decodeGeoViewSource(topology, 'absent')).toThrow(/object/i);
  expect(decodeGeoViewSource(collection).collection.features).toEqual(collection.features);
});
it('keeps real Texas/Austin/RGV points fixed while projecting Travis detail with the injected fit', () => {
  const topology = JSON.parse(
    readFileSync(
      new URL('../../../../../node_modules/us-atlas/counties-10m.json', import.meta.url),
      'utf8',
    ),
  );
  const decoded = decodeGeoViewSource(topology, 'counties');
  const texas = {
    ...decoded.collection,
    features: decoded.collection.features.filter((f) => String(f.id).startsWith('48')),
  };
  const projection = createProjection('albersUsa', 650, 440, texas, 16);
  const cities = [
    [-97.7431, 30.2672],
    [-98.23, 26.2034],
    [-97.4975, 25.9017],
  ] as [number, number][];
  const before = cities.map((p) => projection(p));
  const detail = JSON.parse(
    readFileSync(new URL('./fixtures/travis-tracts-2020.geojson', import.meta.url), 'utf8'),
  );
  const paths = projectGeoDetailLayers(
    [{ id: 'tracts', features: detail, minZoom: 4 }],
    projection,
    { projection: 'albersUsa', space: 'geographic' },
  );
  expect(paths[0].paths.length).toBe(290);
  expect(cities.map((p) => projection(p))).toEqual(before);
  expect(paths[0]).toMatchObject({ id: 'tracts', minZoom: 4 });
});
it('requires explicit matching source-plane assertions for identity detail and rejects mixed coordinates', () => {
  const projection = createProjection('identity', 300, 200, collection);
  const layer = { id: 'detail', features: collection, minZoom: 2, sourcePlane: 'atlas-decoded-v1' };
  expect(() =>
    projectGeoDetailLayers([layer], projection, { projection: 'identity', space: 'source' }),
  ).toThrow(/sourcePlane/);
  expect(() =>
    projectGeoDetailLayers([layer], projection, {
      projection: 'identity',
      space: 'source',
      sourcePlane: 'different',
    }),
  ).toThrow(/sourcePlane/);
  const before = projection([5, 5]);
  expect(
    projectGeoDetailLayers([layer], projection, {
      projection: 'identity',
      space: 'source',
      sourcePlane: layer.sourcePlane,
    })[0].paths,
  ).toHaveLength(2);
  expect(projection([5, 5])).toEqual(before);
  expect(() =>
    projectGeoDetailLayers([layer], projection, { projection: 'albersUsa', space: 'geographic' }),
  ).toThrow(/source/i);
});
it('selects inset features explicitly, defaults removal on, allows explicit duplication and never mutates source', () => {
  const result = selectGeoInsetFeatures(collection.features, [inset('one')]);
  expect(result.root.map((f) => f.id)).toEqual(['b']);
  expect(result.views.get('one')![0].id).toBe('a');
  expect(collection.features).toHaveLength(2);
  expect(
    selectGeoInsetFeatures(collection.features, [{ ...inset('one'), removeFromMain: false }]).root,
  ).toHaveLength(2);
  expect(() =>
    selectGeoInsetFeatures(collection.features, [{ ...inset('one'), featureIds: ['missing'] }]),
  ).toThrow(/missing/);
  expect(() => selectGeoInsetFeatures(collection.features, [inset('root')])).toThrow(/root/);
});
it('includes only explicitly keyed inset points and rejects missing or ambiguous references', () => {
  const rows = [
    { id: 'one', x: 1 },
    { id: 'two', x: 2 },
  ];
  expect(selectGeoInsetPoints(rows, inset('one'), 'id')).toEqual([]);
  expect(selectGeoInsetPoints(rows, { ...inset('one'), pointIds: ['two'] }, 'id')).toEqual([
    rows[1],
  ]);
  expect(() => selectGeoInsetPoints(rows, { ...inset('one'), pointIds: ['two'] })).toThrow(/key/);
  expect(() =>
    selectGeoInsetPoints([...rows, rows[1]], { ...inset('one'), pointIds: ['two'] }, 'id'),
  ).toThrow(/ambiguous/);
});
it('stacks any number of inset rows without overlap and fails atomically on insufficient space', () => {
  const plan = planGeoInsetViewports(
    { x: 0, y: 0, width: 240, height: 500 },
    ['a', 'b', 'c'].map((id) => ({ inset: inset(id, 130), labelHeight: 22 })),
  );
  expect(plan.insets).toHaveLength(3);
  expect(plan.rootViewport.height).toBeGreaterThan(0);
  for (let i = 1; i < plan.insets.length; i++)
    expect(plan.insets[i].frame.y + plan.insets[i].frame.height).toBeLessThanOrEqual(
      plan.insets[i - 1].frame.y,
    );
  expect(() =>
    planGeoInsetViewports({ x: 0, y: 0, width: 100, height: 100 }, [
      { inset: inset('large', 130), labelHeight: 22 },
    ]),
  ).toThrow(/space/);
});

it('requires inset projection compatibility and preserves source-plane context', () => {
  const source = {
    projection: 'identity' as const,
    space: 'source' as const,
    sourcePlane: 'atlas',
  };
  expect(resolveGeoInsetProjection(inset('one'), source)).toEqual(source);
  expect(() =>
    resolveGeoInsetProjection({ ...inset('one'), projection: 'mercator' }, source),
  ).toThrow(/projection/);
  expect(() =>
    resolveGeoInsetProjection(
      { ...inset('one'), projection: 'identity' },
      { projection: 'albersUsa', space: 'geographic' },
    ),
  ).toThrow(/projection/);
  expect(
    resolveGeoInsetProjection(
      { ...inset('one'), projection: 'mercator' },
      { projection: 'albersUsa', space: 'geographic' },
    ).projection,
  ).toBe('mercator');
});
it('leaves a visible gap between consecutive same-side insets and reserves all measured captions', () => {
  const plan = planGeoInsetViewports(
    { x: 20, y: 30, width: 500, height: 400 },
    ['a', 'b', 'c'].map((id) => ({ inset: inset(id), labelHeight: 35 })),
  );
  expect(plan.insets).toHaveLength(3);
  expect(plan.insets[1].frame.x).toBeGreaterThan(
    plan.insets[0].frame.x + plan.insets[0].frame.width,
  );
  for (const view of plan.insets) {
    expect(view.labelBounds.height).toBe(35);
    expect(view.viewport.y).toBeGreaterThan(view.labelBounds.y + 35);
    expect(view.frame.y).toBeGreaterThanOrEqual(plan.rootViewport.y + plan.rootViewport.height);
  }
});
it('keeps canonical topology IDs independent of similarly named feature properties', () => {
  const custom = collection.features.map((feature, i) => ({
    ...feature,
    properties: { fips: i + 1 },
  }));
  const selected = selectGeoInsetFeatures(custom, [{ ...inset('one'), featureIds: ['a'] }]);
  expect(selected.views.get('one')![0]).toBe(custom[0]);
  expect(selected.root).toEqual([custom[1]]);
  expect(() => selectGeoInsetFeatures(custom, [{ ...inset('one'), featureIds: ['1'] }])).toThrow(
    /missing/,
  );
});
it('decodes different topology quantization transforms independently in one explicit source plane', () => {
  const topology = (scale: number, translate: number) => ({
    type: 'Topology',
    transform: { scale: [scale, scale], translate: [translate, translate] },
    objects: { shapes: { type: 'Polygon', arcs: [[0]] } },
    arcs: [
      [
        [0, 0],
        [10, 0],
        [0, 10],
        [-10, 0],
        [0, -10],
      ],
    ],
  });
  const primary = decodeGeoViewSource(topology(1, 0));
  const detail = decodeGeoViewSource(topology(0.5, 5));
  expect(primary.collection.features[0].geometry).not.toEqual(
    detail.collection.features[0].geometry,
  );
  const projection = createProjection('identity', 200, 200, primary.collection);
  const before = projection([10, 10]);
  expect(
    projectGeoDetailLayers(
      [{ id: 'detail', features: topology(0.5, 5), minZoom: 2, sourcePlane: 'shared' }],
      projection,
      { projection: 'identity', space: 'source', sourcePlane: 'shared' },
    )[0].paths,
  ).toHaveLength(1);
  expect(projection([10, 10])).toEqual(before);
});
