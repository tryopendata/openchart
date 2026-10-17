import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../dark-mode';
import { mergeThemeConfig } from '../merge';
import { broadsheet, clarity, terminal } from '../presets';
import { resolveTheme } from '../resolve';

describe('v9 authored theme contract', () => {
  it('merges nested authored layers without mutating either input', () => {
    const base = {
      colors: { background: { light: '#fff', dark: '#000' }, categorical: ['red'] },
      fonts: { sizes: { small: 15, title: 30 } },
    };
    const override = { colors: { background: 'beige' }, fonts: { sizes: { title: 24 } } };
    expect(mergeThemeConfig(base, override)).toEqual({
      colors: { background: 'beige', categorical: ['red'] },
      fonts: { sizes: { small: 15, title: 24 } },
    });
    expect(base.fonts.sizes.title).toBe(30);
    expect(override.fonts.sizes).toEqual({ title: 24 });
  });
  it('normalizes palette shorthand, replaces arrays and clears rules with null', () => {
    expect(
      mergeThemeConfig(
        { colors: { axis: 'red', categorical: ['red', 'blue'] } },
        { colors: ['green'] },
      )?.colors,
    ).toEqual({ axis: 'red', categorical: ['green'] });
    expect(resolveTheme(mergeThemeConfig(broadsheet, { rule: null })).rule).toBeNull();
    expect(resolveTheme(mergeThemeConfig(broadsheet, { rule: { width: 80 } })).rule).toMatchObject({
      width: 80,
      thickness: 3,
      color: '#e3120b',
    });
  });
  it('gives authored chrome size priority over general font sizes in every layer', () => {
    const theme = resolveTheme(
      mergeThemeConfig(
        { chrome: { title: { fontSize: 33 }, source: { fontSize: 16 } } },
        { fonts: { sizes: { title: 20, small: 10 } } },
      ),
    );
    expect(theme.chrome.title.fontSize).toBe(33);
    expect(theme.chrome.source.fontSize).toBe(16);
    expect(theme.chrome.footer.fontSize).toBe(10);
  });
  it('uses D12 typography and D19 ink without changing default background or axis', () => {
    const theme = resolveTheme();
    expect(theme.fonts.sizes).toMatchObject({ small: 12, axisTick: 12 });
    expect(theme.spacing).toMatchObject({ chromeToChart: 16, chartToFooter: 12 });
    expect(theme.chrome.byline.fontSize).toBe(12);
    expect(theme.colors).toMatchObject({
      background: 'transparent',
      axis: '#71717a',
      annotationRule: '#888888',
      annotationRangeFill: '#f0c040',
    });
    expect(adaptTheme(theme).colors.annotationRule).toBe('#9ca3af');
    expect(clarity.fonts).toBeUndefined();
    expect(clarity.spacing).toBeUndefined();
  });
  it('derives marker and plate colors from the actual surface and preserves explicit colors', () => {
    for (const theme of [
      resolveTheme({ colors: { background: '#faf8f5' } }),
      resolveTheme(terminal),
      adaptTheme(resolveTheme()),
    ]) {
      expect(theme.colors.annotationMarkerFill).toBe(theme.colors.neutral.surface);
      expect(theme.colors.annotationPlate).toBe(theme.colors.neutral.surface);
    }
    const explicit = adaptTheme(
      resolveTheme({
        colors: {
          annotationMarkerFill: '#ffffff',
          annotationPlate: { light: '#ffffff', dark: '#eeeeee' },
        },
      }),
    );
    expect(explicit.colors.annotationMarkerFill).toBe('#ffffff');
    expect(explicit.colors.annotationPlate).toBe('#eeeeee');
  });
});
