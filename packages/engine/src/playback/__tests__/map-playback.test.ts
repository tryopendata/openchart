import type { GeoMapSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileGeoMap, compileTileMap } from '../../compile';
import { compileGeoMapPlayback, compileTileMapPlayback } from '../map-playback';
import type { PlaybackOverlayLayout } from '../map-types';

// Three states as delta-encoded TopoJSON polygons, joined by name.
const TOPOLOGY = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
        { type: 'Polygon', id: '36', properties: { name: 'New York' }, arcs: [[2]] },
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
    [
      [-74, 41],
      [1, -1],
      [-3, 2],
      [2, -1],
    ],
  ],
};

// New York skips February (an interior gap); Texas stops reporting after February.
const RATES = [
  { state: 'California', month: '2020-01-01', rate: 2 },
  { state: 'California', month: '2020-02-01', rate: 4 },
  { state: 'California', month: '2020-03-01', rate: 20 },
  { state: 'Texas', month: '2020-01-01', rate: 3 },
  { state: 'Texas', month: '2020-02-01', rate: 5 },
  { state: 'New York', month: '2020-01-01', rate: 1 },
  { state: 'New York', month: '2020-03-01', rate: 9 },
];

const OPTIONS = { width: 600, height: 400 };

function geoSpec(overrides: Partial<GeoMapSpec> = {}): GeoMapSpec {
  return {
    type: 'map',
    geo: { features: TOPOLOGY, idField: 'name', projection: 'mercator' },
    data: RATES,
    encoding: {
      key: { field: 'state', type: 'nominal' },
      color: { field: 'rate', type: 'quantitative', title: 'Insured unemployment' },
      time: { field: 'month', type: 'temporal' },
    },
    ...overrides,
  } as GeoMapSpec;
}

function feature(layout: ReturnType<typeof compileGeoMap>, id: string) {
  const mark = layout.features.find((candidate) => String(candidate.id) === id);
  if (!mark) throw new Error(`no feature ${id}`);
  return mark;
}

