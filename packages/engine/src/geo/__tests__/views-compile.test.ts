import { expect, it } from 'vitest';
import { compileGeoMap } from '../compile-geo-map';

const topology = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: ['a', 'b', 'c'].map((id, index) => ({ type: 'Polygon', id, arcs: [[index]] })),
    },
  },
  arcs: [0, 20, 100].map((x) => [
    [x, 0],
    [x + 10, 0],
    [x + 10, 10],
    [x, 10],
    [x, 0],
  ]),
};
const base = {
  type: 'map',
  geo: { features: topology, projection: 'identity' },
  data: [
    { id: 'a', v: 0 },
    { id: 'b', v: 5 },
    { id: 'c', v: 10 },
  ],
  encoding: { key: { field: 'id', type: 'nominal' }, color: { field: 'v', type: 'quantitative' } },
  legend: { show: false },
};
it('keeps omitted view options byte equivalent and projects detail through the unchanged parent fit', () => {
  const original = compileGeoMap(base, { width: 800, height: 600 });
  const layout = compileGeoMap(
    {
      ...base,
      geo: {
        ...base.geo,
        sourcePlane: 'test',
        detailLayers: [{ id: 'detail', features: topology, sourcePlane: 'test', minZoom: 2 }],
      },
    },
    { width: 800, height: 600 },
  );
  expect(layout.features.map((m) => m.path)).toEqual(original.features.map((m) => m.path));
  expect(layout.views).toHaveLength(1);
  expect(layout.views![0].detailLayers[0].paths).toEqual(original.features.map((m) => m.path));
  expect(layout.views![0].detailLayers[0].minZoom).toBe(2);
});
it('reserves all inset frames before root fit, preserves shared fills and explicit duplicated coverage', () => {
  const layout = compileGeoMap(
    {
      ...base,
      geo: {
        ...base.geo,
        insets: [
          {
            id: 'remote',
            label: 'Remote region',
            featureIds: ['c'],
            placement: 'bottom-right',
            width: 180,
          },
        ],
      },
    },
    { width: 800, height: 600 },
  );
  expect(layout.views?.map((v) => v.viewId)).toEqual(['root', 'remote']);
  const [root, inset] = layout.views!;
  expect(root.features.map((m) => m.id)).toEqual(['a', 'b']);
  expect(inset.features.map((m) => m.id)).toEqual(['c']);
  expect(root.viewport.y + root.viewport.height).toBeLessThan(inset.frame.y);
  expect(inset.label?.lines.map((l) => l.text).join(' ')).toContain('Separate scale');
  expect(inset.features[0].fill).toBe(
    compileGeoMap(base, { width: 800, height: 600 }).features[2].fill,
  );
  expect(layout.area.x).toBe(20);
  expect(inset.viewport.x).toBeGreaterThan(0);
  const duplicate = compileGeoMap(
    {
      ...base,
      geo: {
        ...base.geo,
        insets: [
          {
            id: 'remote',
            label: 'Remote',
            featureIds: ['c'],
            placement: 'bottom-right',
            width: 180,
            removeFromMain: false,
          },
        ],
      },
    },
    { width: 800, height: 600 },
  );
  expect(duplicate.views![0].features.map((m) => m.id)).toContain('c');
});
it('fails infeasible view reservations before geography is silently removed', () => {
  expect(() =>
    compileGeoMap(
      {
        ...base,
        geo: {
          ...base.geo,
          insets: [
            {
              id: 'remote',
              label: 'Remote',
              featureIds: ['c'],
              placement: 'bottom-right',
              width: 800,
            },
          ],
        },
      },
      { width: 390, height: 200 },
    ),
  ).toThrow();
});

