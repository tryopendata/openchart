/**
 * Preset contracts: the two presets added by the design refresh, plus the
 * `rule` chrome surface they introduced.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from '../../colors/contrast';
import { CATEGORICAL_FILL_PALETTE_DARK, CATEGORICAL_PALETTE_DARK } from '../../colors/palettes';
import { adaptTheme } from '../dark-mode';
import { DEFAULT_THEME } from '../defaults';
import { broadsheet, terminal } from '../presets';
import { resolveTheme } from '../resolve';

describe('broadsheet preset', () => {
  it('resolves the newspaper surface, palette, and chrome', () => {
    const t = resolveTheme(broadsheet);
    expect(t.colors.background).toBe('#fffdf9');
    expect(t.colors.text).toBe('#1a1714');
    expect(t.colors.hairline).toBe('rgba(26,23,20,0.28)');
    expect(t.colors.categorical).toHaveLength(6);
    expect(t.colors.categorical[1]).toBe('#e3120b');
    expect(t.colors.categoricalFill).not.toEqual(t.colors.categorical);
    expect(t.borderRadius).toBe(0);
    expect(t.spacing.chromeGap).toBe(8);
    expect(t.spacing.chromeToChart).toBe(16);
    expect(t.chrome.title).toMatchObject({ fontSize: 24, fontWeight: 700 });
    expect(t.chrome.eyebrow).toMatchObject({ fontSize: 11, fontWeight: 700, color: '#e3120b' });
    expect(t.isDark).toBe(false);
  });

  it('ships the masthead rule and swaps its color in dark mode', () => {
    const t = resolveTheme(broadsheet);
    expect(t.rule).toEqual({ color: '#e3120b', width: 40, thickness: 3 });
    expect(adaptTheme(t).rule).toEqual({ color: '#f4463f', width: 40, thickness: 3 });
  });

  it('keeps text and axis ink readable on paper in both modes', () => {
    const light = resolveTheme(broadsheet);
    expect(meetsAA(light.colors.text, light.colors.background)).toBe(true);
    expect(meetsAA(light.colors.axis, light.colors.background)).toBe(true);
    const dark = adaptTheme(light);
    expect(dark.colors.background).toBe('#171513');
    expect(meetsAA(dark.colors.text, dark.colors.background)).toBe(true);
    expect(meetsAA(dark.colors.axis, dark.colors.background)).toBe(true);
  });

  it('clears 3:1 on paper for the two lead hues', () => {
    const t = resolveTheme(broadsheet);
    expect(contrastRatio(t.colors.categorical[0], t.colors.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.colors.categorical[1], t.colors.background)).toBeGreaterThanOrEqual(3);
  });
});

describe('terminal preset', () => {
  it('is dark in light mode and carries the dark palette variants', () => {
    const t = resolveTheme(terminal);
    expect(t.isDark).toBe(true);
    expect(t.colors.background).toBe('#0b0f14');
    expect(t.colors.categorical).toEqual([...CATEGORICAL_PALETTE_DARK]);
    expect(t.colors.categoricalFill).toEqual([...CATEGORICAL_FILL_PALETTE_DARK]);
    expect(t.seriesStrategy).toBe('accent-neutral');
    expect(t.borderRadius).toBe(4);
    expect(t.spacing.padding).toBe(12);
    expect(t.spacing.chromeGap).toBe(3);
    expect(t.fonts.sizes).toMatchObject({ title: 15, subtitle: 12, body: 12, small: 10 });
    expect(t.rule).toBeNull();
  });

  it('survives adaptChromeForDarkBg with its explicit chrome colors intact', () => {
    const t = resolveTheme(terminal);
    // The eyebrow accent is authored; the dark-background adaptation must not
    // rewrite it. The title had no explicit color, so it picks up theme text.
    expect(t.chrome.eyebrow.color).toBe('#22d3ee');
    expect(t.chrome.eyebrow.fontWeight).toBe(500);
    expect(t.chrome.title.color).toBe('#e6edf3');
    expect(t.chrome.title).toMatchObject({ fontSize: 15, fontWeight: 600 });
    expect(t.chrome.title.color).not.toBe(DEFAULT_THEME.chrome.title.color);
  });

  it('stays readable through an explicit dark-mode pass', () => {
    const dark = adaptTheme(resolveTheme(terminal));
    expect(dark.colors.background).toBe('#0b0f14');
    expect(dark.chrome.eyebrow.color).toBe('#22d3ee');
    expect(meetsAA(dark.colors.text, dark.colors.background)).toBe(true);
    expect(meetsAA(dark.colors.axis, dark.colors.background)).toBe(true);
    expect(
      contrastRatio(dark.colors.categorical[0], dark.colors.background),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('theme rule surface', () => {
  it('is null by default and passes a plain color through unchanged', () => {
    expect(resolveTheme().rule).toBeNull();
    const t = resolveTheme({ rule: { color: '#123456', width: 24, thickness: 2 } });
    expect(t.rule).toEqual({ color: '#123456', width: 24, thickness: 2 });
    // No TokenValue pair, so dark mode leaves the authored color alone.
    expect(adaptTheme(t).rule?.color).toBe('#123456');
  });
});
