import { formatNumber, type GeoMapSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileGeoMapPlayback } from '../map-playback';

const TOPOLOGY = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [{ type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[0]] }],
    },
  },
  arcs: [
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
  ],
};

const OPTIONS = { width: 600, height: 400 };

const CITIES = [
  { city: 'Austin', lon: -97, lat: 30, month: '2020-01-01', pop: 840000000, party: 'D' },
  { city: 'Austin', lon: -97, lat: 30, month: '2020-02-01', pop: 850000000, party: 'R' },
  { city: 'Dallas', lon: -96, lat: 32, month: '2020-02-01', pop: 1300000, party: 'R' },
];

const BASE_POINTS = {
  data: CITIES,
  longitude: { field: 'lon', type: 'quantitative' },
  latitude: { field: 'lat', type: 'quantitative' },
  key: { field: 'city', type: 'nominal', title: 'City' },
  time: { field: 'month', type: 'temporal' },
};

/** A choropleth formatted as a percentage, under a points layer. */
function spec(points: Record<string, unknown>): GeoMapSpec {
  return {
    type: 'map',
    geo: { features: TOPOLOGY, idField: 'name', projection: 'mercator' },
    data: [
      { state: 'Texas', month: '2020-01-01', share: 0.1 },
      { state: 'Texas', month: '2020-02-01', share: 0.2 },
    ],
    encoding: {
      key: { field: 'state', type: 'nominal' },
      color: { field: 'share', type: 'quantitative', format: '.1%' },
      time: { field: 'month', type: 'temporal' },
    },
    points: { ...BASE_POINTS, ...points },
  } as GeoMapSpec;
}

function fields(map: GeoMapSpec, key: string, t: number) {
  const tooltip = compileGeoMapPlayback(map, OPTIONS).tooltipAt(`point:${key}`, t);
  return tooltip?.fields.map(({ label, value, role }) => ({ label, value, role }));
}

describe('map point tooltips at the playhead', () => {
  it('formats point values with their own format, not the choropleth color format', () => {
    const sized = spec({ size: { field: 'pop', type: 'quantitative', title: 'Population' } });
    expect(fields(sized, 'Austin', 0)).toContainEqual({
      label: 'Population',
      value: formatNumber(840000000),
      role: 'value',
    });
    const formatted = spec({
      size: { field: 'pop', type: 'quantitative', title: 'Population', format: '.2s' },
    });
    expect(fields(formatted, 'Austin', 1)).toContainEqual({
      label: 'Population',
      value: '850M',
      role: 'value',
    });
  });

  it('keeps the key and a categorical color from the nearest period', () => {
    const colored = spec({
      size: { field: 'pop', type: 'quantitative', title: 'Population', format: '.2s' },
      color: { field: 'party', type: 'nominal', title: 'Party' },
    });
    expect(fields(colored, 'Austin', 0)).toEqual([
      { label: 'City', value: 'Austin', role: 'series' },
      { label: 'Party', value: 'D', role: 'value' },
      { label: 'Population', value: '840M', role: 'value' },
    ]);
    expect(fields(colored, 'Austin', 1)?.[1].value).toBe('R');
  });

  it('gives a key-only layer its key field', () => {
    expect(fields(spec({}), 'Dallas', 1)).toEqual([
      { label: 'City', value: 'Dallas', role: 'series' },
    ]);
  });

  it('honours points.tooltip, with playhead values for the playing channels', () => {
    const tooltip = spec({
      size: { field: 'pop', type: 'quantitative' },
      tooltip: [
        { field: 'party', type: 'nominal', title: 'Party' },
        { field: 'pop', type: 'quantitative', title: 'People', format: '.2s' },
      ],
    });
    expect(fields(tooltip, 'Austin', 0)).toEqual([
      { label: 'Party', value: 'D', role: 'value' },
      { label: 'People', value: '840M', role: 'value' },
    ]);
    expect(fields(tooltip, 'Dallas', 0)).toEqual([
      { label: 'Party', value: 'R', role: 'value' },
      { label: 'People', value: 'No data', role: 'value' },
    ]);
  });
});