describe('compileGeoMapPlayback', () => {
  it('keeps one legend for every period, its classes covering every period', () => {
    const legends = [0, 1, 2].map(
      (t) => compileGeoMap(geoSpec(), { ...OPTIONS, playbackT: t }).continuousLegend,
    );
    expect(legends[1]).toEqual(legends[0]);
    expect(legends[2]).toEqual(legends[0]);
    // March's 20 is the run's maximum, so January's 2 sits in a lower class than it.
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    const january = playback.fillsAt(0).find(({ key }) => key === '06');
    const march = playback.fillsAt(2).find(({ key }) => key === '06');
    expect(january?.binIndex).toBe(0);
    expect(march?.binIndex).toBe(legends[0]?.bins.length ? legends[0].bins.length - 1 : -1);
  });

  it.each([0, 1, 2])('fills period %i the way the static compile of that period does', (t) => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    const layout = compileGeoMap(geoSpec(), { ...OPTIONS, playbackT: t });
    for (const fill of playback.fillsAt(t)) {
      const mark = feature(layout, fill.key);
      expect({ fill: fill.fill, binIndex: fill.binIndex, noData: fill.noData }).toEqual({
        fill: fill.noData ? fill.fill : mark.fill,
        binIndex: mark.binIndex,
        noData: !!mark.noData,
      });
    }
  });

  it('interpolates the value between periods and colors it with the frozen classes', () => {
    const halfway = compileGeoMap(geoSpec(), { ...OPTIONS, playbackT: 1.5 });
    expect(feature(halfway, '06').data?.rate).toBe(12);
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    const fill = playback.fillsAt(1.5).find(({ key }) => key === '06');
    expect(fill).toEqual({
      key: '06',
      fill: feature(halfway, '06').fill,
      binIndex: feature(halfway, '06').binIndex,
      noData: false,
    });
  });

  it('fills an interior gap under interpolate and leaves it empty under drop', () => {
    const filled = compileGeoMapPlayback(geoSpec(), OPTIONS).fillsAt(1);
    expect(filled.find(({ key }) => key === '36')?.noData).toBe(false);
    expect(feature(compileGeoMap(geoSpec(), { ...OPTIONS, playbackT: 1 }), '36').data?.rate).toBe(
      5,
    );

    const dropped = geoSpec({ playback: { gaps: 'drop' } });
    const empty = compileGeoMapPlayback(dropped, OPTIONS).fillsAt(1);
    expect(empty.find(({ key }) => key === '36')?.noData).toBe(true);
  });

  it('shows a state with no value in a period as no data, with the legend keeping its entry', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    expect(playback.fillsAt(2).find(({ key }) => key === '48')?.noData).toBe(true);
    expect(feature(playback.base, '48').noData).toBe(true);
    const january = compileGeoMap(geoSpec(), { ...OPTIONS, playbackT: 0 });
    expect(january.features.every((mark) => !mark.noData)).toBe(true);
    expect(january.continuousLegend?.noData).toBeDefined();
  });

  it('compiles the final period by default, with the period label where the author put it', () => {
    const layout = compileGeoMap(geoSpec(), OPTIONS) as ReturnType<typeof compileGeoMap> &
      PlaybackOverlayLayout;
    expect(feature(layout, '06').data?.rate).toBe(20);
    expect(layout.playbackOverlays?.map(({ key, text }) => ({ key, text }))).toEqual([
      { key: 'oc-playback-period', text: 'Mar 2020' },
    ]);

    const lowerLeft = geoSpec({ playback: { period: { position: 'bottom-left' } } });
    const placed = compileGeoMap(lowerLeft, OPTIONS) as typeof layout;
    const [label] = placed.playbackOverlays ?? [];
    expect(label.textAnchor).toBe('start');
    expect(label.x).toBeLessThan(placed.area.x + placed.area.width / 2);
    expect(label.y).toBeGreaterThan(placed.area.y + placed.area.height / 2);
  });

  it('keeps the automatic period label off the geography when a corner is clear', () => {
    const playback = compileGeoMapPlayback(geoSpec(), { width: 900, height: 300 });
    const [label] = playback.overlaysAt(0);
    const { area } = playback.base;
    const labelLeft = label.textAnchor === 'start' ? label.x : label.x - label.fontSize * 4;
    const labelRight = label.textAnchor === 'start' ? label.x + label.fontSize * 4 : label.x;
    for (const { bounds } of playback.base.features) {
      const left = bounds.x + area.x;
      const right = left + bounds.width;
      const top = bounds.y + area.y;
      const verticallyClear =
        label.dominantBaseline === 'hanging'
          ? label.y + label.fontSize <= top
          : label.y - label.fontSize >= top + bounds.height;
      expect(labelRight <= left || labelLeft >= right || verticallyClear).toBe(true);
    }
  });

  it('labels tooltips with the nearest period and says when it was estimated', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    expect(playback.tooltipAt('36', 1)).toEqual({
      title: 'New York, Feb 2020 (estimated)',
      fields: [{ label: 'Insured unemployment', value: '5', role: 'value' }],
    });
    expect(playback.observedAt('California', 0)).toEqual({ rate: '2' });
    expect(playback.describe(2)).toBe('Mar 2020: highest California 20, lowest New York 9.');
  });

  it('fades points in and out by key and sizes them from the frozen size scale', () => {
    const spec = geoSpec({
      data: [],
      encoding: {},
      points: {
        data: [
          { city: 'A', lon: -118, lat: 34, month: '2020-01-01', jobs: 10 },
          { city: 'A', lon: -118, lat: 34, month: '2020-02-01', jobs: 40 },
          { city: 'B', lon: -97, lat: 30, month: '2020-02-01', jobs: 20 },
        ],
        longitude: { field: 'lon', type: 'quantitative' },
        latitude: { field: 'lat', type: 'quantitative' },
        size: { field: 'jobs', type: 'quantitative' },
        key: { field: 'city', type: 'nominal' },
        time: { field: 'month', type: 'temporal' },
      },
    } as Partial<GeoMapSpec>);
    const playback = compileGeoMapPlayback(spec, OPTIONS);
    expect(playback.base.pointMarks.map(({ key }) => key).sort()).toEqual(['A', 'B']);
    const presence = (t: number) =>
      Object.fromEntries(playback.pointsAt(t).map(({ key, presence }) => [key, presence]));
    expect(presence(0)).toEqual({ A: 1, B: 0 });
    expect(presence(0.75)).toEqual({ A: 1, B: 0.5 });
    expect(presence(1)).toEqual({ A: 1, B: 1 });
    const radius = (t: number) => playback.pointsAt(t).find(({ key }) => key === 'A')?.r ?? 0;
    expect(radius(1)).toBeGreaterThan(radius(0));
    expect(
      compileGeoMap(spec, { ...OPTIONS, playbackT: 0 }).pointMarks.map(({ key }) => key),
    ).toEqual(['A']);
  });
});

