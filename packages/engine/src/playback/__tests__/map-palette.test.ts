import type { GeoMapSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import { describe, expect, it } from 'vitest';
import { compileGeoMap } from '../../compile';
import { compileGeoMapPlayback, compileTileMapPlayback } from '../map-playback';

const OPTIONS = { width: 600, height: 400 };

const TOPOLOGY = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
  ],
};

describe('map playback palette', () => {
  it('seeds a tile map with each shade composited over the surface, not the raw fill', () => {
    const playback = compileTileMapPlayback(
      {
        type: 'tilemap',
        data: [
          { code: 'CA', month: '2020-01-01', rate: 2 },
          { code: 'CA', month: '2020-02-01', rate: 10 },
          { code: 'TX', month: '2020-01-01', rate: 6 },
          { code: 'TX', month: '2020-02-01', rate: 4 },
        ],
        encoding: {
          state: { field: 'code', type: 'nominal' },
          value: { field: 'rate', type: 'quantitative' },
          time: { field: 'month', type: 'temporal' },
        },
      } as TileMapSpec,
      OPTIONS,
    );
    const surface = playback.base.theme.colors.neutral.surface;
    const expected = new Set<string>();
    for (const t of [0, 1]) {
      for (const { fill, fillOpacity = 1 } of playback.fillsAt(t)) {
        expected.add(fillOpacity >= 1 ? fill : interpolateRgb(surface, fill)(fillOpacity));
      }
    }
    expect(new Set(playback.paletteColors())).toEqual(expected);
    // Four shades of one hue, so the raw fill alone would seed one color.
    expect(expected.size).toBe(4);
  });

  it('seeds a geo map with each class color once, then the no-data fill', () => {
    const spec = {
      type: 'map',
      geo: { features: TOPOLOGY, idField: 'name', projection: 'mercator' },
      data: [
        { state: 'California', month: '2020-01-01', rate: 2 },
        { state: 'California', month: '2020-02-01', rate: 20 },
        { state: 'Texas', month: '2020-01-01', rate: 3 },
      ],
      encoding: {
        key: { field: 'state', type: 'nominal' },
        color: { field: 'rate', type: 'quantitative' },
        time: { field: 'month', type: 'temporal' },
      },
    } as GeoMapSpec;
    const playback = compileGeoMapPlayback(spec, OPTIONS);
    const legend = compileGeoMap(spec, OPTIONS).continuousLegend;
    const classes = [...new Set(legend?.bins.map(({ color }) => color))];
    expect(classes.length).toBeGreaterThan(1);
    const colors = playback.paletteColors();
    expect(colors.slice(0, classes.length)).toEqual(classes);
    expect(colors).toHaveLength(classes.length + 1);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
