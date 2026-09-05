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

  it('fonts.sizes overrides propagate to chrome element fontSizes', () => {
    const resolved = resolveTheme({
      fonts: { sizes: { title: 40, subtitle: 20, small: 16, axisTick: 16 } },
    });
    expect(resolved.chrome.title.fontSize).toBe(40);
    expect(resolved.chrome.subtitle.fontSize).toBe(20);
    expect(resolved.chrome.source.fontSize).toBe(16);
    expect(resolved.chrome.byline.fontSize).toBe(16);
    expect(resolved.chrome.footer.fontSize).toBe(16);
    expect(resolved.chrome.eyebrow.fontSize).toBe(DEFAULT_THEME.chrome.eyebrow.fontSize);
    expect(resolved.fonts.sizes.body).toBe(DEFAULT_THEME.fonts.sizes.body);
  });

  it('fonts.sizes partial override only changes specified sizes', () => {
    const resolved = resolveTheme({ fonts: { sizes: { title: 36 } } });
    expect(resolved.chrome.title.fontSize).toBe(36);
    expect(resolved.chrome.subtitle.fontSize).toBe(DEFAULT_THEME.chrome.subtitle.fontSize);
    expect(resolved.chrome.source.fontSize).toBe(DEFAULT_THEME.chrome.source.fontSize);
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

// ---------------------------------------------------------------------------
// TokenValue resolution
// ---------------------------------------------------------------------------

describe('resolveTheme TokenValue handling', () => {
  it('resolves plain string TokenValue to same string', () => {
    const resolved = resolveTheme({ colors: { background: '#faf8f5' } });
    expect(resolved.colors.background).toBe('#faf8f5');
  });

  it('resolves light/dark TokenValue pair to the light value', () => {
    const resolved = resolveTheme({
      colors: { background: { light: '#faf8f5', dark: '#1a1816' } },
    });
    expect(resolved.colors.background).toBe('#faf8f5');
  });

  it('stores token pairs on _tokenPairs for adaptTheme consumption', () => {
    const resolved = resolveTheme({
      colors: {
        background: { light: '#fff', dark: '#111' },
        text: { light: '#000', dark: '#eee' },
      },
    });
    expect(resolved._tokenPairs).toBeDefined();
    expect(resolved._tokenPairs?.['colors.background']).toEqual({ light: '#fff', dark: '#111' });
    expect(resolved._tokenPairs?.['colors.text']).toEqual({ light: '#000', dark: '#eee' });
  });

  it('does not create _tokenPairs when all colors are plain strings', () => {
    const resolved = resolveTheme({
      colors: { background: '#fff', text: '#000' },
    });
    expect(resolved._tokenPairs).toBeUndefined();
  });

  it('resolves TokenValue on semantic color fields', () => {
    const resolved = resolveTheme({
      colors: {
        positive: { light: '#10b981', dark: '#34d399' },
        negative: { light: '#e11d48', dark: '#fb7185' },
      },
    });
    expect(resolved.colors.positive).toBe('#10b981');
    expect(resolved.colors.negative).toBe('#e11d48');
    expect(resolved._tokenPairs?.['colors.positive']).toEqual({
      light: '#10b981',
      dark: '#34d399',
    });
    expect(resolved._tokenPairs?.['colors.negative']).toEqual({
      light: '#e11d48',
      dark: '#fb7185',
    });
  });
});

// ---------------------------------------------------------------------------
// New ThemeConfig fields
// ---------------------------------------------------------------------------

describe('resolveTheme widened ThemeConfig', () => {
  it('overrides fonts.weights partially', () => {
    const resolved = resolveTheme({
      fonts: { weights: { normal: 400, bold: 700 } },
    });
    expect(resolved.fonts.weights.normal).toBe(400);
    expect(resolved.fonts.weights.bold).toBe(700);
    expect(resolved.fonts.weights.medium).toBe(DEFAULT_THEME.fonts.weights.medium);
  });

  it('overrides new spacing fields', () => {
    const resolved = resolveTheme({
      spacing: { chromeToChart: 16, chartToFooter: 20, axisMargin: 8 },
    });
    expect(resolved.spacing.chromeToChart).toBe(16);
    expect(resolved.spacing.chartToFooter).toBe(20);
    expect(resolved.spacing.axisMargin).toBe(8);
    expect(resolved.spacing.padding).toBe(DEFAULT_THEME.spacing.padding);
  });

  it('overrides chrome typography with ChromeThemeOverride object', () => {
    const resolved = resolveTheme({
      chrome: {
        title: { fontWeight: 700, fontSize: 32, lineHeight: 1.1 },
      },
    });
    expect(resolved.chrome.title.fontWeight).toBe(700);
    expect(resolved.chrome.title.fontSize).toBe(32);
    expect(resolved.chrome.title.lineHeight).toBe(1.1);
    expect(resolved.chrome.subtitle.fontWeight).toBe(DEFAULT_THEME.chrome.subtitle.fontWeight);
  });

  it('ChromeThemeOverride color accepts TokenValue', () => {
    const resolved = resolveTheme({
      chrome: {
        title: { color: { light: '#111', dark: '#eee' }, fontWeight: 600 },
      },
    });
    expect(resolved.chrome.title.color).toBe('#111');
    expect(resolved.chrome.title.fontWeight).toBe(600);
    expect(resolved._tokenPairs?.['chrome.title.color']).toEqual({ light: '#111', dark: '#eee' });
  });

  it('passes seriesStrategy through to resolved theme', () => {
    const resolved = resolveTheme({ seriesStrategy: 'accent-neutral' });
    expect(resolved.seriesStrategy).toBe('accent-neutral');
  });

  it('defaults seriesStrategy to palette', () => {
    const resolved = resolveTheme();
    expect(resolved.seriesStrategy).toBe('palette');
  });
});

describe('categoricalFill', () => {
  it('mirrors a user palette when only `categorical` is given', () => {
    expect(resolveTheme({ colors: ['#111111', '#222222'] }).colors.categoricalFill).toEqual([
      '#111111',
      '#222222',
    ]);
    expect(resolveTheme({ colors: { categorical: ['#111111'] } }).colors.categoricalFill).toEqual([
      '#111111',
    ]);
  });

  it('keeps an explicit fill palette distinct from the stroke palette', () => {
    const theme = resolveTheme({
      colors: { categorical: ['#111111'], categoricalFill: ['#eeeeee'] },
    });
    expect(theme.colors.categorical).toEqual(['#111111']);
    expect(theme.colors.categoricalFill).toEqual(['#eeeeee']);
  });

  it('defaults to the built-in fill palette, which differs from the strokes', () => {
    const theme = resolveTheme();
    expect(theme.colors.categoricalFill).not.toEqual(theme.colors.categorical);
    expect(theme.colors.categoricalFill).toHaveLength(6);
  });
});
