import { describe, expect, it } from 'vitest';
import { compileGeoMap } from '../../compile';

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

describe('compileGeoMap', () => {
  it('compiles a minimal GeoMapSpec and produces features with paths', () => {
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
      compileGeoMap(
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
      compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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

  it('encoding.color.format takes precedence over deprecated valueFormat', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 1500 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative', format: '$,.0f' },
        },
        valueFormat: '.2f',
      },
      DEFAULT_OPTIONS,
    );

    const ca = layout.tooltipDescriptors.get('06');
    expect(ca!.fields.map((f) => f.value)).toContain('$1,500');
  });

  it('deprecated valueFormat still formats tooltips when no encoding format is set', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 1500 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
        valueFormat: '$,.0f',
      },
      DEFAULT_OPTIONS,
    );

    const ca = layout.tooltipDescriptors.get('06');
    expect(ca!.fields.map((f) => f.value)).toContain('$1,500');
  });

  it('classes the default legend on round breaks', () => {
    const layout = compileGeoMap(
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
    // A [10, 50] domain asked for 5 classes lands on a step of 10, so the
    // breaks are 20/30/40 and there are 4 classes. Round breaks win over an
    // exact class count -- that is the point of the quantize default.
    expect(layout.continuousLegend!.ticks.map((t) => t.value)).toEqual([20, 30, 40]);
    expect(layout.continuousLegend!.bins.length).toBe(4);
    // Titled, with the field name, so the numbers mean something.
    expect(layout.continuousLegend!.title).toBe('value');
  });

  it('continuous legend defaults to top position', () => {
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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

  it('categorical legend defaults to top and sits above the map area', () => {
    const layout = compileGeoMap(
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

    const legend = layout.categoricalLegend!;
    expect(legend.position).toBe('top');
    // The map area shifts down to make room for a top legend; the legend row
    // must land above it, not inside it (the old bottom-anchored legend
    // overlapped the map because the two disagreed about the layout).
    expect(legend.bounds.y + legend.bounds.height).toBeLessThanOrEqual(layout.area.y);
  });

  it('honors position: bottom for categorical legend', () => {
    const layout = compileGeoMap(
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
        legend: { position: 'bottom' },
      },
      DEFAULT_OPTIONS,
    );

    const legend = layout.categoricalLegend!;
    expect(legend.position).toBe('bottom');
    // Bottom legend starts at or below the map area's bottom edge.
    expect(legend.bounds.y).toBeGreaterThanOrEqual(layout.area.y + layout.area.height);
  });

  it('assigns neutral fill to features without data', () => {
    const layout = compileGeoMap(
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

  it('keys "No data" separately when a feature has no value, and not otherwise', () => {
    const withHoles = compileGeoMap(
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
    expect(withHoles.continuousLegend!.noData).toBeDefined();
    expect(withHoles.continuousLegend!.noData!.label).toBe('No data');
    // The swatch carries the same neutral the unmatched features do.
    const unmatched = withHoles.features.find((f) => f.id === '48');
    expect(withHoles.continuousLegend!.noData!.fill).toBe(unmatched!.fill);

    const complete = compileGeoMap(
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
    expect(complete.continuousLegend!.noData).toBeUndefined();
  });

  it('fills features from the same class scale the legend keys', () => {
    const data = Array.from({ length: 3 }, (_, i) => ({
      fips: ['06', '48', '36'][i],
      value: [12, 47, 33][i],
    }));
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data,
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const legendColors = layout.continuousLegend!.bins.map((b) => b.color);
    for (const feature of layout.features) {
      if (!feature.data) continue;
      expect(legendColors).toContain(feature.fill);
      // And the stamped class index points at that very swatch.
      expect(legendColors[feature.binIndex!]).toBe(feature.fill);
    }
  });

  it('infers the projection from the topology when the spec omits it', () => {
    const warnings: string[] = [];
    const usa = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO },
        data: [{ fips: '06', value: 10 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      { ...DEFAULT_OPTIONS, onWarn: (w: string) => warnings.push(w) },
    );
    // A continental-US span infers albersUsa, which drops nothing and warns
    // about nothing.
    expect(usa.features).toHaveLength(3);
    expect(warnings.some((w) => w.includes('identity'))).toBe(false);
  });

  it('infers identity for a pre-projected topology and says so', () => {
    const PRE_PROJECTED = {
      type: 'Topology',
      objects: {
        regions: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', id: 'A', properties: { name: 'A' }, arcs: [[0]] }],
        },
      },
      arcs: [
        [
          [0, 0],
          [400, 0],
          [400, 300],
          [0, 300],
          [0, 0],
        ],
      ],
    };
    const warnings: string[] = [];
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: PRE_PROJECTED },
        data: [{ id: 'A', value: 10 }],
        encoding: {
          key: { field: 'id', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      { ...DEFAULT_OPTIONS, onWarn: (w: string) => warnings.push(w) },
    );

    expect(layout.features).toHaveLength(1);
    expect(layout.warnings.some((w) => w.code === 'PROJECTION_INFERRED')).toBe(true);
    expect(warnings.some((w) => w.includes('identity'))).toBe(true);
  });

  it('emits warnings via onWarn callback', () => {
    const warnings: string[] = [];
    compileGeoMap(
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

    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const all = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator', focus: { points: true } },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: opts,
      },
      DEFAULT_OPTIONS,
    );
    const subset = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
    const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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

      // Features all take the theme's own lightest neutral, and no per-feature
      // stroke (the border meshes draw every line).
      const neutral = layout.theme.colors.neutral[100];
      for (const f of layout.features) {
        expect(f.fill).toBe(neutral);
        expect(f.stroke).toBe('none');
      }
    });

    it('generates point tooltips with point: prefix', () => {
      const layout = compileGeoMap(
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
      const layout = compileGeoMap(
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

    it('encoding.color legend: null suppresses the choropleth legend reserve (basemap-only)', () => {
      const base = {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [] as Array<Record<string, unknown>>,
        points: {
          data: [{ lat: 34, lon: -118, name: 'LA', v: 10 }],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'v', type: 'quantitative' },
          key: { field: 'name', type: 'nominal' },
        },
        theme: { spacing: { padding: 0 } },
      };
      const withLegendNull = compileGeoMap(
        {
          ...base,
          encoding: {
            key: { field: 'id', type: 'nominal' },
            color: { field: 'id', type: 'nominal', legend: null },
          },
        },
        DEFAULT_OPTIONS,
      );
      const withoutLegendNull = compileGeoMap(
        {
          ...base,
          encoding: {
            key: { field: 'id', type: 'nominal' },
            color: { field: 'id', type: 'nominal' },
          },
        },
        DEFAULT_OPTIONS,
      );

      // legend: null frees the phantom choropleth swatch row, so the map
      // area is taller than the spec that reserves it.
      expect(withLegendNull.categoricalLegend).toBeNull();
      expect(withLegendNull.area.height).toBeGreaterThan(withoutLegendNull.area.height);
    });

    it("legend position 'top-left' overlays the point legend inside the map area", () => {
      const spec = {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [] as Array<Record<string, unknown>>,
        encoding: {
          key: { field: 'id', type: 'nominal' },
          color: { field: 'id', type: 'nominal', legend: null },
        },
        points: {
          data: [
            { lat: 34, lon: -118, name: 'LA', v: 10 },
            { lat: 40.7, lon: -74, name: 'NYC', v: 90 },
          ],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'v', type: 'quantitative' },
          key: { field: 'name', type: 'nominal' },
        },
        theme: { spacing: { padding: 0 } },
        watermark: false,
      };
      const overlay = compileGeoMap(
        { ...spec, legend: { show: true, position: 'top-left' } },
        DEFAULT_OPTIONS,
      );
      const bottom = compileGeoMap({ ...spec, legend: { show: true } }, DEFAULT_OPTIONS);

      // Overlay reserves no figure height: map area fills the full frame.
      expect(overlay.area.height).toBeGreaterThan(bottom.area.height);
      expect(overlay.area.height).toBe(DEFAULT_OPTIONS.height);

      // Legend floats inside the map area's top-left corner, inset from the
      // edges, and is marked as an overlay for the renderer's backdrop.
      const legend = overlay.pointContinuousLegend!;
      expect(legend.position).toBe('top-left');
      expect(legend.bounds.x).toBeGreaterThan(overlay.area.x);
      expect(legend.bounds.y).toBeGreaterThan(overlay.area.y);
      expect(legend.bounds.y + legend.bounds.height).toBeLessThan(
        overlay.area.y + overlay.area.height,
      );

      // Default (no position) keeps the bottom-row placement.
      expect(bottom.pointContinuousLegend!.position).toBe('bottom');
      expect(bottom.pointContinuousLegend!.bounds.y).toBeGreaterThan(
        overlay.pointContinuousLegend!.bounds.y,
      );
    });

    it("legend position 'top-left' overlays a categorical point legend too", () => {
      const layout = compileGeoMap(
        {
          type: 'map',
          geo: { features: MINI_TOPO, projection: 'mercator' },
          data: [],
          encoding: {
            key: { field: 'id', type: 'nominal' },
            color: { field: 'id', type: 'nominal', legend: null },
          },
          points: {
            data: [
              { lat: 34, lon: -118, name: 'LA', cat: 'x' },
              { lat: 40.7, lon: -74, name: 'NYC', cat: 'y' },
            ],
            longitude: { field: 'lon', type: 'quantitative' },
            latitude: { field: 'lat', type: 'quantitative' },
            color: { field: 'cat', type: 'nominal' },
            key: { field: 'name', type: 'nominal' },
          },
          legend: { show: true, position: 'top-left' },
          theme: { spacing: { padding: 0 } },
          watermark: false,
        },
        DEFAULT_OPTIONS,
      );

      expect(layout.area.height).toBe(DEFAULT_OPTIONS.height);
      const legend = layout.pointCategoricalLegend!;
      expect(legend.position).toBe('top-left');
      expect(legend.bounds.x).toBeGreaterThan(layout.area.x);
      expect(legend.bounds.y).toBeGreaterThan(layout.area.y);
    });
  });

  describe('chromeLayout', () => {
    const chromeMapSpec = {
      type: 'map' as const,
      geo: { features: MINI_TOPO, projection: 'mercator' as const },
      data: [
        { fips: '06', value: 10 },
        { fips: '48', value: 20 },
        { fips: '36', value: 30 },
      ],
      encoding: {
        key: { field: 'fips', type: 'nominal' as const },
        color: { field: 'value', type: 'quantitative' as const },
      },
      chrome: {
        title:
          'A long map headline that wraps to several lines on a narrow container and adds real chrome height above the map',
        subtitle: 'A supporting subtitle that also occupies chrome vertical space here',
      },
    };
    const narrowOptions = { width: 340, height: 500 };

    it('grows the SVG by the chrome height in grow mode', () => {
      const subtract = compileGeoMap({ ...chromeMapSpec, chromeLayout: 'subtract' }, narrowOptions);
      const grow = compileGeoMap({ ...chromeMapSpec, chromeLayout: 'grow' }, narrowOptions);

      const chromeHeight = subtract.chrome.topHeight + subtract.chrome.bottomHeight;
      expect(chromeHeight).toBeGreaterThan(0);
      expect(grow.height).toBe(subtract.height + chromeHeight);
    });

    it('defaults to subtract (no growth) when chromeLayout is omitted', () => {
      const omitted = compileGeoMap(chromeMapSpec, narrowOptions);
      const explicit = compileGeoMap({ ...chromeMapSpec, chromeLayout: 'subtract' }, narrowOptions);
      expect(omitted.height).toBe(explicit.height);
    });
  });
});
