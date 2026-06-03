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

  it('overrides a chrome element color, preserving its size and weight', () => {
    const resolved = resolveTheme({ chrome: { subtitle: '#d0d6e0' } });
    expect(resolved.chrome.subtitle.color).toBe('#d0d6e0');
    // Non-color chrome fields come from the typography scale, untouched.
    expect(resolved.chrome.subtitle.fontSize).toBe(14);
    expect(resolved.chrome.subtitle.fontWeight).toBe(400);
    // Other chrome elements keep their defaults.
    expect(resolved.chrome.title.color).toBe('#09090b');
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

// ---------------------------------------------------------------------------
// Deep merge behavior hardening
// ---------------------------------------------------------------------------

describe('resolveTheme deep merge edge cases', () => {
  it('replaces categorical array entirely, does not concatenate', () => {
    const custom = ['#aaa', '#bbb'];
    const resolved = resolveTheme({ colors: { categorical: custom } });
    expect(resolved.colors.categorical).toEqual(custom);
    expect(resolved.colors.categorical).toHaveLength(2);
  });

  it('skips undefined values, preserving defaults', () => {
    const resolved = resolveTheme({ borderRadius: undefined });
    expect(resolved.borderRadius).toBe(DEFAULT_THEME.borderRadius);
  });

  it('applies multiple overrides at different depths in one call', () => {
    const resolved = resolveTheme({
      colors: { background: '#222222', text: '#eeeeee' },
      fonts: { family: 'Georgia' },
      spacing: { padding: 32 },
      borderRadius: 4,
    });
    expect(resolved.colors.background).toBe('#222222');
    expect(resolved.colors.text).toBe('#eeeeee');
    expect(resolved.fonts.family).toBe('Georgia');
    expect(resolved.spacing.padding).toBe(32);
    expect(resolved.borderRadius).toBe(4);
    // Non-overridden values preserved
    expect(resolved.fonts.mono).toBe(DEFAULT_THEME.fonts.mono);
    expect(resolved.spacing.chromeGap).toBe(DEFAULT_THEME.spacing.chromeGap);
    expect(resolved.colors.categorical).toEqual(DEFAULT_THEME.colors.categorical);
  });

  it('empty object override returns defaults unchanged', () => {
    const resolved = resolveTheme({});
    expect(resolved.colors).toEqual(expect.objectContaining(DEFAULT_THEME.colors));
    expect(resolved.fonts).toEqual(DEFAULT_THEME.fonts);
    expect(resolved.spacing).toEqual(DEFAULT_THEME.spacing);
    expect(resolved.borderRadius).toBe(DEFAULT_THEME.borderRadius);
  });

  it('dark background adapts chrome colors without losing chrome structure', () => {
    const resolved = resolveTheme({ colors: { background: '#111111', text: '#ffffff' } });
    expect(resolved.isDark).toBe(true);
    // Chrome structure should still be fully populated
    expect(resolved.chrome.title).toBeDefined();
    expect(resolved.chrome.subtitle).toBeDefined();
    expect(resolved.chrome.source).toBeDefined();
    expect(resolved.chrome.byline).toBeDefined();
    expect(resolved.chrome.footer).toBeDefined();
    // Title color should be adapted (not the light-mode default)
    expect(resolved.chrome.title.color).not.toBe(DEFAULT_THEME.chrome.title.color);
  });
});
