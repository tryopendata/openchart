import type { ColumnConfig, ResolvedTheme } from '@opendata-ai/core';
import { adaptTheme, contrastRatio, resolveTheme } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { computeCategoryColors } from '../category-colors';

function getTheme(dark = false): ResolvedTheme {
  const theme = resolveTheme();
  return dark ? adaptTheme(theme) : theme;
}

describe('computeCategoryColors', () => {
  const data = [
    { status: 'active' },
    { status: 'inactive' },
    { status: 'active' },
    { status: 'pending' },
  ];

  it('applies explicit color mapping correctly', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: '#ff0000',
      },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    expect(colors.size).toBe(4);
    // "active" rows (indices 0, 2) should have green background
    expect(colors.get(0)!.backgroundColor).toBe('#00ff00');
    expect(colors.get(2)!.backgroundColor).toBe('#00ff00');
    // "inactive" row (index 1) should have red background
    expect(colors.get(1)!.backgroundColor).toBe('#ff0000');
  });

  it('unmapped values get palette colors', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
      },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    // "inactive" and "pending" are not in the explicit map, should get palette colors
    const inactiveBg = colors.get(1)!.backgroundColor!;
    const pendingBg = colors.get(3)!.backgroundColor!;

    // They should be assigned from the categorical palette
    expect(inactiveBg).toBeTruthy();
    expect(pendingBg).toBeTruthy();
    // They should not be the explicit mapped color
    expect(inactiveBg).not.toBe('#00ff00');
  });

  it('same category value gets consistent colors', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: { active: '#00ff00' },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    // Both "active" rows should have the same color
    expect(colors.get(0)!.backgroundColor).toBe(colors.get(2)!.backgroundColor);
  });

  it('text contrast meets AA (at least 3:1)', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: '#ff0000',
        pending: '#0000ff',
      },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    for (const [, style] of colors) {
      const bg = style.backgroundColor!;
      const fg = style.color!;
      const ratio = contrastRatio(fg, bg);
      // accessibleTextColor picks black or white; both should exceed 3:1
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('dark mode adapts colors', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: '#ff0000',
      },
    };
    const lightTheme = getTheme(false);
    const darkTheme = getTheme(true);

    const lightColors = computeCategoryColors(data, col, lightTheme, false);
    const darkColors = computeCategoryColors(data, col, darkTheme, true);

    expect(lightColors.size).toBe(darkColors.size);

    // Dark mode colors should be adapted (different from light mode)
    const lightBg = lightColors.get(0)!.backgroundColor;
    const darkBg = darkColors.get(0)!.backgroundColor;
    expect(darkBg).not.toBe(lightBg);
  });

  it('dark mode text contrast still meets AA', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: '#ff0000',
      },
    };
    const theme = getTheme(true);
    const colors = computeCategoryColors(data, col, theme, true);

    for (const [, style] of colors) {
      const bg = style.backgroundColor!;
      const fg = style.color!;
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns empty map when no categoryColors config', () => {
    const col: ColumnConfig = { key: 'status' };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);
    expect(colors.size).toBe(0);
  });

  it('skips null values', () => {
    const dataWithNull = [{ status: 'active' }, { status: null }, { status: 'inactive' }];
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: { active: '#00ff00', inactive: '#ff0000' },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(dataWithNull, col, theme, false);

    // null row (index 1) should not be included
    expect(colors.has(1)).toBe(false);
    expect(colors.size).toBe(2);
  });
});
