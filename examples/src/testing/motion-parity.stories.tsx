/**
 * Testing / Motion Parity: fixtures for e2e/motion/defaults.spec.ts.
 *
 * Every spec here omits `animation` (except the opt-out story), so each one
 * exercises the default: the entrance plays once the visualization is seen and
 * data updates animate. Not an editorial demo, and not in the visual baseline
 * set (the spec samples motion, it never screenshots it).
 *
 * Each fixture publishes `window.__parity` with the live instance, `update()`
 * (also on the Update button) and `reference()`, which mounts the update's
 * spec with `animation: false` in a sibling host of the same size, so the spec
 * can compare a tween's last frame with a fresh static render.
 */

import type {
  BarListSpec,
  ChartSpec,
  GeoMapSpec,
  GraphSpec,
  SankeySpec,
  TableSpec,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import {
  createBarList,
  createChart,
  createGeoMap,
  createGraph,
  createSankey,
  createTable,
  createTileMap,
} from '@opendata-ai/openchart-vanilla';
import { type CSSProperties, useEffect, useRef } from 'react';

export default { title: 'Testing / Motion Parity' };

type AnySpec =
  | ChartSpec
  | TableSpec
  | SankeySpec
  | TileMapSpec
  | GeoMapSpec
  | BarListSpec
  | GraphSpec;

interface Instance {
  update(spec: AnySpec): void;
  destroy(): void;
}

type Mount = (host: HTMLElement, spec: AnySpec) => Instance;

const mounts = {
  chart: (host, spec) => createChart(host, spec as ChartSpec) as unknown as Instance,
  table: (host, spec) => createTable(host, spec as TableSpec) as unknown as Instance,
  sankey: (host, spec) => createSankey(host, spec as SankeySpec) as unknown as Instance,
  tilemap: (host, spec) => createTileMap(host, spec as TileMapSpec) as unknown as Instance,
  map: (host, spec) => createGeoMap(host, spec as GeoMapSpec) as unknown as Instance,
  barlist: (host, spec) => createBarList(host, spec as BarListSpec) as unknown as Instance,
  graph: (host, spec) => createGraph(host, spec as GraphSpec) as unknown as Instance,
} satisfies Record<string, Mount>;

type Kind = keyof typeof mounts;

interface ParityHandle {
  instance: Instance;
  update(): void;
  reference(): HTMLElement;
}

declare global {
  interface Window {
    __parity?: ParityHandle;
  }
}

// ---------------------------------------------------------------------------
// Specs (no `animation` key: the default is what's under test)
// ---------------------------------------------------------------------------

const chart: ChartSpec = {
  mark: { type: 'bar' },
  data: [
    { k: 'A', v: 90 },
    { k: 'B', v: 60 },
    { k: 'C', v: 40 },
    { k: 'D', v: 20 },
  ],
  encoding: {
    x: { field: 'k', type: 'nominal' },
    y: { field: 'v', type: 'quantitative' },
  },
};

const table: TableSpec = {
  type: 'table',
  data: [
    { name: 'Alpha', value: 12 },
    { name: 'Beta', value: 30 },
    { name: 'Gamma', value: 21 },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value' },
  ],
};

const sankey = (scale: number): SankeySpec => ({
  type: 'sankey',
  data: [
    { source: 'Coal', target: 'Power', value: 30 },
    { source: 'Gas', target: 'Power', value: 20 * scale },
    { source: 'Gas', target: 'Homes', value: 25 },
    { source: 'Solar', target: 'Homes', value: 15 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
});

const tilemap = (ca: number): TileMapSpec => ({
  type: 'tilemap',
  data: { CA: ca, TX: 4.1, NY: 4.4, FL: 3.3, WA: 4.6, IL: 5.0, OH: 4.2, GA: 3.6 },
});

/** Two polygons in plain lon/lat, so points project with the features. */
const MINI_TOPO = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [0, 0] },
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
      [-124, 42],
      [10, -10],
      [-4, 0],
      [-6, 10],
    ],
    [
      [-106, 36],
      [12, 0],
      [-6, -10],
      [-6, 10],
    ],
  ],
};

const map = (la: number): GeoMapSpec =>
  ({
    type: 'map',
    geo: { features: MINI_TOPO, projection: 'mercator' },
    data: [
      { fips: '06', value: 10 },
      { fips: '48', value: 20 },
    ],
    encoding: {
      key: { field: 'fips', type: 'nominal' },
      color: { field: 'value', type: 'quantitative' },
    },
    points: {
      data: [
        { name: 'LA', lat: 34, lon: -118, value: la },
        { name: 'SF', lat: 37.7, lon: -122.4, value: 50 },
        { name: 'HOU', lat: 29.8, lon: -95.4, value: 300 },
      ],
      longitude: { field: 'lon', type: 'quantitative' },
      latitude: { field: 'lat', type: 'quantitative' },
      size: { field: 'value', type: 'quantitative' },
      key: { field: 'name', type: 'nominal' },
    },
  }) as GeoMapSpec;

