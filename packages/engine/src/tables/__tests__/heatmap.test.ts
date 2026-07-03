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

    // Domain-minimum row (value=0) is skipped so the normal row
    // background shows through instead of an opaque low-end color.
    expect(colors.size).toBe(4);
    expect(colors.has(0)).toBe(false);

    const lowBg = colors.get(1)!.backgroundColor!;
    const highBg = colors.get(4)!.backgroundColor!;

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

    // value=0 sits at the domain minimum and is skipped
    expect(colors.size).toBe(4);
  });

  it('values outside custom domain are clamped', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: 'blue', domain: [25, 75] },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);

    // value=0 clamps to domain[0]=25, which is the minimum, so it's skipped
    expect(colors.has(0)).toBe(false);
    // value=100 clamps to domain max and gets colored
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

    // score=10 is the domain minimum and is skipped; only score=90 gets colored
    expect(colors.size).toBe(1);
    expect(colors.has(1)).toBe(true);
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

    // Domain-minimum row skipped
    expect(colors.size).toBe(4);
    for (const [, style] of colors) {
      const bg = style.backgroundColor!;
      const fg = style.color!;
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('custom palette arrays are adapted for dark mode', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: ['#fca5a5', '#c44e52'], domain: [0, 100] },
    };
    const lightTheme = getTheme(false);
    const darkTheme = getTheme(true);
    const lightColors = computeHeatmapColors(data, col, lightTheme, false);
    const darkColors = computeHeatmapColors(data, col, darkTheme, true);

    // Domain-minimum row (value=0) is skipped in both modes
    expect(lightColors.has(0)).toBe(false);
    expect(darkColors.has(0)).toBe(false);

    // The high-end color gets adapted for dark mode
    const lightHighBg = lightColors.get(4)!.backgroundColor!;
    const darkHighBg = darkColors.get(4)!.backgroundColor!;
    expect(darkHighBg).not.toBe(lightHighBg);
  });

  it('supports array of color stops as palette', () => {
    const col: ColumnConfig = {
      key: 'value',
      heatmap: { palette: ['#ffffff', '#ff0000'] },
    };
    const theme = getTheme();
    const colors = computeHeatmapColors(data, col, theme, false);
    // Domain-minimum row skipped
    expect(colors.size).toBe(4);
  });
});