describe('compileTileMapPlayback', () => {
  const tileSpec: TileMapSpec = {
    type: 'tilemap',
    data: [
      { code: 'CA', month: '2020-01-01', rate: 2 },
      { code: 'CA', month: '2020-02-01', rate: 10 },
      { code: 'TX', month: '2020-01-01', rate: 4 },
      { code: 'TX', month: '2020-02-01', rate: 6 },
    ],
    encoding: {
      state: { field: 'code', type: 'nominal' },
      value: { field: 'rate', type: 'quantitative' },
      time: { field: 'month', type: 'temporal' },
    },
  };

  it('keeps the legend labels and shades each period as its static compile does', () => {
    const playback = compileTileMapPlayback(tileSpec, OPTIONS);
    for (const t of [0, 1]) {
      const layout = compileTileMap(tileSpec, { ...OPTIONS, playbackT: t });
      expect(layout.legend).toEqual(playback.base.legend);
      for (const fill of playback.fillsAt(t)) {
        const tile = layout.tiles.find(({ stateCode }) => stateCode === fill.key);
        expect(fill).toMatchObject({
          fill: tile?.fill,
          fillOpacity: tile?.fillOpacity,
          labels: { valueText: tile?.valueLabel.text },
        });
      }
    }
    expect(playback.fillsAt(0.5).find(({ key }) => key === 'CA')?.labels?.valueText).toBe('6');
  });
});

describe('map time validation', () => {
  const invalid: Array<[string, unknown, RegExp]> = [
    [
      'a time type playback cannot order',
      geoSpec({
        encoding: { ...geoSpec().encoding, time: { field: 'month', type: 'nominal' } },
      } as Partial<GeoMapSpec>),
      /time type must be one of temporal, ordinal, quantitative/,
    ],
    [
      'a categorical color',
      geoSpec({
        encoding: { ...geoSpec().encoding, color: { field: 'state', type: 'nominal' } },
      } as Partial<GeoMapSpec>),
      /needs a quantitative encoding.color/,
    ],
    [
      'two rows for one state and month',
      geoSpec({ data: [...RATES, { state: 'Texas', month: '2020-01-01', rate: 7 }] }),
      /2 rows have state = 'Texas' and month = 2020-01-01/,
    ],
    [
      'points.time without points.key',
      geoSpec({
        points: {
          data: [{ lon: -100, lat: 30, month: '2020-01-01' }],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          time: { field: 'month', type: 'temporal' },
        },
      }),
      /points.time needs points.key/,
    ],
    [
      'playback.trails on a map',
      geoSpec({ playback: { trails: true } }),
      /playback.trails is only supported on point charts/,
    ],
  ];

  it.each(invalid)('rejects %s', (_, spec, message) => {
    expect(() => compileGeoMap(spec, OPTIONS)).toThrow(message);
  });

  it('rejects a tile map with time and categorical colors', () => {
    const spec = {
      type: 'tilemap',
      data: [{ code: 'CA', month: '2020-01-01', rate: 2, party: 'D' }],
      encoding: {
        state: { field: 'code', type: 'nominal' },
        value: { field: 'rate', type: 'quantitative' },
        color: { field: 'party', type: 'nominal' },
        time: { field: 'month', type: 'temporal' },
      },
    };
    expect(() => compileTileMap(spec, OPTIONS)).toThrow(/needs a quantitative encoding.value/);
  });
});