it('fits the authored primary object while retaining separate render-object coverage', () => {
  const both = {
    ...topology,
    objects: {
      ...topology.objects,
      fit: { type: 'GeometryCollection', geometries: [topology.objects.regions.geometries[0]] },
    },
  };
  const fit = compileGeoMap(
    { ...base, geo: { ...base.geo, features: both, objectKey: 'regions', fitObjectKey: 'fit' } },
    { width: 800, height: 600 },
  );
  const expected = compileGeoMap(
    { ...base, geo: { ...base.geo, features: both, objectKey: 'fit' } },
    { width: 800, height: 600 },
  );
  expect(fit.features).toHaveLength(3);
  expect(fit.features[0].path).toBe(expected.features[0].path);
  expect(fit.views![0].projectionContext.fitObjectKey).toBe('fit');
});
it('reuses point sizes/colors in explicit inset membership without changing observation keys', () => {
  const points = {
    data: [
      { id: 'p', x: 105, y: 5, v: 10 },
      { id: 'q', x: 5, y: 5, v: 1 },
    ],
    key: { field: 'id' },
    longitude: { field: 'x' },
    latitude: { field: 'y' },
    size: { field: 'v', type: 'quantitative' },
    color: { field: 'v', type: 'quantitative' },
  };
  const original = compileGeoMap({ ...base, points }, { width: 800, height: 600 });
  const layout = compileGeoMap(
    {
      ...base,
      points,
      geo: {
        ...base.geo,
        insets: [
          {
            id: 'remote',
            label: 'Remote',
            featureIds: ['c'],
            pointIds: ['p'],
            placement: 'bottom-right',
            width: 180,
          },
        ],
      },
    },
    { width: 800, height: 600 },
  );
  expect(layout.views![0].pointMarks.map((p) => p.key)).toEqual(['q']);
  expect(layout.views![1].pointMarks.map((p) => p.key)).toEqual(['p']);
  const old = original.pointMarks.find((p) => p.key === 'p')!,
    next = layout.views![1].pointMarks[0];
  expect({ r: next.r, fill: next.fill, key: next.key }).toEqual({
    r: old.r,
    fill: old.fill,
    key: old.key,
  });
  expect(layout.mapSize).toEqual(layout.views![0].mapSize);
});
it('keeps scoped detail and inset callouts in their own view, retaining the fixed global notes', () => {
  const layout = compileGeoMap(
    {
      ...base,
      geo: {
        ...base.geo,
        sourcePlane: 'test',
        detailLayers: [{ id: 'tracts', features: topology, sourcePlane: 'test', minZoom: 2 }],
        insets: [
          {
            id: 'remote',
            label: 'Remote',
            featureIds: ['c'],
            placement: 'bottom-right',
            width: 180,
          },
        ],
      },
      callouts: [
        {
          id: 'remote-note',
          anchor: { kind: 'feature', id: 'c', viewId: 'remote' },
          text: 'Remote note',
        },
        {
          id: 'detail-note',
          anchor: { kind: 'feature', id: 'a', layerId: 'tracts' },
          text: 'Detailed note',
        },
        {
          id: 'missing-view',
          anchor: { kind: 'feature', id: 'missing', viewId: 'root' },
          text: 'Still retained',
        },
      ],
    },
    { width: 800, height: 800 },
  );
  const [root, inset] = layout.views!;
  expect(root.labels!.candidates.map((c) => c.id)).not.toContain('callout:remote-note');
  expect(inset.labels!.candidates.map((c) => c.id)).toContain('callout:remote-note');
  expect(root.labels!.candidates.find((c) => c.id === 'callout:detail-note')?.minZoom).toBe(2);
  expect(root.labels!.geometries.some((geometry) => geometry.featureId === 'tracts:a')).toBe(true);
  expect(
    root.labels!.initialOverlay.inventory.find((c) => c.id === 'callout:missing-view')?.visibility,
  ).toBe('unresolved');
  expect(root.labels!.noteSlots).toHaveLength(3);
  expect(inset.labels!.noteSlots).toHaveLength(3);
  const globalRoot = root.labels!.noteSlots[0].bounds.y + root.viewport.y,
    globalInset = inset.labels!.noteSlots[0].bounds.y + inset.viewport.y;
  expect(globalRoot).toBe(globalInset);
});
it('surfaces invalid source-plane geometry as an explicit diagnostic and compile failure', () => {
  const diagnostics: Array<{ code: string }> = [];
  expect(() =>
    compileGeoMap(
      {
        ...base,
        geo: { ...base.geo, detailLayers: [{ id: 'detail', features: topology, minZoom: 2 }] },
      },
      { width: 800, height: 600, onDiagnostic: (d) => diagnostics.push(d) },
    ),
  ).toThrow('sourcePlane');
  expect(diagnostics.some((d) => d.code === 'GEO_SOURCE_PLANE')).toBe(true);
});

it('rejects malformed authored view contracts while empty opt-outs preserve the legacy frame', () => {
  const baseline = compileGeoMap(base, { width: 800, height: 600 });
  expect(
    JSON.stringify(
      compileGeoMap(
        { ...base, geo: { ...base.geo, insets: [], detailLayers: [] } },
        { width: 800, height: 600 },
      ),
    ),
  ).toBe(JSON.stringify(baseline));
  for (const geo of [
    { ...base.geo, objectKey: '' },
    { ...base.geo, detailLayers: [{ id: 'root', features: topology, minZoom: 2 }] },
    {
      ...base.geo,
      detailLayers: [{ id: 'same', features: topology, minZoom: 2 }],
      insets: [
        { id: 'same', label: 'Remote', featureIds: ['c'], placement: 'bottom-right', width: 180 },
      ],
    },
    {
      ...base.geo,
      insets: [
        {
          id: 'remote',
          label: 'Remote',
          featureIds: ['c', 'c'],
          placement: 'bottom-right',
          width: 180,
        },
      ],
    },
    {
      ...base.geo,
      insets: [
        { id: 'remote', label: 'Remote', featureIds: ['c'], placement: 'bottom-right', width: NaN },
      ],
    },
  ])
    expect(() => compileGeoMap({ ...base, geo }, { width: 800, height: 600 })).toThrow();
});

