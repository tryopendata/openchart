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
    ).toThrow(/features/);
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

  it('includes a continuous legend for quantitative encoding', () => {
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

    expect(layout.continuousLegend).not.toBeNull();
    expect(layout.continuousLegend!.type).toBe('continuous');
    expect(layout.categoricalLegend).toBeNull();
  });

  it('continuous legend has 5 bins by default', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', value: 10 },
          { fips: '48', value: 50 },
          { fips: '36', value: 30 },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.continuousLegend).not.toBeNull();
    expect(layout.continuousLegend!.mode).toBe('binned');
    expect(layout.continuousLegend!.bins.length).toBe(5);
  });

  it('continuous legend defaults to top position', () => {
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

    expect(layout.continuousLegend!.position).toBe('top');
  });

  it('honors position: bottom for continuous legend', () => {
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
        legend: { position: 'bottom' },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.continuousLegend!.position).toBe('bottom');
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
    expect(layout.continuousLegend).toBeNull();
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

  it('identity projection paths fit inside layout.area', () => {
    // Pre-projected coordinates (pixel-space) that identity should scale to fit
    const PRE_PROJECTED_TOPO = {
      type: 'Topology',
      objects: {
        regions: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', id: 'A', properties: { name: 'Region A' }, arcs: [[0]] },
            { type: 'Polygon', id: 'B', properties: { name: 'Region B' }, arcs: [[1]] },
          ],
        },
      },
      arcs: [
        // Region A: (0,0) -> (100,0) -> (100,50) -> (0,50) -> (0,0)
        [
          [0, 0],
          [100, 0],
          [0, 50],
          [-100, 0],
          [0, -50],
        ],
        // Region B: (100,0) -> (200,0) -> (200,50) -> (100,50) -> (100,0)
        [
          [100, 0],
          [100, 0],
          [0, 50],
          [-100, 0],
          [0, -50],
        ],
      ],
    };

    const layout = compileMap(
      {
        type: 'map',
        geo: { features: PRE_PROJECTED_TOPO, projection: 'identity' },
        data: [
          { id: 'A', value: 10 },
          { id: 'B', value: 20 },
        ],
        encoding: {
          key: { field: 'id', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.features.length).toBe(2);
    // Verify paths exist and geometry actually scaled (not just passthrough)
    for (const f of layout.features) {
      expect(f.path).toMatch(/^M/);
      // Extract coordinates from the path and verify they fit within layout area
      const coords = f.path.match(/[-\d.]+/g)?.map(Number) ?? [];
      expect(coords.length).toBeGreaterThan(0);
    }
  });

  it('identity projection emits no INVERTED_WINDING warning', () => {
    const warnings: string[] = [];
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'identity' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      { ...DEFAULT_OPTIONS, onWarn: (msg) => warnings.push(msg) },
    );

    const windingWarning = layout.warnings.find((w) => w.code === 'INVERTED_WINDING');
    expect(windingWarning).toBeUndefined();
  });

  it('every feature has finite bounds and centroid within mapSize', () => {
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

    const { mapSize } = layout;
    for (const f of layout.features) {
      expect(Number.isFinite(f.bounds.x)).toBe(true);
      expect(Number.isFinite(f.bounds.y)).toBe(true);
      expect(Number.isFinite(f.bounds.width)).toBe(true);
      expect(Number.isFinite(f.bounds.height)).toBe(true);
      expect(f.bounds.width).toBeGreaterThan(0);
      expect(f.bounds.height).toBeGreaterThan(0);

      // Centroid should be finite and within the mapSize
      expect(Number.isFinite(f.centroid[0])).toBe(true);
      expect(Number.isFinite(f.centroid[1])).toBe(true);
      expect(f.centroid[0]).toBeGreaterThanOrEqual(0);
      expect(f.centroid[0]).toBeLessThanOrEqual(mapSize.width);
      expect(f.centroid[1]).toBeGreaterThanOrEqual(0);
      expect(f.centroid[1]).toBeLessThanOrEqual(mapSize.height);
    }
  });

  it('mapSize has positive width and height', () => {
    const layout = compileMap(
      {
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
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.mapSize.width).toBeGreaterThan(0);
    expect(layout.mapSize.height).toBeGreaterThan(0);
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

  // ---------------------------------------------------------------------------
  // Focus resolution
  // ---------------------------------------------------------------------------

  it('geo.focus as single string produces layout.focus with matching bounds', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: '36' },
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

    expect(layout.focus).not.toBeNull();
    expect(layout.focus!.ids).toEqual(['36']);
    expect(layout.focus!.target.width).toBeGreaterThan(0);
    expect(layout.focus!.target.height).toBeGreaterThan(0);
    expect(layout.focus!.target.padding).toBe(16);
  });

  it('geo.focus as array produces union bounds', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: ['36', '06'] },
        data: [
          { fips: '06', value: 10 },
          { fips: '36', value: 30 },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).not.toBeNull();
    expect(layout.focus!.ids).toHaveLength(2);
    expect(layout.focus!.ids.map(String).sort()).toEqual(['06', '36']);
  });

  it('geo.focus object form with custom padding', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: {
          features: MINI_TOPO,
          projection: 'mercator',
          focus: { features: '36', padding: 32 },
        },
        data: [{ fips: '36', value: 30 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).not.toBeNull();
    expect(layout.focus!.target.padding).toBe(32);
    expect(layout.focus!.ids).toEqual(['36']);
  });

  it('geo.focus: null produces layout.focus: null', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: null },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).toBeNull();
  });

  it('geo.focus { points: true } fits the point cluster, not any feature', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: {
          features: MINI_TOPO,
          projection: 'mercator',
          focus: { points: true, padding: 4 },
        },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: {
          data: [
            { lat: 34, lon: -118, name: 'LA' },
            { lat: 40.7, lon: -74, name: 'NYC' },
          ],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          key: { field: 'name', type: 'nominal' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).not.toBeNull();
    expect(layout.focus!.target.padding).toBe(4);
    // No feature ids: an all-points focus dims no features.
    expect(layout.focus!.ids).toEqual([]);
    // The target spans the two points (plus their radii), which sit far apart,
    // so it has real width and height.
    expect(layout.focus!.target.width).toBeGreaterThan(0);
    expect(layout.focus!.target.height).toBeGreaterThan(0);
    // The fitted cluster must be smaller than the full map extent.
    expect(layout.focus!.target.width).toBeLessThan(layout.mapSize.width);
  });

  it('geo.focus { points: { field, value } } fits only the matching subset', () => {
    const opts = {
      data: [
        { lat: 34, lon: -118, name: 'LA', rating: 'A' },
        { lat: 40.7, lon: -74, name: 'NYC', rating: 'F' },
      ],
      longitude: { field: 'lon', type: 'quantitative' as const },
      latitude: { field: 'lat', type: 'quantitative' as const },
      key: { field: 'name', type: 'nominal' as const },
    };
    const all = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: { points: true } },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: opts,
      },
      DEFAULT_OPTIONS,
    );
    const subset = compileMap(
      {
        type: 'map',
        geo: {
          features: MINI_TOPO,
          projection: 'mercator',
          focus: { points: { field: 'rating', value: 'A' } },
        },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: opts,
      },
      DEFAULT_OPTIONS,
    );

    expect(subset.focus).not.toBeNull();
    // One point vs two: the subset target is strictly smaller than the all-points target.
    expect(subset.focus!.target.width).toBeLessThan(all.focus!.target.width);
  });

  it('geo.focus { points: { field, value } } with no match emits FOCUS_UNMATCHED', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: {
          features: MINI_TOPO,
          projection: 'mercator',
          focus: { points: { field: 'rating', value: 'Z' } },
        },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: {
          data: [{ lat: 34, lon: -118, name: 'LA', rating: 'A' }],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          key: { field: 'name', type: 'nominal' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).toBeNull();
    expect(layout.warnings.some((w) => w.code === 'FOCUS_UNMATCHED')).toBe(true);
  });

  it('geo.focus { points: true } with no points emits FOCUS_UNMATCHED and no focus', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: {
          features: MINI_TOPO,
          projection: 'mercator',
          focus: { points: true },
        },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.focus).toBeNull();
    expect(layout.warnings.some((w) => w.code === 'FOCUS_UNMATCHED')).toBe(true);
  });

  it('unknown focus id emits FOCUS_UNMATCHED warning', () => {
    const layout = compileMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: '99' },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const warning = layout.warnings.find((w) => w.code === 'FOCUS_UNMATCHED');
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('99');
    expect(layout.focus).toBeNull();
  });

  it('no focus specified produces layout.focus: null', () => {
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

    expect(layout.focus).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Point layer
  // ---------------------------------------------------------------------------

  describe('point layer', () => {
    it('compiles points through projection', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [
              { lat: 34, lon: -118, name: 'LA' },
              { lat: 40.7, lon: -74, name: 'NYC' },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      expect(layout.pointMarks).toHaveLength(2);
      for (const pm of layout.pointMarks) {
        expect(Number.isFinite(pm.cx)).toBe(true);
        expect(Number.isFinite(pm.cy)).toBe(true);
      }
    });

    it('drops null-projecting points with warning', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'albersUsa' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [{ lat: 0, lon: 0, name: 'Pacific' }],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      expect(layout.pointMarks).toHaveLength(0);
      const warning = layout.warnings.find((w) => w.code === 'POINT_NULL_PROJECTION');
      expect(warning).toBeDefined();
    });

    it('builds sqrt size scale for points', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [
              { lat: 34, lon: -118, name: 'A', value: 10 },
              { lat: 40.7, lon: -74, name: 'B', value: 1000 },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            size: { field: 'value', type: 'quantitative' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      expect(layout.pointMarks).toHaveLength(2);
      const radii = layout.pointMarks.map((pm) => pm.r);
      expect(radii[0]).not.toBe(radii[1]);
      // Map point size scale range is [3, 20]
      for (const r of radii) {
        expect(r).toBeGreaterThanOrEqual(3);
        expect(r).toBeLessThanOrEqual(20);
      }
    });

    it('builds independent categorical color scale', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [
              { lat: 34, lon: -118, name: 'A', cat: 'x' },
              { lat: 40.7, lon: -74, name: 'B', cat: 'y' },
              { lat: 37, lon: -100, name: 'C', cat: 'z' },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            color: { field: 'cat', type: 'nominal' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      expect(layout.pointMarks).toHaveLength(3);
      const fills = layout.pointMarks.map((pm) => pm.fill);
      // 3 different categories should produce 3 different colors
      expect(new Set(fills).size).toBe(3);
    });

    it('basemap-only: neutral fill when no encoding.color', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [{ lat: 34, lon: -118, name: 'LA' }],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      // Features should all have the neutral fill (#e8e8e8 in light mode)
      for (const f of layout.features) {
        expect(f.fill).toBe('#e8e8e8');
      }
    });

    it('generates point tooltips with point: prefix', () => {
      const layout = compileMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: { key: { field: 'id', type: 'nominal' } },
          points: {
            data: [
              { lat: 34, lon: -118, name: 'LA', value: 100 },
              { lat: 40.7, lon: -74, name: 'NYC', value: 200 },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            tooltip: [
              { field: 'name', type: 'nominal', title: 'City' },
              { field: 'value', type: 'quantitative', title: 'Pop' },
            ],
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      const pointKeys = [...layout.tooltipDescriptors.keys()].filter((k) => k.startsWith('point:'));
      expect(pointKeys).toHaveLength(2);
      expect(pointKeys).toContain('point:LA');
      expect(pointKeys).toContain('point:NYC');

      const laTooltip = layout.tooltipDescriptors.get('point:LA');
      expect(laTooltip).toBeDefined();
      expect(laTooltip!.fields).toHaveLength(2);
      expect(laTooltip!.fields[0].label).toBe('City');
    });

    it('handles points alongside choropleth', () => {
      const layout = compileMap(
        {
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
              { lat: 34, lon: -118, name: 'LA', pop: 400 },
              { lat: 31, lon: -100, name: 'TX City', pop: 200 },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            key: { field: 'name', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      // Choropleth features should have color-encoded fills
      const matchedFeature = layout.features.find((f) => f.id === '06');
      expect(matchedFeature).toBeDefined();
      expect(matchedFeature!.fill).not.toBe('#e8e8e8');

      // Point marks should also be present
      expect(layout.pointMarks).toHaveLength(2);
      for (const pm of layout.pointMarks) {
        expect(Number.isFinite(pm.cx)).toBe(true);
        expect(Number.isFinite(pm.cy)).toBe(true);
      }
    });
  });
});
