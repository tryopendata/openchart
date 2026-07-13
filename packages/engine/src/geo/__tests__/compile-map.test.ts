import { describe, expect, it } from 'vitest';
import { compileMap } from '../../compile';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Minimal valid TopoJSON with 3 US states.
// Arcs are delta-encoded as per the TopoJSON specification:
// first point is absolute, subsequent points are deltas.
const MINI_TOPO = {
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
    // California (approximate): (-122,37) -> (-118,34) -> (-121,36) -> (-122,37)
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    // Texas (approximate): (-100,31) -> (-94,30) -> (-97,26) -> (-100,31)
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
    // New York (approximate): (-74,41) -> (-73,40) -> (-76,42) -> (-74,41)
    [
      [-74, 41],
      [1, -1],
      [-3, 2],
      [2, -1],
    ],
  ],
};

const DEFAULT_OPTIONS = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileMap', () => {
  it('compiles a minimal MapSpec and produces features with paths', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', value: 10 },
          { fips: '48', value: 20 },
          { fips: '36', value: 30 },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.features).toHaveLength(3);
    for (const f of layout.features) {
      expect(f.path).toBeTruthy();
      expect(f.fill).toBeTruthy();
      expect(f.type).toBe('map-feature');
    }
    // Non-shared arcs produce no interior mesh, but outlines should exist
    expect(layout.borders.outlinePath).toBeTruthy();
    expect(layout.width).toBe(600);
  });

  it('produces unmatched data key warnings', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '99', value: 100 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const warning = layout.warnings.find((w) => w.code === 'UNMATCHED_DATA_KEYS');
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('99');
  });

  it('produces unmatched features warning when features have no data', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const warning = layout.warnings.find((w) => w.code === 'UNMATCHED_FEATURES');
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('2');
  });

  it('throws self-documenting error when geo.features is missing', () => {
    expect(() =>
      compileMap(
        {
          type: 'map',
          geo: { features: null },
          data: [],
          encoding: {
            key: { field: 'fips', type: 'nominal' },
            color: { field: 'value', type: 'quantitative' },
          },
        },
        DEFAULT_OPTIONS,
      ),
    ).toThrow(/us-atlas/);
  });

  it('throws when geo.features is not valid TopoJSON', () => {
    expect(() =>
      compileMap(
        {
          type: 'map',
          geo: { features: { type: 'FeatureCollection', features: [] } },
          data: [],
          encoding: {
            key: { field: 'fips', type: 'nominal' },
            color: { field: 'value', type: 'quantitative' },
          },
        },
        DEFAULT_OPTIONS,
      ),
    ).toThrow(/Topology/);
  });

  it('uses mercator projection and produces valid SVG paths', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.features.length).toBeGreaterThan(0);
    expect(layout.features[0].path).toMatch(/^M/);
  });

  it('uses equalEarth projection', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'equalEarth' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.features.length).toBeGreaterThan(0);
  });

  it('includes a gradient legend for quantitative encoding', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', value: 10 },
          { fips: '48', value: 50 },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.gradientLegend).not.toBeNull();
    expect(layout.categoricalLegend).toBeNull();
  });

  it('builds categorical legend for nominal encoding', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', category: 'west' },
          { fips: '48', category: 'south' },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'category', type: 'nominal' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.categoricalLegend).not.toBeNull();
    expect(layout.categoricalLegend!.entries).toHaveLength(2);
    expect(layout.gradientLegend).toBeNull();
  });

  it('assigns neutral fill to features without data', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const matched = layout.features.find((f) => f.id === '06');
    const unmatched = layout.features.find((f) => f.id === '48');
    expect(matched).toBeDefined();
    expect(unmatched).toBeDefined();
    expect(unmatched!.fill).not.toBe(matched!.fill);
  });

  it('emits warnings via onWarn callback', () => {
    const warnings: string[] = [];
    compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '99', value: 100 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      { ...DEFAULT_OPTIONS, onWarn: (msg) => warnings.push(msg) },
    );

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('99'))).toBe(true);
  });

  it('resolves chrome (title, subtitle)', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
        chrome: { title: 'Test Map', subtitle: 'Test subtitle' },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.chrome.title).toBeDefined();
    expect(layout.chrome.subtitle).toBeDefined();
  });
});
