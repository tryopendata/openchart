import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../../compiler/types';
import { validateGeoMapSpec } from '../../compiler/validation/geo-map';

const topology = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: [{ type: 'Polygon', id: 'a', properties: {}, arcs: [[0]] }],
    },
  },
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};
const base = {
  type: 'map',
  geo: { features: topology, projection: 'identity' },
  data: [{ id: 'a', v: 1 }],
  encoding: { key: { field: 'id' }, color: { field: 'v', type: 'quantitative' } },
};
const errorsFor = (patch: Record<string, unknown>) => {
  const errors: ValidationError[] = [];
  validateGeoMapSpec({ ...base, ...patch }, errors);
  return errors;
};

describe('map geographic label validation', () => {
  it.each([
    { id: 'x', anchor: { kind: 'coordinate', space: 'source', x: Infinity, y: 2 }, text: 'Note' },
    { id: 'x', anchor: { kind: 'feature', id: 'a' }, text: 'Note', maxWidth: 0 },
    { id: 'x', anchor: { kind: 'feature', id: 'a' }, text: 'Note', priority: NaN },
    { id: 'x', anchor: { kind: 'feature', id: 'a' }, text: 'Note', minZoom: 3, maxZoom: 2 },
  ])('rejects invalid authored callout fields (%j)', (callout) => {
    expect(errorsFor({ callouts: [callout] }).length).toBeGreaterThan(0);
  });
  it('rejects duplicate callout IDs and ambiguous point identities', () => {
    const callout = { id: 'x', anchor: { kind: 'point', id: 1 }, text: 'Note' };
    const errors = errorsFor({
      callouts: [callout, callout],
      points: {
        data: [{ id: 1 }, { id: '1' }],
        key: { field: 'id' },
        longitude: { field: 'x' },
        latitude: { field: 'y' },
      },
    });
    expect(errors.some((error) => error.path === '/callouts/1/id')).toBe(true);
    expect(errors.some((error) => error.message.includes('ambiguous'))).toBe(true);
  });
  it('requires points.key only when labels or point anchors need persistence', () => {
    const points = { data: [{ x: 1, y: 1 }], longitude: { field: 'x' }, latitude: { field: 'y' } };
    expect(errorsFor({ points })).toHaveLength(0);
    expect(
      errorsFor({ points: { ...points, text: { field: 'name' } } }).some(
        (error) => error.path === '/points/key',
      ),
    ).toBe(true);
  });
  it('rejects geographic coordinates on a preprojected identity map', () => {
    expect(
      errorsFor({
        callouts: [
          {
            id: 'x',
            anchor: { kind: 'coordinate', space: 'geographic', x: -97, y: 30 },
            text: 'Note',
          },
        ],
      }).some((error) => error.path === '/callouts/0/anchor/space'),
    ).toBe(true);
  });
  it('rejects priority without text and retains opt-out validation behavior', () => {
    expect(
      errorsFor({
        encoding: { ...base.encoding, textPriority: { field: 'v', type: 'quantitative' } },
      }).length,
    ).toBeGreaterThan(0);
    expect(errorsFor({})).toHaveLength(0);
  });
});

it('rejects ambiguous feature IDs only on the enabled label path and preserves feature/point namespaces', () => {
  const duplicate = {
    ...topology,
    objects: {
      regions: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: 1, arcs: [[0]] },
          { type: 'Polygon', id: '1', arcs: [[0]] },
        ],
      },
    },
  };
  expect(errorsFor({ geo: { features: duplicate, projection: 'identity' } })).toHaveLength(0);
  expect(
    errorsFor({
      geo: { features: duplicate, projection: 'identity' },
      encoding: { ...base.encoding, text: { field: 'custom' } },
    }).some((error) => error.message.includes('ambiguous')),
  ).toBe(true);
  expect(
    errorsFor({
      points: {
        data: [{ id: 'a', x: 1, y: 1, text: 'Point A' }],
        key: { field: 'id' },
        longitude: { field: 'x' },
        latitude: { field: 'y' },
        text: { field: 'text' },
      },
      callouts: [{ id: 'a', anchor: { kind: 'feature', id: 'a' }, text: 'Feature A' }],
    }),
  ).toHaveLength(0);
});
it('rejects missing point IDs and validates inferred preprojected coordinates', () => {
  expect(
    errorsFor({
      points: {
        data: [{ x: 1, y: 1 }],
        key: { field: 'id' },
        text: { field: 'name' },
        longitude: { field: 'x' },
        latitude: { field: 'y' },
      },
    }).some((error) => error.path === '/points/data/0'),
  ).toBe(true);
  expect(
    errorsFor({
      geo: { features: { ...topology, bbox: [0, 0, 960, 600] } },
      callouts: [
        {
          id: 'x',
          anchor: { kind: 'coordinate', space: 'geographic', x: 1, y: 1 },
          text: 'No geographic transform',
        },
      ],
    }).some((error) => error.path === '/callouts/0/anchor/space'),
  ).toBe(true);
});
