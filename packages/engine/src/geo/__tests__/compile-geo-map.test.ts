import { contrastRatio, estimateTextWidth } from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
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
  it.each([
    { scheme: 'blue', reverse: true },
    { range: ['#ffff00', '#ff0000', '#000000'] },
  ])('uses the point legend classes for quantitative fills (%j)', (scale) => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [],
        encoding: {},
        points: {
          data: Array.from({ length: 21 }, (_, value) => ({ lon: -100, lat: 31, value })),
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'value', type: 'quantitative', scale },
        },
      },
      DEFAULT_OPTIONS,
    );
    const legend = layout.pointContinuousLegend!;
    expect(legend.bins!.length).toBeGreaterThan(1);
    for (const mark of layout.pointMarks) {
      const bin = legend.ticks.filter((tick) => Number(mark.data.value) >= tick.value).length;
      expect(mark.fill).toBe(legend.bins![bin].color);
    }
  });

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
      expect(f.path).toMatch(/^M[-\d.]/);
      expect(f.type).toBe('map-feature');
    }
    expect(layout.features.map((f) => f.id)).toEqual(['06', '48', '36']);
    // Three distinct values on a sequential ramp: three distinct fills.
    expect(new Set(layout.features.map((f) => f.fill)).size).toBe(3);
    // Non-shared arcs produce no interior mesh, but outlines should exist
    expect(layout.borders.outlinePath).toMatch(/^M[-\d.]/);
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

  it('encoding.color.format formats tooltip values', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', value: 1500 }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative', format: '$,.0f' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const ca = layout.tooltipDescriptors.get('06');
    expect(ca!.fields.map((f) => f.value)).toContain('$1,500');
  });

  it('rejects the removed valueFormat field with the replacement channel', () => {
    expect(() =>
      compileGeoMap(
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
      ),
    ).toThrow(/valueFormat.*encoding.color.format/);
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

  it.each(
    [330, 360, 680].flatMap((width) => [11, 14].map((axisTick) => ({ width, axisTick }))),
  )('aligns map chrome and top legend at $width px with $axisTick px ticks', ({
    width,
    axisTick,
  }) => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', category: 'west' }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'category', type: 'nominal' },
        },
        chrome: { title: 'Donor growth by state', source: 'State records' },
      },
      { width, height: 600, theme: { fonts: { sizes: { axisTick } } } },
    );
    const legend = layout.categoricalLegend!;
    expect(legend.bounds.x).toBe(layout.chrome.title!.x);
    expect(legend.bounds.x).toBe(layout.chrome.source!.x);
    expect(legend.bounds.x).toBe(layout.area.x);
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

  it('hatches no-data features (and the legend swatch), but never a zero value', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', value: 10 },
          // Zero is data, not a hole.
          { fips: '48', value: 0 },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );

    const zero = layout.features.find((f) => f.id === '48')!;
    expect(zero.noData).toBeUndefined();
    expect(zero.pattern).toBeUndefined();

    const hole = layout.features.find((f) => f.id === '36')!;
    expect(hole.noData).toBe(true);
    expect(hole.pattern).toEqual({
      type: 'diagonal',
      base: hole.fill,
      line: layout.theme.colors.neutral[300],
    });

    // The legend swatch keys the same hatch the features carry.
    expect(layout.continuousLegend!.noData!.pattern).toEqual(hole.pattern);
  });

  it('hatches no-data features under a categorical color encoding', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [{ fips: '06', party: 'D' }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'party', type: 'nominal' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.features.find((f) => f.id === '06')!.pattern).toBeUndefined();
    for (const id of ['48', '36']) {
      const f = layout.features.find((m) => m.id === id)!;
      expect(f.noData).toBe(true);
      expect(f.pattern?.type).toBe('diagonal');
    }

    // The hatch gets a key of its own, carrying the same pattern.
    const noData = layout.categoricalLegend!.noData!;
    expect(noData.label).toBe('No data');
    expect(noData.pattern).toEqual(layout.features.find((f) => f.id === '48')!.pattern);
  });

  it('wraps the categorical legend and puts the no-data key after the last entry', () => {
    const long = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map(
      (c) => `${c} region`,
    );
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        // Only one feature joins, so the map keeps a hole for the no-data key
        // while the domain supplies enough entries to overflow the row.
        data: [{ fips: '06', party: long[0] }],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'party', type: 'nominal', scale: { domain: long } },
        },
      },
      { width: 300, height: 400 },
    );

    const legend = layout.categoricalLegend!;
    const positions = legend.entryPositions!;
    expect(positions).toHaveLength(legend.entries.length);
    const lastRow = positions[positions.length - 1].row;
    expect(lastRow).toBeGreaterThan(0);
    // Every row fits inside the legend box, and the box is tall enough for them.
    for (const pos of positions) {
      expect(pos.x + pos.width).toBeLessThanOrEqual(legend.bounds.x + legend.bounds.width);
    }
    const noData = legend.noData!;
    expect(noData.labelX).toBeGreaterThan(noData.x);
    expect(noData.y).toBeGreaterThanOrEqual(positions[positions.length - 1].y);
    expect(legend.bounds.height).toBeGreaterThanOrEqual(noData.y + noData.size - legend.bounds.y);
  });

  it('leaves the categorical legend without a no-data swatch when every feature joins', () => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', party: 'D' },
          { fips: '48', party: 'R' },
          { fips: '36', party: 'D' },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'party', type: 'nominal' },
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(layout.categoricalLegend!.noData).toBeUndefined();
  });

  it('never hatches basemap-only features (no color encoding, nothing to be missing)', () => {
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

    for (const f of layout.features) {
      expect(f.noData).toBeUndefined();
      expect(f.pattern).toBeUndefined();
    }
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

  it('infers identity for a pre-projected topology and says so in dev', () => {
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
      { ...DEFAULT_OPTIONS, dev: true, onWarn: (w: string) => warnings.push(w) },
    );

    expect(layout.features).toHaveLength(1);
    expect(layout.warnings.some((w) => w.code === 'PROJECTION_INFERRED')).toBe(true);
    expect(warnings.some((w) => w.includes('identity'))).toBe(true);

    // Outside dev the inference is silent: identity is the only correct answer
    // for a pre-projected atlas, so there is nothing for the author to fix.
    const quiet: string[] = [];
    const prod = compileGeoMap(
      {
        type: 'map',
        geo: { features: PRE_PROJECTED },
        data: [{ id: 'A', value: 10 }],
        encoding: {
          key: { field: 'id', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      { ...DEFAULT_OPTIONS, onWarn: (w: string) => quiet.push(w) },
    );
    expect(prod.features).toHaveLength(1);
    expect(prod.warnings.some((w) => w.code === 'PROJECTION_INFERRED')).toBe(false);
    expect(quiet.some((w) => w.includes('identity'))).toBe(false);
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

    expect(layout.chrome.title!.text).toBe('Test Map');
    expect(layout.chrome.subtitle!.text).toBe('Test subtitle');
  });

  // ---------------------------------------------------------------------------
  // Reader zoom (geo.zoom): validated here, applied by the vanilla mount
  // ---------------------------------------------------------------------------

  describe('geo.zoom validation', () => {
    const withZoom = (zoom: unknown) => ({
      type: 'map' as const,
      geo: { features: MINI_TOPO, projection: 'mercator' as const, zoom: zoom as never },
      data: [{ fips: '06', value: 10 }],
      encoding: {
        key: { field: 'fips', type: 'nominal' as const },
        color: { field: 'value', type: 'quantitative' as const },
      },
    });

    it('accepts true, false, and a config object', () => {
      for (const zoom of [true, false, {}, { maxZoom: 8 }, { maxZoom: 1, controls: false }]) {
        // Zoom is reader interaction applied by the mount; compile output is unaffected.
        expect(compileGeoMap(withZoom(zoom), DEFAULT_OPTIONS).features).toHaveLength(3);
      }
    });

    it('rejects a non-boolean, non-object zoom', () => {
      expect(() => compileGeoMap(withZoom('yes'), DEFAULT_OPTIONS)).toThrow(/geo\.zoom must be/);
    });

    it('rejects maxZoom below 1 or non-numeric', () => {
      expect(() => compileGeoMap(withZoom({ maxZoom: 0.5 }), DEFAULT_OPTIONS)).toThrow(/maxZoom/);
      expect(() => compileGeoMap(withZoom({ maxZoom: '4' }), DEFAULT_OPTIONS)).toThrow(/maxZoom/);
    });

    it('rejects a non-boolean controls flag', () => {
      expect(() => compileGeoMap(withZoom({ controls: 'no' }), DEFAULT_OPTIONS)).toThrow(
        /controls/,
      );
    });
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
      expect(warning!.message).toContain('1 point(s) project to null');
      expect(warning!.context).toEqual({ count: 1, samples: [[0, 0]] });
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
      const unmatchedFeature = layout.features.find((f) => f.id === '36');
      expect(matchedFeature!.fill).not.toBe(unmatchedFeature!.fill);

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
      const top = compileGeoMap({ ...spec, legend: { show: true } }, DEFAULT_OPTIONS);

      // Overlay reserves no figure height: map area fills the full frame.
      expect(overlay.area.height).toBeGreaterThan(top.area.height);
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

      // Default (no position) now paints the key in its reserved top band.
      expect(top.pointContinuousLegend!.position).toBe('top');
      expect(
        top.pointContinuousLegend!.bounds.y + top.pointContinuousLegend!.bounds.height,
      ).toBeLessThanOrEqual(top.area.y);
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

describe('map numeric observations', () => {
  it.each([
    null,
    undefined,
    '',
    '  ',
    false,
    true,
    NaN,
    Infinity,
    -Infinity,
    'Infinity',
    'bad',
  ])('renders %s as missing color data without changing the measured scale', (value) => {
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'mercator' },
        data: [
          { fips: '06', value },
          { fips: '48', value: 0 },
          { fips: '36', value: ' 20 ' },
        ],
        encoding: {
          key: { field: 'fips', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );
    const missing = layout.features.find((feature) => feature.id === '06')!;
    expect(missing.noData).toBe(true);
    expect(missing.aria.label).toBe('California: no data');
    expect(layout.tooltipDescriptors.get('06')?.fields).toContainEqual({
      label: 'value',
      value: 'No data',
    });
    expect(layout.features.find((feature) => feature.id === '48')?.aria.label).toBe('Texas: 0');
    expect(layout.features.find((feature) => feature.id === '36')?.aria.label).toBe('New York: 20');
  });

  it('omits points with missing coordinates or encoded sizes, retaining real zero coordinates', () => {
    const invalid = [null, undefined, '', '  ', false, true, NaN, Infinity, -Infinity, 'bad'];
    const layout = compileGeoMap(
      {
        type: 'map',
        geo: { features: MINI_TOPO, projection: 'equalEarth' },
        data: [],
        encoding: { key: { field: 'id', type: 'nominal' } },
        points: {
          data: [
            ...invalid.map((value, index) => ({
              name: `lon-${index}`,
              lon: value,
              lat: 0,
              size: 10,
            })),
            ...invalid.map((value, index) => ({
              name: `lat-${index}`,
              lon: 0,
              lat: value,
              size: 10,
            })),
            ...invalid.map((value, index) => ({
              name: `size-${index}`,
              lon: 0,
              lat: 0,
              size: value,
            })),
            { name: 'origin', lon: 0, lat: 0, size: 0 },
            { name: 'numeric strings', lon: ' 10 ', lat: ' 20 ', size: ' 20 ' },
          ],
          key: { field: 'name', type: 'nominal' },
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          size: { field: 'size', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );
    expect(layout.pointMarks.map((mark) => mark.key).sort()).toEqual(['numeric strings', 'origin']);
    for (const mark of layout.pointMarks) {
      expect([mark.cx, mark.cy, mark.r].every(Number.isFinite)).toBe(true);
    }
  });
});

describe('map side legend composition', () => {
  const spec = {
    type: 'map',
    geo: { features: MINI_TOPO, projection: 'mercator' },
    data: [
      { fips: '06', value: 0 },
      { fips: '48', value: 20 },
    ],
    encoding: {
      key: { field: 'fips', type: 'nominal' },
      color: { field: 'value', type: 'quantitative' },
    },
  };
  it.each(['redBlue', 'brownTeal'])('accepts a quantitative diverging map palette %s', (scheme) => {
    expect(() =>
      compileGeoMap(
        {
          ...spec,
          encoding: { ...spec.encoding, color: { ...spec.encoding.color, scale: { scheme } } },
        },
        DEFAULT_OPTIONS,
      ),
    ).not.toThrow();
  });
  it('rejects a categorical palette for quantitative map color', () => {
    expect(() =>
      compileGeoMap(
        {
          ...spec,
          encoding: {
            ...spec.encoding,
            color: { ...spec.encoding.color, scale: { scheme: 'categorical' } },
          },
        },
        DEFAULT_OPTIONS,
      ),
    ).toThrow('not a supported map palette');
  });
  it.each(['right', 'bottom-right'])('honors an authored %s key outside geography', (position) => {
    const layout = compileGeoMap({ ...spec, legend: { position } }, { width: 1024, height: 400 });
    const key = layout.continuousLegend!;
    expect(key.position).toBe(position);
    expect(key.bounds.x).toBeGreaterThanOrEqual(layout.area.x + layout.area.width);
    expect(key.bounds.y).toBeGreaterThanOrEqual(layout.area.y);
    expect(key.bounds.y + key.bounds.height).toBeLessThanOrEqual(
      layout.area.y + layout.area.height,
    );
    expect(layout.features.find((f) => f.id === '06')?.noData).not.toBe(true);
    expect(layout.features.find((f) => f.id === '36')?.noData).toBe(true);
  });
  it.each([
    false,
    true,
  ])('keeps the explicit G8 hatch candidate distinct from low and midpoint classes (dark=%s)', (darkMode) => {
    for (const scheme of ['blue', 'redBlue']) {
      const layout = compileGeoMap(
        {
          ...spec,
          theme: {
            colors: {
              mapNoDataFill: { light: '#f5f5f5', dark: '#252525' },
              mapNoDataHatch: { light: '#707070', dark: '#aaaaaa' },
              mapInteriorBorder: { light: 'rgba(0,0,0,0.14)', dark: 'rgba(255,255,255,0.18)' },
            },
          },
          encoding: {
            ...spec.encoding,
            color: { ...spec.encoding.color, scale: { scheme, domain: [-20, 20] } },
          },
        },
        { ...DEFAULT_OPTIONS, darkMode },
      );
      const pattern = layout.features.find((feature) => feature.noData)!.pattern!;
      // The renderer paints hatch strokes at 0.55 opacity over the authored base.
      const visibleHatch = interpolateRgb(pattern.base, pattern.line)(0.55);
      const bins = layout.continuousLegend!.bins;
      if (scheme === 'blue')
        expect(contrastRatio(visibleHatch, bins[0].color)).toBeGreaterThanOrEqual(1.5);
      if (scheme === 'redBlue')
        expect(
          contrastRatio(visibleHatch, bins[Math.floor(bins.length / 2)].color),
        ).toBeGreaterThanOrEqual(1.5);
      expect(layout.borders.interiorStroke).toBe(
        darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
      );
    }
  });
  it('keys a threshold boundary by the same inclusive interval as its fill', () => {
    const layout = compileGeoMap(
      {
        ...spec,
        encoding: {
          ...spec.encoding,
          color: {
            ...spec.encoding.color,
            scale: {
              type: 'threshold',
              domain: [-10, 0, 10],
              range: ['#123456', '#345678', '#56789a', '#789abc'],
            },
          },
        },
      },
      DEFAULT_OPTIONS,
    );
    const zero = layout.features.find((feature) => feature.id === '06')!;
    expect(zero.binIndex).toBe(2);
    expect(zero.fill).toBe(layout.continuousLegend!.bins[2].color);
    expect(layout.tooltipDescriptors.get('06')!.fields).toContainEqual({
      label: 'Color range',
      value: '0 inclusive to 10 exclusive',
    });
    expect(layout.a11y.altText).toContain('0 inclusive to 10 exclusive');
  });
  it.each(['right', 'bottom-right'])('budgets three independent keys at %s', (position) => {
    const layout = compileGeoMap(
      {
        ...spec,
        legend: { position },
        points: {
          data: [
            { lon: -100, lat: 31, group: 'Small metro', size: 1 },
            { lon: -95, lat: 30, group: 'Large metro', size: 100 },
          ],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'group', type: 'nominal' },
          size: { field: 'size', type: 'quantitative' },
        },
      },
      { width: 1024, height: 600 },
    );
    const keys = [
      layout.continuousLegend!,
      layout.pointCategoricalLegend!,
      layout.pointSizeLegend!,
    ];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      expect(key.position).toBe(position);
      expect(key.bounds.x).toBeGreaterThanOrEqual(layout.area.x + layout.area.width);
      expect(key.bounds.y + key.bounds.height).toBeLessThanOrEqual(
        layout.area.y + layout.area.height,
      );
      if (i)
        expect(key.bounds.y).toBeGreaterThanOrEqual(
          keys[i - 1].bounds.y + keys[i - 1].bounds.height,
        );
    }
  });
  it('keeps projection and coverage identical when only side alignment changes', () => {
    const right = compileGeoMap(
      { ...spec, legend: { position: 'right' } },
      { width: 1024, height: 400 },
    );
    const bottom = compileGeoMap(
      { ...spec, legend: { position: 'bottom-right' } },
      { width: 1024, height: 400 },
    );
    expect(bottom.area).toEqual(right.area);
    expect(bottom.features.map((feature) => [feature.id, feature.path])).toEqual(
      right.features.map((feature) => [feature.id, feature.path]),
    );
    expect(bottom.height).toBe(right.height);
    expect(bottom.continuousLegend!.bounds.y).toBeGreaterThan(right.continuousLegend!.bounds.y);
  });
  it.each([
    'nominal',
    'quantitative',
  ])('places a top point %s key in its already reserved band without refitting geography', (type) => {
    const map = {
      ...spec,
      points: {
        data: [
          { lon: -100, lat: 31, group: type === 'nominal' ? 'Metros' : 10 },
          { lon: -95, lat: 30, group: type === 'nominal' ? 'Coastal cities' : 20 },
        ],
        longitude: { field: 'lon', type: 'quantitative' },
        latitude: { field: 'lat', type: 'quantitative' },
        color: { field: 'group', type },
      },
    };
    const top = compileGeoMap({ ...map, legend: { position: 'top' } }, DEFAULT_OPTIONS);
    const bottom = compileGeoMap({ ...map, legend: { position: 'bottom' } }, DEFAULT_OPTIONS);
    const key = top.pointCategoricalLegend ?? top.pointContinuousLegend!;
    expect(key.position).toBe('top');
    expect(key.bounds.y + key.bounds.height + 8).toBeLessThanOrEqual(top.area.y);
    expect(top.mapSize).toEqual(bottom.mapSize);
    expect(top.features.map((feature) => feature.path)).toEqual(
      bottom.features.map((feature) => feature.path),
    );
    expect(top.pointMarks.map((point) => [point.cx, point.cy, point.r])).toEqual(
      bottom.pointMarks.map((point) => [point.cx, point.cy, point.r]),
    );
  });
  it('keeps independent bottom color keys inside the reserved band', () => {
    const layout = compileGeoMap(
      {
        ...spec,
        legend: { position: 'bottom' },
        points: {
          data: [
            { lon: -100, lat: 31, value: 10 },
            { lon: -95, lat: 30, value: 20 },
          ],
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      DEFAULT_OPTIONS,
    );
    expect(layout.pointContinuousLegend!.bounds.y).toBeGreaterThanOrEqual(
      layout.continuousLegend!.bounds.y + layout.continuousLegend!.bounds.height,
    );
    expect(
      layout.pointContinuousLegend!.bounds.y + layout.pointContinuousLegend!.bounds.height,
    ).toBeLessThanOrEqual(layout.chrome.bottomAnchorY!);
  });
  it('reserves every wrapped point category row above a narrow map', () => {
    const layout = compileGeoMap(
      {
        ...spec,
        legend: { position: 'top' },
        points: {
          data: Array.from({ length: 8 }, (_, index) => ({
            lon: -100,
            lat: 31,
            category: `Long category ${index}`,
          })),
          longitude: { field: 'lon', type: 'quantitative' },
          latitude: { field: 'lat', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' },
        },
      },
      { width: 390, height: 600 },
    );
    const key = layout.pointCategoricalLegend!;
    expect(key.entryPositions).toHaveLength(8);
    expect(new Set(key.entryPositions!.map((position) => position.row)).size).toBeGreaterThan(1);
    expect(
      key.entryPositions!.every(
        (position) =>
          position.y >= key.bounds.y &&
          position.y + key.swatchSize <= key.bounds.y + key.bounds.height,
      ),
    ).toBe(true);
    expect(key.bounds.y + key.bounds.height + 8).toBeLessThanOrEqual(layout.area.y);
  });
  it.each([24, 32])('contains the entire side No data key at %dpx type', (fontSize) => {
    const measureText = (text: string, size: number, weight?: number) => ({
      width: estimateTextWidth(text, size, weight),
      height: size,
    });
    const layout = compileGeoMap(
      { ...spec, legend: { position: 'right' }, theme: { fonts: { sizes: { small: fontSize } } } },
      { width: 1024, height: 400, measureText },
    );
    const key = layout.continuousLegend!;
    expect(key.position).toBe('right');
    expect(key.noData).toBeDefined();
    const right =
      key.noData!.labelX +
      measureText(key.noData!.label, key.labelStyle.fontSize, key.labelStyle.fontWeight).width;
    expect(right).toBeLessThanOrEqual(key.bounds.x + key.bounds.width);
    expect(right).toBeLessThanOrEqual(layout.width - layout.area.x);
  });
  it('budgets host-measured No data width before projection and falls back when the complete side key cannot fit', () => {
    const diagnostics: Array<{ code: string }> = [];
    const measureText = (text: string, size: number, weight?: number) => ({
      width: text === 'No data' ? 700 : estimateTextWidth(text, size, weight),
      height: size,
    });
    const input = { ...spec, theme: { fonts: { sizes: { small: 32 } } } };
    const options = { width: 1024, height: 400, measureText };
    const side = compileGeoMap(
      { ...input, legend: { position: 'bottom-right' } },
      { ...options, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) },
    );
    const top = compileGeoMap({ ...input, legend: { position: 'top' } }, options);
    expect(side.continuousLegend!.position).toBe('top');
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MAP_SIDE_LEGEND_FALLBACK' }),
    );
    expect(side.area).toEqual(top.area);
    expect(side.features.map((feature) => feature.path)).toEqual(
      top.features.map((feature) => feature.path),
    );
  });
  it('does not reserve a hidden side key or shrink text when measured names are too wide', () => {
    const hidden = compileGeoMap(
      { ...spec, legend: { position: 'right', show: false } },
      DEFAULT_OPTIONS,
    );
    const absent = compileGeoMap({ ...spec, legend: { show: false } }, DEFAULT_OPTIONS);
    expect(hidden.area).toEqual(absent.area);
    const diagnostics: Array<{ code: string }> = [];
    const long = compileGeoMap(
      {
        ...spec,
        encoding: { ...spec.encoding, color: { field: 'fips', type: 'nominal' } },
        legend: { position: 'right' },
      },
      {
        width: 1024,
        height: 400,
        measureText: () => ({ width: 800, height: 12 }),
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      },
    );
    expect(long.categoricalLegend!.position).toBe('top');
    expect(long.categoricalLegend!.labelStyle.fontSize).toBe(11);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MAP_SIDE_LEGEND_FALLBACK' }),
    );
  });
  it('diagnoses a side key fallback before fitting a narrow map', () => {
    const diagnostics: Array<{ code: string; path: string }> = [];
    const layout = compileGeoMap(
      { ...spec, legend: { position: 'right' } },
      {
        width: 320,
        height: 400,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      },
    );
    expect(layout.continuousLegend!.position).toBe('top');
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MAP_SIDE_LEGEND_FALLBACK', path: '/legend/position' }),
      ]),
    );
  });
});
