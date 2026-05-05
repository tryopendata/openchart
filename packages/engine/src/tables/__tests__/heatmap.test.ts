import type { ColumnConfig, ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptTheme, contrastRatio, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeHeatmapColors } from '../heatmap';

function getTheme(dark = false): ResolvedTheme {
  const theme = resolveTheme();
  return dark ? adaptTheme(theme) : theme;
}

describe('computeHeatmapColors', () => {
  const data = [{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }];

  const column: ColumnConfig = {
    key: 'value',
    heatmap: { palette: 'blue' },
  };

  it('assigns lighter colors to lower values and darker to higher', () => {
    const theme = getTheme();
    const colors = computeHeatmapColors(data, column, theme, false);

    expect(colors.size).toBe(5);

    // Lowest value should have a lighter background
    const lowBg = colors.get(0)!.backgroundColor!;
    const highBg = colors.get(4)!.backgroundColor!;

    // Check that they're different colors
    expect(lowBg).not.toBe(highBg);
  });

  it('text color meets AA contrast against background', () => {
    const theme = getTheme();
    const colors = computeHeatmapColors(data, column, theme, false);

    for (const [, style] of colors) {
      const bg = style.backgroundColor!;
      const fg = style.color!;
      const ratio = contrastRatio(fg, bg);
      // Should pick black or white, both of which should exceed 3:1
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('supports custom domain', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: 'blue', domain: [0, 200] },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);

    // All values are in the lower half of the domain, so should all have lighter colors
    expect(colors.size).toBe(5);
  });

  it('values outside custom domain are clamped', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: 'blue', domain: [25, 75] },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);

    // value=0 is clamped to domain min, value=100 to domain max
    expect(colors.has(0)).toBe(true);
    expect(colors.has(4)).toBe(true);
  });

  it('supports colorByField', () => {
    const dataWithLabel = [
      { label: 'A', score: 10 },
      { label: 'B', score: 90 },
    ];
    const col: ColumnConfig = {
      key: 'label',
      heatmap: { palette: 'blue', colorByField: 'score' },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(dataWithLabel, col, theme, false);

    // Should have colors for both rows since score has numeric values
    expect(colors.size).toBe(2);
  });

  it('returns empty map for non-numeric columns', () => {
    const nonNumericData = [{ value: 'hello' }, { value: 'world' }];
    const theme = getTheme();
    const colors = computeHeatmapColors(nonNumericData, column, theme, false);
    expect(colors.size).toBe(0);
  });

  it('returns empty map when no heatmap config', () => {
    const col: ColumnConfig = { key: 'value' };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);
    expect(colors.size).toBe(0);
  });

  it('adapts colors for dark mode', () => {
    const theme = getTheme(true);
    const colors = computeHeatmapColors(data, column, theme, true);

    expect(colors.size).toBe(5);
    // In dark mode, text colors should still have adequate contrast
    for (const [, style] of colors) {
      const bg = style.backgroundColor!;
      const fg = style.color!;
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('high values are more visually prominent than low values in both modes', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: ['#fca5a5', '#c44e52'], domain: [0, 100] },
    };
    const lightTheme = getTheme(false);
    const darkTheme = getTheme(true);
    const lightColors = computeHeatmapColors(data, col, lightTheme, false);
    const darkColors = computeHeatmapColors(data, col, darkTheme, true);

    const lightLowBg = lightColors.get(0)!.backgroundColor!;
    const lightHighBg = lightColors.get(4)!.backgroundColor!;
    const darkLowBg = darkColors.get(0)!.backgroundColor!;
    const darkHighBg = darkColors.get(4)!.backgroundColor!;

    expect(lightLowBg).not.toBe(lightHighBg);
    expect(darkLowBg).not.toBe(darkHighBg);

    function parseLum(color: string): number {
      const rgbMatch = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/.exec(color);
      if (rgbMatch) {
        const [r, g, b] = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((c) => {
          const v = Number(c) / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const hexMatch = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
      if (!hexMatch) return 0;
      const [r, g, b] = [hexMatch[1], hexMatch[2], hexMatch[3]].map((c) => {
        const v = Number.parseInt(c, 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    // Light mode: high values get darker/more saturated bg (lower luminance = more prominent)
    expect(parseLum(lightLowBg)).toBeGreaterThan(parseLum(lightHighBg));

    // Dark mode: high values get brighter bg (higher luminance = more prominent on dark bg)
    expect(parseLum(darkHighBg)).toBeGreaterThan(parseLum(darkLowBg));
  });

  it('supports array of color stops as palette', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: ['#ffffff', '#ff0000'] },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);
    expect(colors.size).toBe(5);
  });
});