const barlist = (beta: number): BarListSpec => ({
  type: 'barlist',
  data: [
    { label: 'Alpha', value: 100 },
    { label: 'Beta', value: beta },
    { label: 'Gamma', value: 30 },
    { label: 'Delta', value: 10 },
  ],
  encoding: {
    label: { field: 'label', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
});

const graph: GraphSpec = {
  type: 'graph',
  nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id.toUpperCase() })),
  edges: [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
    { source: 'b', target: 'd' },
    { source: 'c', target: 'e' },
    { source: 'e', target: 'f' },
  ],
};

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

// A fixed size, so the live host and its reference lay out identically: a
// bar list sizes its rows to the container's height.
const hostStyle: CSSProperties = { width: 640, height: 360 };

const withoutAnimation = (spec: AnySpec): AnySpec => ({ ...spec, animation: false }) as AnySpec;

function Fixture({
  kind,
  spec,
  next,
  spacer = 0,
  updateAfterMs,
}: {
  kind: Kind;
  spec: AnySpec;
  next?: AnySpec;
  /** Height of the gap above the fixture, to push it below the fold. */
  spacer?: number;
  /** Update to `next` on a timer, the way a fetch resolving after mount does. */
  updateAfterMs?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const refRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const instance = mounts[kind](host, spec);
    let reference: Instance | null = null;
    const update = () => {
      if (next) instance.update(next);
    };
    window.__parity = {
      instance,
      update,
      reference: () => {
        reference?.destroy();
        reference = mounts[kind](refRef.current!, withoutAnimation(next ?? spec));
        return refRef.current!;
      },
    };
    const timer = updateAfterMs === undefined ? undefined : setTimeout(update, updateAfterMs);
    return () => {
      clearTimeout(timer);
      reference?.destroy();
      instance.destroy();
      window.__parity = undefined;
    };
  }, [kind, spec, next, updateAfterMs]);

  return (
    <div>
      {spacer > 0 && <div data-testid="spacer" style={{ height: spacer }} />}
      <button type="button" onClick={() => window.__parity?.update()} disabled={!next}>
        Update
      </button>
      <div data-testid="parity-host" style={hostStyle} ref={hostRef} />
      <div data-testid="parity-reference" style={hostStyle} ref={refRef} />
    </div>
  );
}

export const Chart = () => <Fixture kind="chart" spec={chart} />;
export const Table = () => <Fixture kind="table" spec={table} />;
/** Below the fold, so the spec sees the reveal start when it scrolls the graph in. */
export const Graph = () => <Fixture kind="graph" spec={graph} spacer={2400} />;

const sankeyFrom = sankey(1);
const sankeyTo = sankey(3);
export const Sankey = () => <Fixture kind="sankey" spec={sankeyFrom} next={sankeyTo} />;

const tilemapFrom = tilemap(2.5);
const tilemapTo = tilemap(6.5);
export const TileMap = () => <Fixture kind="tilemap" spec={tilemapFrom} next={tilemapTo} />;

/** Categories change the tile's fill colour itself (the sequential scale shades through opacity). */
const tilemapCategorical = (ca: string): TileMapSpec => ({
  type: 'tilemap',
  data: { CA: ca, TX: 'Low', NY: 'High', FL: 'Low', WA: 'High' },
  colors: { Low: '#1f77b4', High: '#d62728' },
});
const categoricalFrom = tilemapCategorical('Low');
const categoricalTo = tilemapCategorical('High');
export const TileMapCategorical = () => (
  <Fixture kind="tilemap" spec={categoricalFrom} next={categoricalTo} />
);

const mapFrom = map(100);
const mapTo = map(20);
export const GeoMap = () => <Fixture kind="map" spec={mapFrom} next={mapTo} />;

const barlistFrom = barlist(40);
const barlistTo = barlist(80);
export const BarList = () => <Fixture kind="barlist" spec={barlistFrom} next={barlistTo} />;

/** A chart two viewports down: its entrance must wait to be scrolled to. */
export const BelowFold = () => <Fixture kind="chart" spec={chart} spacer={2400} />;

/**
 * Mount on rows whose values haven't arrived (null), then update with the real
 * data 200ms later: the entrance plays on the real data, not the empty frame.
 */
const pending: ChartSpec = {
  ...chart,
  data: (chart.data as Array<{ k: string; v: number }>).map(({ k }) => ({ k, v: null })),
};
export const EmptyThenUpdate = () => (
  <Fixture kind="chart" spec={pending} next={chart} updateAfterMs={200} />
);

/** Every type with `animation: false`: nothing animates. */
const staticSpecs: Array<[Kind, AnySpec]> = [
  ['chart', chart],
  ['table', table],
  ['sankey', sankeyFrom],
  ['tilemap', tilemapFrom],
  ['map', mapFrom],
  ['barlist', barlistFrom],
  ['graph', graph],
];

function StaticHost({ kind, spec }: { kind: Kind; spec: AnySpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const instance = mounts[kind](ref.current!, withoutAnimation(spec));
    (ref.current as HTMLDivElement & { __instance?: Instance }).__instance = instance;
    return () => instance.destroy();
  }, [kind, spec]);
  return <div data-testid={`static-${kind}`} style={hostStyle} ref={ref} />;
}

export const AnimationFalse = () => (
  <div>
    {staticSpecs.map(([kind, spec]) => (
      <StaticHost key={kind} kind={kind} spec={spec} />
    ))}
  </div>
);
