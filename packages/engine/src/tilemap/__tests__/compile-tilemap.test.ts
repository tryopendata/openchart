import { describe, expect, it } from 'vitest';
import { compileTileMap } from '../../compile';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const basicSpec = {
  type: 'tilemap' as const,
  data: { CA: 5.4, TX: 4.1, NY: 4.5, FL: 3.3, IL: 4.6 } as Record<string, number>,
};

const fullSpec = {
  type: 'tilemap' as const,
  data: {
    AL: 2.7,
    AK: 6.4,
    AZ: 3.5,
    AR: 3.4,
    CA: 5.4,
    CO: 3.4,
    CT: 4.1,
    DE: 4.4,
    FL: 3.3,
    GA: 3.4,
    HI: 3.2,
    ID: 3.0,
    IL: 4.6,
    IN: 3.3,
    IA: 2.7,
    KS: 3.2,
    KY: 4.4,
    LA: 3.6,
    ME: 3.6,
    MD: 1.8,
    MA: 3.3,
    MI: 4.2,
    MN: 2.8,
    MS: 3.7,
    MO: 3.5,
    MT: 2.9,
    NE: 2.2,
    NV: 5.4,
    NH: 2.4,
    NJ: 4.8,
    NM: 4.1,
    NY: 4.5,
    NC: 3.5,
    ND: 1.9,
    OH: 4.0,
    OK: 3.9,
    OR: 4.2,
    PA: 3.4,
    RI: 3.8,
    SC: 3.3,
    SD: 2.0,
    TN: 3.5,
    TX: 4.1,
    UT: 2.9,
    VT: 2.3,
    VA: 2.9,
    WA: 4.6,
    WV: 4.0,
    WI: 2.9,
    WY: 3.2,
    DC: 5.2,
  } as Record<string, number>,
};

