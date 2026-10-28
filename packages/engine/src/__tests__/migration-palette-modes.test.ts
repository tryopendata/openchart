import {
  CATEGORICAL_FILL_PALETTE,
  CATEGORICAL_FILL_PALETTE_DARK,
  CATEGORICAL_PALETTE,
  CATEGORICAL_PALETTE_DARK,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileGeoMap } from '../compile';
import { migrateSpecV8 } from '../migration/v8';

const oldStroke = ['#06b6d4', '#e29e47', '#4170cb', '#b2417f', '#3ca368', '#a584dc'];
const oldFill = ['#51bccc', '#dda96b', '#587fc8', '#bf6291', '#62ab7d', '#ae96da'];
const spec = {
  mark: 'point',
  data: [{ x: 0, y: 1 }],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};

describe('serialized migration palettes', () => {
  it('keeps released light and dark defaults through JSON serialization and repeated migration', () => {
    const migrated = JSON.parse(JSON.stringify(migrateSpecV8(spec).spec));
    for (const darkMode of [undefined, false, true]) {
      const layout = compileChart(migrated, { width: 400, height: 300, darkMode });
      expect(layout.theme.colors.categorical).toEqual(
        darkMode ? CATEGORICAL_PALETTE_DARK : oldStroke,
      );
      expect(layout.theme.colors.categoricalFill).toEqual(
        darkMode ? CATEGORICAL_FILL_PALETTE_DARK : oldFill,
      );
    }
    expect(migrateSpecV8(migrated)).toEqual({ spec: migrated, repairs: [] });
    const v9 = migrateSpecV8(spec, { styling: 'v9' }).spec;
    const light = compileChart(v9, { width: 400, height: 300 }).theme.colors;
    expect(light.categorical).toEqual(CATEGORICAL_PALETTE);
    expect(light.categoricalFill).toEqual(CATEGORICAL_FILL_PALETTE);
  });

  it('preserves authored palettes and their fill inheritance in both modes', () => {
    const source = { ...spec, theme: { colors: { categorical: ['#112233', '#aabbcc'] } } };
    const migrated = migrateSpecV8(source).spec;
    for (const darkMode of [false, true]) {
      const colors = compileChart(migrated, { width: 400, height: 300, darkMode }).theme.colors;
      expect(colors.categorical).toEqual(source.theme.colors.categorical);
      expect(colors.categoricalFill).toEqual(source.theme.colors.categorical);
    }
  });
});

const map = {
  type: 'map',
  data: [
    { id: 'a', group: 'First' },
    { id: 'b', group: 'Second' },
  ],
  geo: {
    features: {
      type: 'Topology',
      objects: {
        places: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', id: 'a', properties: {}, arcs: [[0]] },
            { type: 'Polygon', id: 'b', properties: {}, arcs: [[1]] },
          ],
        },
      },
      arcs: [
        [
          [0, 0],
          [0, 5],
          [5, 5],
          [5, 0],
          [0, 0],
        ],
        [
          [5, 0],
          [5, 5],
          [10, 5],
          [10, 0],
          [5, 0],
        ],
      ],
    },
    projection: 'identity',
  },
  encoding: { key: { field: 'id', type: 'nominal' }, color: { field: 'group', type: 'nominal' } },
  join: { on: 'id', featureKey: 'id' },
  points: {
    data: [
      { lon: 2, lat: 2, group: 'First' },
      { lon: 7, lat: 2, group: 'Second' },
    ],
    longitude: { field: 'lon', type: 'quantitative' },
    latitude: { field: 'lat', type: 'quantitative' },
  },
};

it.each([
  false,
  true,
])('preserves geographic hues across migration and mode dark=%s', (darkMode) => {
  const migrated = migrateSpecV8(map).spec;
  const layout = compileGeoMap(migrated, { width: 600, height: 400, darkMode });
  expect(layout.features.map((mark) => mark.fill)).toEqual(oldStroke.slice(0, 2));
  expect(layout.pointMarks?.map((mark) => mark.fill)).toEqual([oldStroke[0], oldStroke[0]]);
  const colored = compileGeoMap(
    migrateSpecV8({ ...map, points: { ...map.points, color: { field: 'group', type: 'nominal' } } })
      .spec,
    { width: 600, height: 400, darkMode },
  );
  expect(colored.pointMarks?.map((mark) => mark.fill)).toEqual(oldStroke.slice(0, 2));
});