it('rejects invalid explicit coordinate scope before mutation while known-layer missing features retain notes', () => {
  for (const anchor of [
    { kind: 'coordinate', space: 'source', x: 5, y: 5, layerId: 'missing' },
    { kind: 'coordinate', space: 'source', x: 5, y: 5, viewId: 'missing' },
  ])
    expect(() =>
      compileGeoMap(
        { ...base, callouts: [{ id: 'bad-scope', text: 'Explicit scope', anchor }] },
        { width: 800, height: 600 },
      ),
    ).toThrow(/Unknown (layerId|viewId)/);
  const layout = compileGeoMap(
    {
      ...base,
      geo: {
        ...base.geo,
        sourcePlane: 'test',
        detailLayers: [{ id: 'detail', features: topology, minZoom: 1, sourcePlane: 'test' }],
      },
      callouts: [
        {
          id: 'missing-feature',
          text: 'Retained exact authored text',
          anchor: { kind: 'feature', id: 'missing', layerId: 'detail' },
        },
      ],
    },
    { width: 800, height: 600 },
  );
  expect(layout.labels!.initialOverlay.inventory[0].visibility).toBe('unresolved');
  expect(layout.labels!.initialOverlay.inventory[0].anchor.layerId).toBe('detail');
  expect(layout.labels!.initialOverlay.notes[0].slot.block.lines[0].text).toContain(
    'Retained exact authored text',
  );
});
it('reserves each inset control rectangle in its own label coordinate space', () => {
  const points = {
    data: [{ id: 'p', x: 108, y: 2, name: 'Remote point' }],
    key: { field: 'id' },
    longitude: { field: 'x' },
    latitude: { field: 'y' },
    text: { field: 'name' },
  };
  const spec = {
    ...base,
    points,
    geo: {
      ...base.geo,
      zoom: { controls: true },
      insets: [
        {
          id: 'remote',
          label: 'Remote',
          featureIds: ['c'],
          pointIds: ['p'],
          placement: 'bottom-right',
          width: 180,
        },
      ],
    },
  };
  const layout = compileGeoMap(spec, { width: 800, height: 600 }),
    inset = layout.views![1];
  const controls = { x: inset.viewport.width - 38, y: 8, width: 30, height: 86 };
  expect(inset.labels!.obstacles).toContainEqual(controls);
  for (const label of inset.labels!.initialOverlay.labels) {
    const b = label.bounds;
    expect(
      b.x < controls.x + controls.width &&
        b.x + b.width > controls.x &&
        b.y < controls.y + controls.height &&
        b.y + b.height > controls.y,
    ).toBe(false);
  }
  const disabled = compileGeoMap(
    { ...spec, geo: { ...spec.geo, zoom: { controls: false } } },
    { width: 800, height: 600 },
  );
  expect(disabled.views![1].labels!.obstacles).not.toContainEqual(controls);
});

it('uses canonical topology feature IDs for insets while geo.idField remains only the data join field', () => {
  const named = {
    ...topology,
    objects: {
      regions: {
        ...topology.objects.regions,
        geometries: topology.objects.regions.geometries.map((geometry, index) => ({
          ...geometry,
          properties: { name: ['Alpha', 'Beta', 'Gamma'][index] },
        })),
      },
    },
  };
  const spec = {
    ...base,
    geo: {
      ...base.geo,
      features: named,
      idField: 'name',
      insets: [
        { id: 'alpha', label: 'Alpha', featureIds: ['a'], placement: 'bottom-left', width: 140 },
      ],
    },
    data: [
      { id: 'Alpha', v: 0 },
      { id: 'Beta', v: 5 },
      { id: 'Gamma', v: 10 },
    ],
  };
  const layout = compileGeoMap(spec, { width: 800, height: 600 });
  expect(layout.views![0].features.map((mark) => mark.id)).toEqual(['b', 'c']);
  expect(layout.views![1].features.map((mark) => mark.id)).toEqual(['a']);
  expect(layout.views![1].features[0].data).toBe(spec.data[0]);
  expect(() =>
    compileGeoMap(
      { ...spec, geo: { ...spec.geo, insets: [{ ...spec.geo.insets[0], featureIds: ['Alpha'] }] } },
      { width: 800, height: 600 },
    ),
  ).toThrow(/missing/i);
});