const defaultOptions = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileTileMap', () => {
  it('always renders all 51 state tiles', () => {
    const result = compileTileMap(basicSpec, defaultOptions);
    expect(result.tiles).toHaveLength(51);
  });

  it('marks data-bearing states as hasData: true', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    const caTile = result.tiles.find((t) => t.stateCode === 'CA')!;
    expect(caTile.hasData).toBe(true);
    expect(caTile.value).toBe(5.4);

    const dataTiles = result.tiles.filter((t) => t.hasData);
    expect(dataTiles).toHaveLength(5);
    const codes = dataTiles.map((t) => t.stateCode).sort();
    expect(codes).toEqual(['CA', 'FL', 'IL', 'NY', 'TX']);
  });

  it('marks missing states as hasData: false with neutral fill', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    const akTile = result.tiles.find((t) => t.stateCode === 'AK')!;
    expect(akTile).toBeDefined();
    expect(akTile.hasData).toBe(false);
    expect(akTile.value).toBeNull();
    expect(akTile.formattedValue).toBe('–');
  });

  it('all tiles have valid position and size (x >= 0, y >= 0, size > 0)', () => {
    const result = compileTileMap(fullSpec, defaultOptions);

    for (const tile of result.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.size).toBeGreaterThan(0);
    }
  });

  it('data tiles use opacity-based encoding with a single base color', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    const dataTiles = result.tiles.filter((t) => t.hasData);
    for (const tile of dataTiles) {
      expect(tile.fill).toBeTruthy();
      expect(typeof tile.fill).toBe('string');
    }

    const fills = new Set(dataTiles.map((t) => t.fill));
    expect(fills.size).toBe(1);

    const opacities = new Set(dataTiles.map((t) => t.fillOpacity));
    expect(opacities.size).toBeGreaterThan(1);
  });

  it('compiles tabular DataRow[] data with encoding', () => {
    const spec = {
      type: 'tilemap' as const,
      data: [
        { code: 'CA', rate: 5.4 },
        { code: 'TX', rate: 4.1 },
        { code: 'NY', rate: 4.5 },
      ],
      encoding: {
        state: { field: 'code', type: 'nominal' as const },
        value: { field: 'rate', type: 'quantitative' as const },
      },
    };

    const result = compileTileMap(spec, defaultOptions);

    expect(result.tiles).toHaveLength(51);
    const dataTiles = result.tiles.filter((t) => t.hasData);
    expect(dataTiles).toHaveLength(3);
    const codes = dataTiles.map((t) => t.stateCode).sort();
    expect(codes).toEqual(['CA', 'NY', 'TX']);
  });

  it('handles null values in record-map data as missing', () => {
    const spec = {
      type: 'tilemap' as const,
      data: { CA: 5.4, TX: null, NY: 4.5 } as Record<string, number | null>,
    };

    const result = compileTileMap(spec, defaultOptions);

    const caTile = result.tiles.find((t) => t.stateCode === 'CA')!;
    expect(caTile.hasData).toBe(true);

    const txTile = result.tiles.find((t) => t.stateCode === 'TX')!;
    expect(txTile.hasData).toBe(false);
    expect(txTile.value).toBeNull();
  });

  describe('gradient legend', () => {
    it('has correct min/max labels', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.gradientLegend).not.toBeNull();
      expect(result.gradientLegend!.minLabel).toBeTruthy();
      expect(result.gradientLegend!.maxLabel).toBeTruthy();
      expect(Number(result.gradientLegend!.minLabel)).toBeLessThan(
        Number(result.gradientLegend!.maxLabel),
      );
    });

    it('has colorStops', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.gradientLegend!.colorStops.length).toBeGreaterThan(0);
      for (const stop of result.gradientLegend!.colorStops) {
        expect(stop.offset).toBeGreaterThanOrEqual(0);
        expect(stop.offset).toBeLessThanOrEqual(1);
        expect(stop.color).toBeTruthy();
      }
    });

    it('is null when legend.show is false', () => {
      const spec = { ...basicSpec, legend: { show: false } };
      const result = compileTileMap(spec, defaultOptions);

      expect(result.gradientLegend).toBeNull();
    });
  });

  describe('valueFormat', () => {
    it('applies to tile formattedValue', () => {
      const spec = { ...basicSpec, valueFormat: '.1f' };
      const result = compileTileMap(spec, defaultOptions);

      const caTile = result.tiles.find((t) => t.stateCode === 'CA');
      expect(caTile).toBeDefined();
      expect(caTile!.formattedValue).toBe('5.4');
    });
  });

  describe('dark mode', () => {
    it('reverses palette direction compared to light mode', () => {
      const lightResult = compileTileMap(basicSpec, defaultOptions);
      const darkResult = compileTileMap(basicSpec, { ...defaultOptions, darkMode: true });

      const lightFL = lightResult.tiles.find((t) => t.stateCode === 'FL');
      const darkFL = darkResult.tiles.find((t) => t.stateCode === 'FL');
      expect(lightFL!.fill).not.toBe(darkFL!.fill);
    });
  });

  describe('chrome', () => {
    it('resolves title and subtitle', () => {
      const spec = {
        ...basicSpec,
        chrome: {
          title: 'Test Title',
          subtitle: 'Test Subtitle',
        },
      };
      const result = compileTileMap(spec, defaultOptions);

      expect(result.chrome.title).toBeDefined();
      expect(result.chrome.title!.text).toBe('Test Title');
      expect(result.chrome.subtitle).toBeDefined();
      expect(result.chrome.subtitle!.text).toBe('Test Subtitle');
    });
  });

  describe('tooltip descriptors', () => {
    it('contains entries for all tiles', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.tooltipDescriptors.has('CA')).toBe(true);
      expect(result.tooltipDescriptors.has('TX')).toBe(true);
      expect(result.tooltipDescriptors.size).toBe(51);
    });

    it('tooltip has title and value field', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      const tooltip = result.tooltipDescriptors.get('CA')!;
      expect(tooltip.title).toBe('California');
      expect(tooltip.fields.length).toBeGreaterThan(0);
      expect(tooltip.fields.some((f) => f.label === 'Value')).toBe(true);
    });
  });

  describe('a11y', () => {
    it('generates descriptive alt text', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.a11y.altText).toContain('Tile map');
      expect(result.a11y.altText).toContain('US states');
    });

    it('has a data table fallback', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.a11y.dataTableFallback.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('throws on non-tilemap spec', () => {
      const chartSpec = {
        mark: 'bar' as const,
        data: [{ x: 1, y: 2 }],
        encoding: {
          x: { field: 'x', type: 'quantitative' as const },
          y: { field: 'y', type: 'quantitative' as const },
        },
      };

      expect(() => compileTileMap(chartSpec, defaultOptions)).toThrow(/non-tilemap/);
    });

    it('throws on empty record-map data', () => {
      const spec = {
        type: 'tilemap' as const,
        data: {} as Record<string, number>,
      };

      expect(() => compileTileMap(spec, defaultOptions)).toThrow();
    });
  });

  describe('dimensions', () => {
    it('width matches compile options, height fits content', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.width).toBe(600);
      expect(result.height).toBeGreaterThan(0);
      expect(result.height).toBeLessThanOrEqual(400);
    });

    it('works with different container sizes', () => {
      const result = compileTileMap(basicSpec, { width: 800, height: 600 });

      expect(result.width).toBe(800);
      expect(result.height).toBeGreaterThan(0);
      expect(result.height).toBeLessThanOrEqual(600);
    });
  });

  describe('palette', () => {
    it('uses the specified palette (data tiles differ between palettes)', () => {
      const blueResult = compileTileMap(basicSpec, defaultOptions);
      const greenResult = compileTileMap({ ...basicSpec, palette: 'green' }, defaultOptions);

      const blueCa = blueResult.tiles.find((t) => t.stateCode === 'CA')!;
      const greenCa = greenResult.tiles.find((t) => t.stateCode === 'CA')!;
      expect(blueCa.fill).not.toBe(greenCa.fill);
    });
  });

  // ---------------------------------------------------------------------------
  // Categorical mode
  // ---------------------------------------------------------------------------

  describe('categorical mode', () => {
    const categoricalRecordSpec = {
      type: 'tilemap' as const,
      data: {
        CA: 'medical_only',
        TX: 'philosophical',
        NY: 'religious',
        FL: 'medical_only',
        WA: 'philosophical',
      } as Record<string, string>,
      colors: {
        medical_only: '#ee4a73',
        religious: '#e07d00',
        philosophical: '#06b6d4',
      },
    };

    const categoricalTabularSpec = {
      type: 'tilemap' as const,
      data: [
        { state_code: 'CA', exemption_category: 'medical_only' },
        { state_code: 'TX', exemption_category: 'philosophical' },
        { state_code: 'NY', exemption_category: 'religious' },
        { state_code: 'MS', exemption_category: 'medical_only' },
      ],
      encoding: {
        state: { field: 'state_code', type: 'nominal' as const },
        value: { field: 'exemption_category', type: 'nominal' as const },
        color: { field: 'exemption_category', type: 'nominal' as const },
      },
      colors: {
        medical_only: '#ee4a73',
        religious: '#e07d00',
        philosophical: '#06b6d4',
      },
    };

    it('renders 51 tiles with record-map string data', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);
      expect(result.tiles).toHaveLength(51);
    });

    it('assigns distinct fill colors per category', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      const caTile = result.tiles.find((t) => t.stateCode === 'CA')!;
      const txTile = result.tiles.find((t) => t.stateCode === 'TX')!;
      const nyTile = result.tiles.find((t) => t.stateCode === 'NY')!;
      const flTile = result.tiles.find((t) => t.stateCode === 'FL')!;

      expect(caTile.fill).toBe('#ee4a73');
      expect(txTile.fill).toBe('#06b6d4');
      expect(nyTile.fill).toBe('#e07d00');
      expect(flTile.fill).toBe('#ee4a73');
    });

    it('uses fillOpacity of 1 for all data tiles (no opacity encoding)', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);
      const dataTiles = result.tiles.filter((t) => t.hasData);
      for (const tile of dataTiles) {
        expect(tile.fillOpacity).toBe(1);
      }
    });

    it('produces categoricalLegend (not gradientLegend)', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      expect(result.gradientLegend).toBeNull();
      expect(result.categoricalLegend).not.toBeNull();
      expect(result.categoricalLegend!.type).toBe('categorical');
    });

    it('legend entries match categories in data order', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      const labels = result.categoricalLegend!.entries.map((e) => e.label);
      expect(labels).toEqual(['Medical Only', 'Philosophical', 'Religious']);
    });

    it('legend entry colors match the colors map', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      const entries = result.categoricalLegend!.entries;
      expect(entries.find((e) => e.label === 'Medical Only')!.color).toBe('#ee4a73');
      expect(entries.find((e) => e.label === 'Religious')!.color).toBe('#e07d00');
      expect(entries.find((e) => e.label === 'Philosophical')!.color).toBe('#06b6d4');
    });

    it('works with tabular data and explicit encoding', () => {
      const result = compileTileMap(categoricalTabularSpec, defaultOptions);

      const dataTiles = result.tiles.filter((t) => t.hasData);
      expect(dataTiles).toHaveLength(4);

      const caTile = result.tiles.find((t) => t.stateCode === 'CA')!;
      expect(caTile.fill).toBe('#ee4a73');
      expect(caTile.formattedValue).toBe('medical_only');
    });

    it('uses default categorical palette when no colors map provided', () => {
      const spec = {
        type: 'tilemap' as const,
        data: { CA: 'a', TX: 'b', NY: 'c' } as Record<string, string>,
      };
      const result = compileTileMap(spec, defaultOptions);

      const dataTiles = result.tiles.filter((t) => t.hasData);
      const fills = new Set(dataTiles.map((t) => t.fill));
      expect(fills.size).toBe(3);

      expect(result.categoricalLegend).not.toBeNull();
    });

    it('missing states get neutral fill in categorical mode', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      const akTile = result.tiles.find((t) => t.stateCode === 'AK')!;
      expect(akTile.hasData).toBe(false);
      expect(akTile.formattedValue).toBe('–');
    });

    it('a11y alt text lists categories', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      expect(result.a11y.altText).toContain('categories');
      expect(result.a11y.altText).toContain('Medical Only');
    });

    it('hides categorical legend when legend.show is false', () => {
      const spec = { ...categoricalRecordSpec, legend: { show: false } };
      const result = compileTileMap(spec, defaultOptions);

      expect(result.categoricalLegend).toBeNull();
    });

    it('stores category in tile.data', () => {
      const result = compileTileMap(categoricalRecordSpec, defaultOptions);

      const caTile = result.tiles.find((t) => t.stateCode === 'CA')!;
      expect(caTile.data.category).toBe('medical_only');
    });
  });
});
