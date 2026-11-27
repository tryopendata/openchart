import { describe, expect, it } from 'vitest';
import { BARLIST_KIND } from '../../barlist/compile-barlist';
import { TABLE_KIND } from '../../compile';
import { GEO_MAP_KIND } from '../../geo/compile-geo-map';
import { GRAPH_KIND } from '../../graphs/compile-graph';
import {
  compileBarList,
  compileGeoMap,
  compileGraph,
  compileSankey,
  compileTable,
  compileTileMap,
  prepareRace,
} from '../../index';
import { SANKEY_KIND } from '../../sankey/compile-sankey';
import { TILE_MAP_KIND } from '../../tilemap/compile-tilemap';
import { compile } from '../index';
import { compileKind } from '../kind';

const options = { width: 600, height: 400 };
const sankey = {
  type: 'sankey',
  data: [
    { from: 'A', to: 'C', amount: 10 },
    { from: 'B', to: 'C', amount: 20 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'amount', type: 'quantitative' },
  },
};
const table = {
  type: 'table',
  data: [{ name: 'Alice', age: 30, score: 88.5 }],
  columns: [{ key: 'name' }, { key: 'age' }, { key: 'score' }],
};
const graph = {
  type: 'graph',
  nodes: [
    { id: 'a', group: 'X', value: 10, name: 'Alice' },
    { id: 'b', group: 'X', value: 20, name: 'Bob' },
  ],
  edges: [{ source: 'a', target: 'b', weight: 1 }],
  seedNode: 'c',
  annotations: [
    { id: 'alice', type: 'text', x: 0, y: 0, text: 'Alice' },
    { type: 'text', x: 1, y: 1, text: 'Bob' },
  ],
};
const tilemap = { type: 'tilemap', data: { CA: 5.4, TX: 4.1, NY: 4.5, FL: 3.3, IL: 4.6 } };
const map = {
  type: 'map',
  geo: {
    features: {
      type: 'Topology',
      objects: {
        states: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
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
      ],
    },
    projection: 'mercator',
  },
  data: [{ fips: '06', value: 10 }],
  encoding: {
    key: { field: 'fips', type: 'nominal' },
    color: { field: 'value', type: 'quantitative' },
  },
};
const barlist = {
  type: 'barlist',
  data: [
    { label: 'Alpha', count: 100 },
    { label: 'Beta', count: 75 },
  ],
  encoding: {
    label: { field: 'label', type: 'nominal' },
    value: { field: 'count', type: 'quantitative' },
  },
};
const race = {
  type: 'race',
  data: [
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
  mark: 'bar',
  race: { top: 1, controls: false },
};

function genericError(spec: unknown): Error {
  try {
    compile(spec);
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected the generic compiler to reject the fixture');
}

const cases: {
  name: string;
  run: (spec: unknown) => unknown;
  valid: { type: string };
  compileNormalized: (spec: unknown, wrongType: string) => ReturnType<typeof compile>;
  wrongType: string;
  invalid: Record<string, unknown>;
}[] = [
  {
    name: 'compileSankey',
    run: (spec) => compileSankey(spec, options),
    valid: sankey,
    compileNormalized: (spec, wrongType) => compileKind(spec, SANKEY_KIND, wrongType),
    wrongType:
      'compileSankey received a non-sankey spec. Use compileChart, compileTable, or compileGraph instead.',
    invalid: {
      'empty data': { ...sankey, data: [] },
      'missing source': {
        ...sankey,
        encoding: { target: sankey.encoding.target, value: sankey.encoding.value },
      },
      'missing value with invalid chrome and animation': {
        ...sankey,
        encoding: { source: sankey.encoding.source, target: sankey.encoding.target },
        chrome: { title: 7 },
        animation: { enter: { duration: -1 } },
      },
    },
  },
  {
    name: 'compileTable',
    run: (spec) => compileTable(spec, options),
    valid: table,
    compileNormalized: (spec, wrongType) => compileKind(spec, TABLE_KIND, wrongType),
    wrongType: 'compileTable received a non-table spec. Use compileChart instead.',
    invalid: {
      'empty data': { ...table, data: [] },
      'unknown column': { ...table, columns: [{ key: 'missing' }] },
      'removed density option': { ...table, compact: true, density: 'condensed' },
    },
  },
  {
    name: 'compileGraph',
    run: (spec) => compileGraph(spec, options),
    valid: graph,
    compileNormalized: (spec, wrongType) => compileKind(spec, GRAPH_KIND, wrongType),
    wrongType: 'compileGraph received a non-graph spec. Use compileChart or compileTable instead.',
    invalid: {
      'empty nodes': { ...graph, nodes: [] },
      'unknown edge endpoint': { ...graph, edges: [{ source: 'a', target: 'missing' }] },
      'invalid graph animation and inapplicable mark option': {
        ...graph,
        animation: { enter: { stagger: 'yes' } },
        mark: { type: 'bar', innerRadius: 5 },
      },
    },
  },
  {
    name: 'compileTileMap',
    run: (spec) => compileTileMap(spec, options),
    valid: tilemap,
    compileNormalized: (spec, wrongType) => compileKind(spec, TILE_MAP_KIND, wrongType),
    wrongType:
      'compileTileMap received a non-tilemap spec. Use compileChart, compileTable, compileGraph, or compileSankey instead.',
    invalid: {
      'empty record map': { ...tilemap, data: {} },
      'tabular data without encoding': { ...tilemap, data: [{ state: 'CA', value: 5.4 }] },
      'empty tabular data': { ...tilemap, data: [] },
    },
  },
  {
    name: 'compileGeoMap',
    run: (spec) => compileGeoMap(spec, options),
    valid: map,
    compileNormalized: (spec, wrongType) => compileKind(spec, GEO_MAP_KIND, wrongType),
    wrongType:
      'compileGeoMap received a non-map spec. Use compileChart, compileTileMap, compileSankey, or compileBarList instead.',
    invalid: {
      'missing features': { ...map, geo: { features: null } },
      'missing key encoding': { ...map, encoding: { color: map.encoding.color } },
      'missing color encoding': { ...map, encoding: { key: map.encoding.key } },
    },
  },
  {
    name: 'compileBarList',
    run: (spec) => compileBarList(spec, options),
    valid: barlist,
    compileNormalized: (spec, wrongType) => compileKind(spec, BARLIST_KIND, wrongType),
    wrongType:
      'compileBarList received a non-barlist spec. Use compileChart, compileTable, compileGraph, compileSankey, or compileTileMap instead.',
    invalid: {
      'empty data': { ...barlist, data: [] },
      'missing value encoding': { ...barlist, encoding: { label: barlist.encoding.label } },
      'unknown value field': {
        ...barlist,
        encoding: { ...barlist.encoding, value: { ...barlist.encoding.value, field: 'missing' } },
      },
    },
  },
  {
    name: 'prepareRace',
    run: (spec) => prepareRace(spec, {}),
    valid: race,
    compileNormalized: (input) => {
      const { spec, warnings } = prepareRace(input, { onWarn: () => {} });
      return { spec, warnings };
    },
    wrongType:
      'prepareRace received a non-race spec. Set type to "race" or use the matching compiler.',
    invalid: {
      'null color channel': { ...race, encoding: { ...race.encoding, color: null } },
      'null data row': { ...race, data: [null, ...race.data] },
      'unsupported time type': {
        ...race,
        encoding: { ...race.encoding, time: { ...race.encoding.time, type: 'nominal' } },
      },
    },
  },
];

describe.each(cases)('$name', ({ run, valid, compileNormalized, wrongType, invalid }) => {
  it('matches the normalized spec and warnings from the generic compiler', () => {
    expect(compileNormalized(valid, wrongType)).toEqual(compile(valid));
  });

  it.each(Object.entries(invalid))('matches the generic compiler for %s', (_name, spec) => {
    expect(() => run(spec)).toThrow(genericError(spec));
  });

  it('rejects an invalid spec of another type before validating that type', () => {
    const other =
      valid.type === 'table'
        ? { type: 'graph', nodes: [] }
        : { type: 'table', data: [], compact: true, encoding: { time: { field: 'year' } } };
    expect(() => compile(other)).toThrow(/^Invalid spec:\n/);
    expect(() => run(other)).toThrow(new Error(wrongType));
  });
});

it('compiles a sankey with a stray mark key as a sankey', () => {
  expect(compileSankey({ ...sankey, mark: 'bar' }, options)).toEqual(
    compileSankey(sankey, options),
  );
});
