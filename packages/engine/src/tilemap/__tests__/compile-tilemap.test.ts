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
  it('compiles record-map data correctly (all 51 states)', () => {
    const result = compileTileMap(fullSpec, defaultOptions);

    // 50 states + DC = 51 tiles
    expect(result.tiles).toHaveLength(51);
  });

  it('compiles a basic spec with 5 states', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    expect(result.tiles).toHaveLength(5);
    const codes = result.tiles.map((t) => t.stateCode).sort();
    expect(codes).toEqual(['CA', 'FL', 'IL', 'NY', 'TX']);
  });

  it('all tiles have valid position and size (x >= 0, y >= 0, size > 0)', () => {
    const result = compileTileMap(fullSpec, defaultOptions);

    for (const tile of result.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.size).toBeGreaterThan(0);
    }
  });

  it('tiles have fill colors from the sequential palette', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    for (const tile of result.tiles) {
      expect(tile.fill).toBeTruthy();
      expect(typeof tile.fill).toBe('string');
    }

    // Different values should produce different fill colors
    const fills = new Set(result.tiles.map((t) => t.fill));
    expect(fills.size).toBeGreaterThan(1);
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

    expect(result.tiles).toHaveLength(3);
    const codes = result.tiles.map((t) => t.stateCode).sort();
    expect(codes).toEqual(['CA', 'NY', 'TX']);
  });

  it('missing states produce no tiles (only provided states get tiles)', () => {
    const result = compileTileMap(basicSpec, defaultOptions);

    // Only 5 states in data, so only 5 tiles
    expect(result.tiles).toHaveLength(5);

    // Verify a state not in data has no tile
    const alaskaTile = result.tiles.find((t) => t.stateCode === 'AK');
    expect(alaskaTile).toBeUndefined();
  });

  describe('gradient legend', () => {
    it('has correct min/max labels', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.gradientLegend.minLabel).toBeTruthy();
      expect(result.gradientLegend.maxLabel).toBeTruthy();
      // Min value in data is FL: 3.3, max is IL: 4.6
      expect(Number(result.gradientLegend.minLabel)).toBeLessThan(
        Number(result.gradientLegend.maxLabel),
      );
    });

    it('has colorStops', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.gradientLegend.colorStops.length).toBeGreaterThan(0);
      for (const stop of result.gradientLegend.colorStops) {
        expect(stop.offset).toBeGreaterThanOrEqual(0);
        expect(stop.offset).toBeLessThanOrEqual(1);
        expect(stop.color).toBeTruthy();
      }
    });
  });

  describe('valueFormat', () => {
    it('applies to tile formattedValue', () => {
      const spec = { ...basicSpec, valueFormat: '.1f' };
      const result = compileTileMap(spec, defaultOptions);

      const caTile = result.tiles.find((t) => t.stateCode === 'CA');
      expect(caTile).toBeDefined();
      // 5.4 formatted with .1f should be "5.4"
      expect(caTile!.formattedValue).toBe('5.4');
    });
  });

  describe('dark mode', () => {
    it('reverses palette direction compared to light mode', () => {
      const lightResult = compileTileMap(basicSpec, defaultOptions);
      const darkResult = compileTileMap(basicSpec, { ...defaultOptions, darkMode: true });

      // The lightest value (FL: 3.3) should have a different fill in dark vs light mode
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
    it('contains entries for each state in the data', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.tooltipDescriptors.has('CA')).toBe(true);
      expect(result.tooltipDescriptors.has('TX')).toBe(true);
      expect(result.tooltipDescriptors.has('NY')).toBe(true);
      expect(result.tooltipDescriptors.has('FL')).toBe(true);
      expect(result.tooltipDescriptors.has('IL')).toBe(true);
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
    it('reflects the compile options', () => {
      const result = compileTileMap(basicSpec, defaultOptions);

      expect(result.width).toBe(600);
      expect(result.height).toBe(400);
    });

    it('works with different container sizes', () => {
      const result = compileTileMap(basicSpec, { width: 800, height: 600 });

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('palette', () => {
    it('uses the specified palette', () => {
      const blueResult = compileTileMap(basicSpec, defaultOptions);
      const greenResult = compileTileMap({ ...basicSpec, palette: 'green' }, defaultOptions);

      // Different palettes should produce different fill colors
      const blueFill = blueResult.tiles[0].fill;
      const greenFill = greenResult.tiles[0].fill;
      expect(blueFill).not.toBe(greenFill);
    });
  });
});
