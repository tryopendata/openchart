import type { GeoMapSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileGeoMapPlayback, compileTileMapPlayback } from '../map-playback';
import { periodLabelPlacement } from '../overlays';

// Three states keyed by FIPS id. Utah has no name, as some boundary files leave it out.
const TOPOLOGY = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
        { type: 'Polygon', id: '49', properties: {}, arcs: [[2]] },
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
      [-112, 40],
      [1, -1],
      [-3, 2],
      [2, -1],
    ],
  ],
};

// Texas has no value in March, so it fades to no data between February and March.
const RATES = [
  { fips: '06', month: '2020-01-01', rate: 2 },
  { fips: '06', month: '2020-02-01', rate: 4 },
  { fips: '06', month: '2020-03-01', rate: 20 },
  { fips: '48', month: '2020-01-01', rate: 3 },
  { fips: '48', month: '2020-02-01', rate: 30 },
  { fips: '49', month: '2020-01-01', rate: 1 },
  { fips: '49', month: '2020-02-01', rate: 2 },
  { fips: '49', month: '2020-03-01', rate: 9 },
];

const OPTIONS = { width: 600, height: 400 };

const POINTS = {
  data: [
    { city: 'Austin', lon: -97, lat: 30, month: '2020-01-01', jobs: 10 },
    { city: 'Austin', lon: -97, lat: 30, month: '2020-02-01', jobs: 40 },
    { city: 'Fresno', lon: -119, lat: 36, month: '2020-02-01', jobs: 20 },
  ],
  longitude: { field: 'lon', type: 'quantitative' },
  latitude: { field: 'lat', type: 'quantitative' },
  size: { field: 'jobs', type: 'quantitative', title: 'Jobs' },
  key: { field: 'city', type: 'nominal' },
  time: { field: 'month', type: 'temporal' },
};

function geoSpec(overrides: Record<string, unknown> = {}): GeoMapSpec {
  return {
    type: 'map',
    geo: { features: TOPOLOGY, idField: 'id', projection: 'mercator' },
    data: RATES,
    encoding: {
      key: { field: 'fips', type: 'nominal' },
      color: { field: 'rate', type: 'quantitative', title: 'Rate' },
      time: { field: 'month', type: 'temporal' },
    },
    ...overrides,
  } as GeoMapSpec;
}

describe('geo map playback frames', () => {
  it('names the live-region extremes by feature name, falling back to the key', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    expect(playback.describe(1)).toBe('Feb 2020: highest Texas 30, lowest 49 2.');
  });

  it('titles an unnamed feature with its key, never a leading comma', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    expect(playback.tooltipAt('49', 0)?.title).toBe('49, Jan 2020');
    expect(playback.tooltipAt('48', 0)?.title).toBe('Texas, Jan 2020');
  });

  it('crossfades a feature losing its value from its class fill to no data', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    const texas = (t: number) => playback.fillsAt(t).find(({ key }) => key === '48');
    const february = texas(1);
    expect(february).toMatchObject({ noData: false });
    expect(february?.fade).toBeUndefined();
    // Leaving fades over the first half of the interval: a quarter in, three quarters show.
    expect(texas(1.25)).toMatchObject({
      fill: february?.fill,
      noData: false,
      fade: { opacity: 0.5 },
    });
    expect(texas(1.4)?.fade?.opacity).toBeCloseTo(0.2);
    expect(texas(1.4)?.fill).toBe(february?.fill);
    expect(texas(2)).toMatchObject({ noData: true });
    expect(texas(2)?.fade).toBeUndefined();
  });

  it('carries each feature and tile aria label at the nearest period', () => {
    const playback = compileGeoMapPlayback(geoSpec(), OPTIONS);
    const label = (t: number, key: string) =>
      playback.fillsAt(t).find((fill) => fill.key === key)?.ariaLabel;
    expect(label(0, '06')).toBe('California: 2');
    expect(label(1.6, '06')).toBe('California: 20');
    expect(label(2, '48')).toBe('Texas: no data');
    expect(label(0, '49')).toBe('49');

    const tiles = compileTileMapPlayback(
      {
        type: 'tilemap',
        data: [
          { code: 'CA', month: '2020-01-01', rate: 2 },
          { code: 'CA', month: '2020-02-01', rate: 10 },
        ],
        encoding: {
          state: { field: 'code', type: 'nominal' },
          value: { field: 'rate', type: 'quantitative' },
          time: { field: 'month', type: 'temporal' },
        },
      } as TileMapSpec,
      OPTIONS,
    );
    expect(tiles.fillsAt(0).find(({ key }) => key === 'CA')?.ariaLabel).toBe('California: 2');
    expect(tiles.fillsAt(1).find(({ key }) => key === 'CA')?.ariaLabel).toBe('California: 10');
  });

  it('reads point tooltips and aria labels at the nearest period, with no data when absent', () => {
    const playback = compileGeoMapPlayback(geoSpec({ points: POINTS }), OPTIONS);
    const jobs = (key: string, t: number) =>
      playback.tooltipAt(`point:${key}`, t)?.fields.find(({ label }) => label === 'Jobs')?.value;
    expect(playback.tooltipAt('point:Austin', 0)?.title).toBe('Austin, Jan 2020');
    expect(jobs('Austin', 0)).toBe('10');
    expect(jobs('Austin', 1)).toBe('40');
    expect(playback.tooltipAt('point:Fresno', 0)?.title).toBe('Fresno, Jan 2020');
    expect(jobs('Fresno', 0)).toBe('No data');
    const point = (t: number, key: string) => playback.pointsAt(t).find((p) => p.key === key);
    expect(point(0, 'Fresno')?.ariaLabel).toBe('Fresno: no data');
    expect(point(1, 'Fresno')?.ariaLabel).toBe('Fresno');
  });

  it('shares periods between layers whose time values are Date objects', () => {
    const month = (index: number) => new Date(Date.UTC(2020, index, 1));
    const data = RATES.map((row) => ({ ...row, month: month(Number(row.month.slice(5, 7)) - 1) }));
    const points = {
      ...POINTS,
      data: POINTS.data.map((row) => ({
        ...row,
        month: month(Number(row.month.slice(5, 7)) - 1),
      })),
    };
    const warnings: string[] = [];
    const playback = compileGeoMapPlayback(geoSpec({ data, points }), {
      ...OPTIONS,
      onWarn: (message: string) => warnings.push(message),
    });
    expect(playback.periodLabels).toEqual(['Jan 2020', 'Feb 2020', 'Mar 2020']);
    expect(warnings.filter((message) => /Skipped/.test(message))).toEqual([]);
  });
});

describe('map period label size', () => {
  it('sizes the corner label for a map at about 60% of the chart corner size', () => {
    for (const width of [800, 360]) {
      const playback = compileGeoMapPlayback(geoSpec(), { width, height: 600 });
      const [label] = playback.overlaysAt(0);
      const chartSize = periodLabelPlacement('bottom-left', playback.base.area, 'map').fontSize;
      expect(label.fontSize / chartSize).toBeGreaterThan(0.5);
      expect(label.fontSize / chartSize).toBeLessThan(0.7);
    }
  });
});
