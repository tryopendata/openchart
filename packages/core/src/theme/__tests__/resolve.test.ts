import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../defaults';
import { resolveTheme } from '../resolve';

describe('resolveTheme', () => {
  it('returns default theme when no overrides given', () => {
    const resolved = resolveTheme();
    expect(resolved.colors.background).toBe(DEFAULT_THEME.colors.background);
    expect(resolved.fonts.family).toBe(DEFAULT_THEME.fonts.family);
    expect(resolved.isDark).toBe(false);
  });

  it('deep merges color overrides without losing other color fields', () => {
    const resolved = resolveTheme({
      colors: { background: '#111111' },
    });
    expect(resolved.colors.background).toBe('#111111');
    // Other color fields preserved from defaults
    expect(resolved.colors.text).toBe(DEFAULT_THEME.colors.text);
    expect(resolved.colors.categorical).toEqual(DEFAULT_THEME.colors.categorical);
  });

  it('overrides font family', () => {
    const resolved = resolveTheme({
      fonts: { family: 'Helvetica' },
    });
    expect(resolved.fonts.family).toBe('Helvetica');
    // Mono should still be default
    expect(resolved.fonts.mono).toBe(DEFAULT_THEME.fonts.mono);
  });

  it('overrides spacing partially', () => {
    const resolved = resolveTheme({
      spacing: { padding: 24 },
    });
    expect(resolved.spacing.padding).toBe(24);
    expect(resolved.spacing.chromeGap).toBe(DEFAULT_THEME.spacing.chromeGap);
  });

  it('overrides border radius', () => {
    const resolved = resolveTheme({ borderRadius: 8 });
    expect(resolved.borderRadius).toBe(8);
  });

  it('overrides categorical palette completely', () => {
    const custom = ['#ff0000', '#00ff00', '#0000ff'];
    const resolved = resolveTheme({
      colors: { categorical: custom },
    });
    expect(resolved.colors.categorical).toEqual(custom);
  });

  it('accepts a custom base theme', () => {
    const customBase = {
      ...DEFAULT_THEME,
      borderRadius: 12,
    };
    const resolved = resolveTheme(undefined, customBase);
    expect(resolved.borderRadius).toBe(12);
  });

  it('accepts flat string[] as shorthand for categorical colors', () => {
    const colors = ['#ff0000', '#94a3b8', '#94a3b8'];
    const resolved = resolveTheme({ colors });
    expect(resolved.colors.categorical).toEqual(colors);
    // Other color fields preserved from defaults
    expect(resolved.colors.background).toBe(DEFAULT_THEME.colors.background);
    expect(resolved.colors.text).toBe(DEFAULT_THEME.colors.text);
  });

  it('flat color array does not clobber non-color theme fields', () => {
    const resolved = resolveTheme({ colors: ['#ff0000'] });
    expect(resolved.fonts.family).toBe(DEFAULT_THEME.fonts.family);
    expect(resolved.spacing.padding).toBe(DEFAULT_THEME.spacing.padding);
  });
});
