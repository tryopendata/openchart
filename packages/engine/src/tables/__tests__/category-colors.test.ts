import type { ColumnConfig, ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptTheme, contrastRatio, resolveTheme } from '@opendata-ai/openchart-core';
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

    expect(colors.size).toBe(3);
    // "active" rows (indices 0, 2) carry green as the chip accent
    expect(colors.get(0)!.accent).toBe('#00ff00');
    expect(colors.get(2)!.accent).toBe('#00ff00');
    // "inactive" row (index 1) carries red
    expect(colors.get(1)!.accent).toBe('#ff0000');
    // "pending" (index 3) is not in the explicit map, should be skipped
    expect(colors.has(3)).toBe(false);
  });

  it('unmapped values are skipped by default', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
      },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    // Only "active" rows (indices 0, 2) should be colored
    expect(colors.size).toBe(2);
    expect(colors.get(0)!.accent).toBe('#00ff00');
    expect(colors.get(2)!.accent).toBe('#00ff00');
    // Unmapped values should not have entries
    expect(colors.has(1)).toBe(false); // inactive
    expect(colors.has(3)).toBe(false); // pending
  });

  it('autoAssign: true assigns palette colors to unmapped values', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
      },
      autoAssign: true,
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    // All 4 rows should be colored
    expect(colors.size).toBe(4);
    // "inactive" and "pending" should get palette colors (not the explicit green)
    const inactiveBg = colors.get(1)!.accent!;
    const pendingBg = colors.get(3)!.accent!;
    expect(inactiveBg).toBeTruthy();
    expect(pendingBg).toBeTruthy();
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

  it('chip background is a tint of the surface, not the raw color', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: { active: '#00ff00' },
    };
    const colors = computeCategoryColors(data, col, getTheme(), false);
    const style = colors.get(0)!;
    expect(style.backgroundColor).not.toBe('#00ff00');
    // A 14% tint on white stays close to white.
    expect(contrastRatio(style.backgroundColor!, '#ffffff')).toBeLessThan(1.3);
  });

  it('text contrast meets AA (at least 4.5:1)', () => {
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
      // The ink is the category hue pushed to AA on its own tint.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark mode preserves explicit user-provided colors', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: '#ff0000',
      },
    };
    const darkTheme = getTheme(true);
    const colors = computeCategoryColors(data, col, darkTheme, true);

    // Explicit colors should NOT be adapted for dark mode
    expect(colors.get(0)!.accent).toBe('#00ff00');
    expect(colors.get(1)!.accent).toBe('#ff0000');
  });

  it('dark mode adapts auto-assigned palette colors but not explicit ones', () => {
    // Use a bright yellow that will definitely get adapted in dark mode
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#ffff00',
      },
      autoAssign: true,
    };
    const darkTheme = getTheme(true);
    const darkColors = computeCategoryColors(data, col, darkTheme, true);

    // Explicit color should be preserved as-is (not adapted)
    expect(darkColors.get(0)!.accent).toBe('#ffff00');

    // Auto-assigned palette colors should still be present (adaptation may or
    // may not visually change them, but the code path runs adaptColorForDarkMode)
    expect(darkColors.has(1)).toBe(true); // inactive
    expect(darkColors.has(3)).toBe(true); // pending
  });

  it('autoAssign: true gives same value consistent color across rows', () => {
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {},
      autoAssign: true,
    };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);

    // Both "active" rows should get the same auto-assigned color
    expect(colors.get(0)!.accent).toBe(colors.get(2)!.accent);
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
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('returns empty map when no categoryColors config', () => {
    const col: ColumnConfig = { key: 'status' };
    const theme = getTheme();
    const colors = computeCategoryColors(data, col, theme, false);
    expect(colors.size).toBe(0);
  });

  it('skips transparent and none category colors', () => {
    const dataWithSpecial = [
      { status: 'active' },
      { status: 'inactive' },
      { status: 'pending' },
      { status: 'disabled' },
    ];
    const col: ColumnConfig = {
      key: 'status',
      categoryColors: {
        active: '#00ff00',
        inactive: 'transparent',
        pending: 'none',
        disabled: '#cccccc',
      },
    };
    const theme = getTheme();
    const colors = computeCategoryColors(dataWithSpecial, col, theme, false);

    // transparent and none rows should be skipped
    expect(colors.has(1)).toBe(false); // inactive = transparent
    expect(colors.has(2)).toBe(false); // pending = none
    // explicit colors should still be present
    expect(colors.get(0)!.accent).toBe('#00ff00');
    expect(colors.get(3)!.accent).toBe('#cccccc');
    expect(colors.size).toBe(2);
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
