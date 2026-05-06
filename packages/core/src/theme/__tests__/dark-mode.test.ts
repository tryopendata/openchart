import { hsl } from 'd3-color';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../colors/contrast';
import { adaptColorForDarkMode, adaptForLightLineStroke, adaptTheme } from '../dark-mode';
import { resolveTheme } from '../resolve';

describe('adaptColorForDarkMode', () => {
  const lightBg = '#ffffff';
  const darkBg = '#09090b';

  it('adapted color has similar contrast on dark bg as original on light bg', () => {
    const original = '#06b6d4'; // cyan, primary accent
    const adapted = adaptColorForDarkMode(original, lightBg, darkBg);

    const originalRatio = contrastRatio(original, lightBg);
    const adaptedRatio = contrastRatio(adapted, darkBg);

    // Should be within 30% of the original ratio
    const tolerance = originalRatio * 0.3;
    expect(Math.abs(adaptedRatio - originalRatio)).toBeLessThan(tolerance);
  });

  it('returns unchanged input for unparseable colors (e.g. raw oklch)', () => {
    const result = adaptColorForDarkMode('oklch(70% 0.15 200)', lightBg, darkBg);
    expect(result).toBe('oklch(70% 0.15 200)');
  });

  it('returns a valid hex color', () => {
    const result = adaptColorForDarkMode('#e15759', lightBg, darkBg);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles pure black gracefully', () => {
    const result = adaptColorForDarkMode('#000000', lightBg, darkBg);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('adaptForLightLineStroke', () => {
  it('darkens a saturated cyan by ~12% lightness', () => {
    const original = '#06b6d4';
    const darkened = adaptForLightLineStroke(original);
    expect(darkened).not.toBe(original);
    const c = hsl(darkened);
    const o = hsl(original);
    expect(c).not.toBeNull();
    expect(c!.l).toBeCloseTo(o.l - 0.12, 2);
  });

  it('passes saturated red and blue through with reduced lightness', () => {
    for (const color of ['#ef4444', '#3b82f6']) {
      const out = adaptForLightLineStroke(color);
      const before = hsl(color);
      const after = hsl(out);
      expect(after!.l).toBeLessThan(before.l);
    }
  });

  it('passes pure gray through unchanged (saturation below threshold)', () => {
    // zinc-400 has near-zero saturation; reducing lightness on a gray would
    // shift it toward black, which isn't desired for achromatic palettes.
    expect(adaptForLightLineStroke('#a1a1aa')).toBe('#a1a1aa');
  });

  it('passes already-dark colors through unchanged (l <= 0.4)', () => {
    // Indigo-900 sits at l ≈ 0.30 — already meets contrast on white.
    const dark = '#312e81';
    expect(adaptForLightLineStroke(dark)).toBe(dark);
  });

  it('passes invalid input through unchanged', () => {
    expect(adaptForLightLineStroke('not-a-color')).toBe('not-a-color');
    expect(adaptForLightLineStroke('')).toBe('');
  });
});

describe('adaptTheme', () => {
  it('sets isDark to true', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.isDark).toBe(true);
  });

  it('swaps to dark background', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.colors.background).toBe('#09090b');
  });

  it('updates text color for dark mode', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.colors.text).not.toBe(light.colors.text);
    // Dark text should be light
    const ratio = contrastRatio(dark.colors.text, dark.colors.background);
    expect(ratio).toBeGreaterThan(4);
  });

  it('preserves categorical palette across modes', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    // Design-system tokens are mode-agnostic: the same vibrant cyan-led
    // palette renders in both modes. Contrast-equivalence adaptation
    // dulls cyan into teal, which is not what the spec calls for.
    expect(dark.colors.categorical).toEqual(light.colors.categorical);
  });

  it('updates chrome text colors', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.chrome.title.color).not.toBe(light.chrome.title.color);
  });
});
