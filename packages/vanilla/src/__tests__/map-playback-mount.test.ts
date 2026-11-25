import type { DataRow, GeoMapSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createGeoMap } from '../map-mount';
import type { PlaybackController } from '../playback/types';
import { createTileMap } from '../tilemap-mount';

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

const STATES = [
  { state: 'California', code: 'CA' },
  { state: 'Texas', code: 'TX' },
  { state: 'New York', code: 'NY' },
];
const MONTHS = ['2020-01-01', '2020-02-01', '2020-03-01'];

/** Rates that climb month over month, steeper for each state, times `scale`. */
function rows(scale = 1): DataRow[] {
  return STATES.flatMap(({ state, code }, index) =>
    MONTHS.map((month, period) => ({
      state,
      code,
      month,
      rate: (1 + index) * (1 + 4 * period) * scale,
    })),
  );
}

const TIME = { field: 'month', type: 'temporal' } as const;

function geoSpec(withTime = true): GeoMapSpec {
  return {
    type: 'map',
    geo: { features: TOPOLOGY, idField: 'name', projection: 'mercator' },
    data: rows(),
    encoding: {
      key: { field: 'state', type: 'nominal' },
      color: { field: 'rate', type: 'quantitative' },
      ...(withTime ? { time: TIME } : {}),
    },
    playback: { autoplay: false },
  } as GeoMapSpec;
}

function tileSpec(data = rows()): TileMapSpec {
  return {
    type: 'tilemap',
    data,
    encoding: {
      state: { field: 'code', type: 'nominal' },
      value: { field: 'rate', type: 'quantitative' },
      time: TIME,
    },
    playback: { autoplay: false },
  } as TileMapSpec;
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
});

function mountGeo(spec: GeoMapSpec) {
  const container = createContainer(640, 480);
  document.body.append(container);
  const map = createGeoMap(container, spec, { autoResize: false });
  cleanup.push(() => map.destroy());
  return { container, map };
}

function mountTile(spec: TileMapSpec) {
  const container = createContainer(640, 480);
  document.body.append(container);
  const map = createTileMap(container, spec, { autoResize: false });
  cleanup.push(() => map.destroy());
  return { container, map };
}

function controllerOf(map: { playback: PlaybackController | null }): PlaybackController {
  if (!map.playback) throw new Error('expected a playback controller');
  return map.playback;
}

function featureFills(root: ParentNode): string[] {
  return [...root.querySelectorAll('.oc-map-feature')].map((el) => el.getAttribute('fill') ?? '');
}

/** A sequential tile map shades one hue by opacity, so paint is fill plus fill-opacity. */
function tileFills(root: ParentNode): string[] {
  return [...root.querySelectorAll('.oc-tilemap-tile rect')].map(
    (el) => `${el.getAttribute('fill')} ${el.getAttribute('fill-opacity')}`,
  );
}

describe('geo map playback', () => {
  it('is a controller for a time spec and null otherwise', () => {
    expect(mountGeo(geoSpec()).map.playback).not.toBeNull();
    expect(mountGeo(geoSpec(false)).map.playback).toBeNull();
  });

  it('repaints the features when the playhead moves', () => {
    const { container, map } = mountGeo(geoSpec());
    const controller = controllerOf(map);
    controller.seek(0);
    const first = featureFills(container);
    controller.seek(2);
    expect(featureFills(container)).not.toEqual(first);
    expect(container.querySelector('.oc-playback-period')?.textContent).toMatch(/Mar/);
  });

  it('mounts the controls strip below the map, and none without time', () => {
    const { container } = mountGeo(geoSpec());
    const strip = container.querySelector('.oc-playback-strip');
    expect(strip).not.toBeNull();
    expect(strip?.previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    expect(mountGeo(geoSpec(false)).container.querySelector('.oc-playback-strip')).toBeNull();
  });

  it('keeps the controller and the period through a compatible update', () => {
    const { map } = mountGeo(geoSpec());
    const controller = controllerOf(map);
    controller.seek(1);
    map.update({ ...geoSpec(), data: rows(2) });
    expect(map.playback).toBe(controller);
    expect(controller.getState().t).toBe(1);
  });

  it('exports the frame on screen as SVG', () => {
    const { container, map } = mountGeo(geoSpec());
    controllerOf(map).seek(0);
    const doc = new DOMParser().parseFromString(map.export('svg') as string, 'image/svg+xml');
    expect(featureFills(doc)).toEqual(featureFills(container));
    expect(doc.querySelector('.oc-playback-period')?.textContent).toMatch(/Jan/);
  });
});

describe('tile map playback', () => {
  it('repaints the tiles when the playhead moves, under a controls strip', () => {
    const { container, map } = mountTile(tileSpec());
    const controller = controllerOf(map);
    expect(container.querySelector('.oc-playback-strip')).not.toBeNull();
    controller.seek(0);
    const first = tileFills(container);
    controller.seek(2);
    expect(tileFills(container)).not.toEqual(first);
  });

  it('keeps the controller through a compatible update', () => {
    const { map } = mountTile(tileSpec());
    const controller = controllerOf(map);
    map.update(tileSpec(rows(2)));
    expect(map.playback).toBe(controller);
  });

  it('exports the frame on screen as SVG', () => {
    const { container, map } = mountTile(tileSpec());
    controllerOf(map).seek(0);
    const doc = new DOMParser().parseFromString(map.export('svg') as string, 'image/svg+xml');
    expect(tileFills(doc)).toEqual(tileFills(container));
  });
});
